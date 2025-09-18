import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createABYIP, getABYIP, updateABYIP, deleteABYIP, uploadFile, getCBYDP, getAllABYIPs, clearAllABYIPs } from '../services/firebaseService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { FileText, Plus, Trash2, Save, Eye, Printer, CheckCircle, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { exportDocxFromTemplate, mapABYIPToTemplate } from '../services/docxExport';

interface ABYIPRow {
  referenceCode: string;
  ppas: string;
  description: string;
  expectedResult: string;
  performanceIndicator: string;
  periodOfImplementation: string;
  budget: {
    mooe: string;
    co: string;
    ps: string;
    total: string;
  };
  personResponsible: string;
}

interface ABYIPCenter {
  name: string;
  agenda: string;
  projects: ABYIPRow[];
}

interface SKMember {
  name: string;
  position: string;
}

interface ABYIPForm {
  centers: ABYIPCenter[];
  skMembers: SKMember[];
  showLogoInPrint: boolean;
  status: 'not_initiated' | 'open_for_editing' | 'pending_approval' | 'approved' | 'rejected';
  isEditingOpen: boolean;
  year: string;
  initiatedBy?: string;
  initiatedAt?: Date;
  closedBy?: string;
  closedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  lastEditedBy?: string;
  lastEditedAt?: Date;
  rejectionReason?: string;
}

const defaultRow: ABYIPRow = {
  referenceCode: '',
  ppas: '',
  description: '',
  expectedResult: '',
  performanceIndicator: '',
  periodOfImplementation: '',
  budget: {
    mooe: '',
    co: '',
    ps: '',
    total: '',
  },
  personResponsible: '',
};

const defaultCenter: ABYIPCenter = {
  name: '',
  agenda: '',
  projects: [{ ...defaultRow }],
};

const ABYIP: React.FC = () => {
  const { user, skProfile } = useAuth();
  const [form, setForm] = useState<ABYIPForm>({
    centers: [{ ...defaultCenter }],
    skMembers: [],
    showLogoInPrint: true,
    status: 'not_initiated',
    isEditingOpen: false,
    year: new Date().getFullYear().toString(),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [existingABYIPId, setExistingABYIPId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [cbydpCenters, setCbydpCenters] = useState<any[]>([]);
  const [selectedCenterIdxs, setSelectedCenterIdxs] = useState<number[]>([]);
  const [allABYIPs, setAllABYIPs] = useState<any[]>([]);
  const [selectedABYIPYear, setSelectedABYIPYear] = useState<string>('');

  // Load all ABYIPs for debugging
  const loadAllABYIPs = useCallback(async () => {
    try {
      console.log('Loading all ABYIPs...');
      const abyips = await getAllABYIPs();
      setAllABYIPs(abyips);
      console.log('All ABYIPs loaded:', abyips);
    } catch (error) {
      console.error('Error loading all ABYIPs:', error);
    }
  }, []);

  // Load existing ABYIP for current year
  const loadExistingABYIP = useCallback(async (yearToLoad?: string) => {
    try {
      const year = yearToLoad || form.year || selectedABYIPYear;
      console.log('Loading existing ABYIP for year:', year);
      console.log('Current user:', user);
      
      if (!year) {
        console.log('No year specified, skipping ABYIP load');
        return;
      }
      
      // First load all ABYIPs to see what's available
      await loadAllABYIPs();
      
      const existingABYIP = await getABYIP(year);
      console.log('Existing ABYIP result:', existingABYIP);
      
      if (existingABYIP) {
        const { id, ...abyipData } = existingABYIP;
        console.log('Setting ABYIP form data:', abyipData);
        console.log('Centers data:', (abyipData as any).centers);
        setForm(prev => ({
          ...prev,
          ...(abyipData as ABYIPForm),
          year: year // Ensure year is preserved
        }));
        setExistingABYIPId(id);
        setSaved(true);
      } else {
        console.log('No existing ABYIP found for year:', year, 'starting with empty form');
        // Reset to default form but keep the year
        setForm(prev => ({
          centers: [{ ...defaultCenter }],
          skMembers: prev.skMembers,
          showLogoInPrint: true,
          status: 'not_initiated',
          isEditingOpen: false,
          year: year
        }));
        setExistingABYIPId(null);
        setSaved(false);
      }
    } catch (error) {
      console.error('Error loading ABYIP:', error);
    }
  }, [form.year, selectedABYIPYear, user, loadAllABYIPs]);

  // Load SK members
  const loadSKMembers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const members: SKMember[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive !== false) {
          members.push({
            name: data.name || '',
            position: data.role === 'chairperson' ? 'SK Chairperson' :
                      data.role === 'secretary' ? 'SK Secretary' :
                      data.role === 'treasurer' ? 'SK Treasurer' : 'SK Member'
          });
        }
      });
      setForm(prev => ({ ...prev, skMembers: members }));
    } catch (error) {
      console.error('Error loading SK members:', error);
    }
  };

  // Open import modal from approved CBYDP
  const openImportFromCBYDP = async () => {
    try {
      const cbydp = await getCBYDP();
      if (cbydp && (cbydp as any).status === 'approved') {
        setCbydpCenters((cbydp as any).centers || []);
        setSelectedCenterIdxs([]);
        setImportModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading from CBYDP:', error);
    }
  };

  const importSelectedCenters = () => {
    if (!cbydpCenters || selectedCenterIdxs.length === 0) {
      setImportModalOpen(false);
      return;
    }
    const toImport = selectedCenterIdxs.map((idx) => cbydpCenters[idx]).filter(Boolean);
    const convertedCenters: ABYIPCenter[] = toImport.map((center: any) => ({
      name: center.name,
      agenda: center.agenda,
      projects: (center.projects || []).map((project: any) => ({
        referenceCode: `ABYIP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ppas: project.ppas || `${project.programs?.join(', ') || ''} | ${project.projects?.join(', ') || ''} | ${project.actions?.join(', ') || ''}`.replace(/^\s*\|\s*|\s*\|\s*$/g, ''),
        description: `${project.concern} - ${project.objective}`,
        expectedResult: project.indicator,
        performanceIndicator: project.indicator,
        periodOfImplementation: 'January - December',
        budget: {
          mooe: project.expenses?.[0]?.cost || '',
          co: '',
          ps: '',
          total: project.expenses?.[0]?.cost || '',
        },
        personResponsible: project.responsible,
      }))
    }));

    setForm(prev => ({ ...prev, centers: [...prev.centers, ...convertedCenters] }));
    setImportModalOpen(false);
  };

  // Helper function for auto-saving project changes
  const autoSaveProjectChange = async (updatedForm: ABYIPForm) => {
    if (existingABYIPId) {
      // Clear any existing timeout
      if ((window as any).projectChangeTimeout) {
        clearTimeout((window as any).projectChangeTimeout);
      }
      
      // Set new timeout for auto-save
      (window as any).projectChangeTimeout = setTimeout(async () => {
        try {
          const abyipData = {
            ...updatedForm,
            lastEditedBy: user?.name,
            lastEditedAt: new Date(),
            updatedAt: new Date()
          };
          await updateABYIP(existingABYIPId, abyipData as any);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        } catch (error) {
          console.error('Error auto-saving project changes:', error);
          setError('Failed to auto-save. Please click Save ABYIP manually.');
        }
      }, 2000); // Wait 2 seconds after user stops typing
    }
  };

  // Save ABYIP (create/update)
  const saveABYIP = async () => {
    try {
      setSaving(true);
      setError('');
      console.log('Saving ABYIP with form data:', form);
      console.log('Existing ABYIP ID:', existingABYIPId);
      
      const payload = { 
        ...form,
        lastEditedBy: user?.name,
        lastEditedAt: new Date()
      };
      
      console.log('Payload to save:', payload);
      
      if (existingABYIPId) {
        console.log('Updating existing ABYIP...');
        await updateABYIP(existingABYIPId, payload as any);
        console.log('ABYIP updated successfully');
      } else {
        console.log('Creating new ABYIP...');
        const id = await createABYIP(payload as any);
        setExistingABYIPId(id);
        console.log('ABYIP created successfully with ID:', id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      console.error('Error saving ABYIP:', e);
      setError(e?.message || 'Failed to save ABYIP');
    } finally {
      setSaving(false);
    }
  };

  // Reliable print using hidden iframe (same as CBYDP approach)
  const handlePrint = () => {
    const performPrint = () => {
      if (!printRef.current) return;
      const printContents = printRef.current.innerHTML;
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <base href="${window.location.origin}/" />
    <title>ABYIP Print</title>
    <style>
      @page { size: 13in 8.5in; margin: 8mm; }
      body { 
        font-family: 'Calibri', Arial, sans-serif; 
        font-size: 12pt; 
        margin: 0; 
        padding: 0;
        background: white;
      }
      html, body { background: white; }
      .print-content { width: 13in !important; min-height: 8.5in !important; padding: 18px; }
      table { page-break-inside: auto; border-collapse: collapse; width: 100%; font-size: 9pt; }
      th, td { border: 1px solid #000; padding: 4px; vertical-align: top; }
      .page-content { page-break-inside: avoid; }
      tr { page-break-inside: auto; }
      .prepared-by-section { page-break-inside: avoid; margin-top: 1.5rem; }
    </style>
  </head>
  <body>
    <div class="print-content">${printContents}</div>
    <script>
      (function(){
        function waitForImages(){
          var imgs = Array.prototype.slice.call(document.images || []);
          if(imgs.length === 0) return Promise.resolve();
          return Promise.all(imgs.map(function(img){
            return new Promise(function(res){ if(img.complete){res();} else { img.onload = img.onerror = function(){res();}; } });
          }));
        }
        Promise.resolve()
          .then(function(){ return (document.fonts && document.fonts.ready) ? document.fonts.ready : null; })
          .then(function(){ return waitForImages(); })
          .then(function(){ setTimeout(function(){ window.focus(); window.print(); }, 200); });
      })();
    <\/script>
  </body>
</html>`);
      doc.close();

      setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} }, 5000);
    };

    if (!printRef.current) return;
    performPrint();
  };

  // Fetch SK members and all ABYIPs on initial load
  useEffect(() => {
    loadSKMembers();
    loadAllABYIPs();
  }, []);

  // Reload ABYIP when year changes
  useEffect(() => {
    if (form.year) {
      console.log('Year changed, reloading ABYIP for:', form.year);
      loadExistingABYIP();
    }
  }, [form.year, loadExistingABYIP]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ABYIP Creation</h1>
        <p className="text-gray-600">Create Annual Barangay Youth Investment Program</p>
      </div>

      {/* ABYIP Management Panel */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">ABYIP Management</h3>
        
        {/* Year Selection */}
        <div className="flex items-center space-x-4 mb-4">
          <label className="text-sm font-medium text-blue-900">Select Year:</label>
          <select
            value={selectedABYIPYear}
            onChange={(e) => {
              const newYear = e.target.value;
              setSelectedABYIPYear(newYear);
              setForm(prev => ({ ...prev, year: newYear }));
              // Load ABYIP for the new year
              if (newYear) {
                loadExistingABYIP(newYear);
              }
            }}
            className="border border-blue-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="">Select a year...</option>
            {Array.from({ length: 3 }, (_, i) => {
              const year = new Date().getFullYear() + i;
              const hasABYIP = allABYIPs.some(abyip => abyip.year === year.toString());
  return (
                <option key={year} value={year.toString()}>
                  {year} {hasABYIP ? '(Created)' : '(Available)'}
                </option>
              );
            })}
          </select>
          
          {/* Create New ABYIP Button */}
          {selectedABYIPYear && !allABYIPs.some(abyip => abyip.year === selectedABYIPYear) && (
            <button
              onClick={async () => {
                const updatedForm = {
                  ...form,
                  year: selectedABYIPYear,
                  status: 'open_for_editing' as const,
                  isEditingOpen: true,
                  initiatedBy: user?.name,
                  initiatedAt: new Date()
                };
                setForm(updatedForm);

                try {
                  setSaving(true);
                  const id = await createABYIP(updatedForm as any);
                  setExistingABYIPId(id);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 3000);
                  // Reload all ABYIPs to update the list
                  await loadAllABYIPs();
                  // Load the newly created ABYIP
                  await loadExistingABYIP(selectedABYIPYear);
                } catch (e: any) {
                  setError(e?.message || 'Failed to create ABYIP');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="btn-primary text-sm"
            >
              {saving ? 'Creating...' : 'Create New ABYIP'}
            </button>
          )}
        </div>

        {/* Available ABYIPs List */}
        {allABYIPs.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Existing ABYIPs:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {allABYIPs.map((abyip) => (
                <div key={abyip.id} className="bg-white border border-blue-200 rounded p-3">
                  <div className="font-medium text-blue-700">Year: {abyip.year}</div>
                  <div className="text-sm text-gray-600">Status: {abyip.status}</div>
                  <div className="text-sm text-gray-600">
                    Created: {abyip.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-600">Centers: {abyip.centers?.length || 0}</div>
                  <button
                    onClick={() => {
                      setSelectedABYIPYear(abyip.year);
                      setForm(prev => ({ ...prev, year: abyip.year }));
                      loadExistingABYIP(abyip.year);
                    }}
                    className="mt-2 text-xs bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded"
                  >
                    Load This ABYIP
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Import from CBYDP Button */}
        {selectedABYIPYear && allABYIPs.some(abyip => abyip.year === selectedABYIPYear) && (
          <div className="mt-4">
            <button
              onClick={openImportFromCBYDP}
              className="btn-secondary text-sm"
            >
              Import from approved CBYDP
            </button>
          </div>
        )}
      </div>


      {/* Current ABYIP Status */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">Current ABYIP Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-yellow-700">Year:</span>
            <div className="text-gray-600">{form.year}</div>
          </div>
          <div>
            <span className="font-medium text-yellow-700">Status:</span>
            <div className="text-gray-600">{form.status}</div>
          </div>
          <div>
            <span className="font-medium text-yellow-700">ABYIP ID:</span>
            <div className="text-gray-600">{existingABYIPId ? existingABYIPId.substring(0, 8) + '...' : 'None'}</div>
          </div>
          <div>
            <span className="font-medium text-yellow-700">Centers:</span>
            <div className="text-gray-600">{form.centers?.length || 0}</div>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {saved && (
        <div className="mb-6 p-4 bg-success-50 border border-success-200 text-success-700 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          ABYIP saved successfully!
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Import from CBYDP Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Import Centers from Approved CBYDP</h3>
            {(!cbydpCenters || cbydpCenters.length === 0) ? (
              <div className="text-sm text-gray-600">No approved CBYDP found or it has no centers.</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-auto">
                {cbydpCenters.map((center: any, idx: number) => (
                  <label key={idx} className="flex items-start space-x-3 p-3 border rounded-md">
                    <input
                      type="checkbox"
                      checked={selectedCenterIdxs.includes(idx)}
                      onChange={(e) => {
                        setSelectedCenterIdxs(prev => e.target.checked ? [...prev, idx] : prev.filter(i => i !== idx));
                      }}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">{center.name || `Center ${idx + 1}`}</div>
                      <div className="text-sm text-gray-600">{center.agenda}</div>
                      <div className="text-xs text-gray-500">{(center.projects || []).length} projects</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end space-x-3">
              <button className="btn-secondary" onClick={() => setImportModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={importSelectedCenters} disabled={selectedCenterIdxs.length === 0}>Import Selected</button>
            </div>
          </div>
        </div>
      )}

      {/* ABYIP Status */}
      {existingABYIPId && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-center">
        <div>
              <h3 className="font-semibold text-blue-900">ABYIP Status for {form.year}</h3>
              <div className="flex items-center space-x-4 mt-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                   form.status === 'not_initiated' ? 'bg-gray-100 text-gray-800' :
                   form.status === 'open_for_editing' ? 'bg-blue-100 text-blue-800' :
                   form.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                  form.status === 'approved' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                   {form.status === 'not_initiated' ? 'Not Initiated' :
                    form.status === 'open_for_editing' ? 'Open for Editing' :
                    form.status === 'pending_approval' ? 'Pending Approval' :
                   form.status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
                {form.initiatedBy && (
                  <span className="text-sm text-blue-700">
                    Initiated by: {form.initiatedBy}
                  </span>
                )}
                {form.lastEditedBy && (
                  <span className="text-sm text-blue-700">
                    Last edited by: {form.lastEditedBy}
                  </span>
                )}
                {form.status === 'approved' && form.approvedBy && (
                  <span className="text-sm text-green-700">
                    Approved by: {form.approvedBy}
                  </span>
                )}
                {form.status === 'rejected' && form.rejectionReason && (
                  <span className="text-sm text-red-700">
                    Reason: {form.rejectionReason}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex space-x-3">
          {/* Initiate ABYIP - Only for Chairperson when not initiated */}
          {user?.role === 'chairperson' && form.status === 'not_initiated' && (
            <button
              onClick={async () => {
                const updatedForm = {
                  ...form,
                  status: 'open_for_editing' as const,
                  isEditingOpen: true,
                  initiatedBy: user?.name,
                  initiatedAt: new Date()
                };
                setForm(updatedForm);
                
                // Save the initiated state
                try {
                  setSaving(true);
                  const id = await createABYIP(updatedForm as any);
                  setExistingABYIPId(id);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 3000);
                } catch (e: any) {
                  setError(e?.message || 'Failed to initiate ABYIP');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="btn-primary flex items-center"
            >
              <FileText className="h-4 w-4 mr-2" />
              Initiate ABYIP
            </button>
          )}

          {/* Save Button - Available to all members when editing is open */}
          {form.isEditingOpen && (
            <button
              onClick={saveABYIP}
              disabled={saving || form.status === 'approved'}
              className="btn-primary flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              Save ABYIP
            </button>
          )}

          {/* Preview Button - Only available when ABYIP is initiated */}
          {form.status !== 'not_initiated' && (
            <button
              onClick={() => setPreview(!preview)}
              className="btn-secondary flex items-center"
            >
              <Eye className="h-4 w-4 mr-2" />
              {preview ? 'Edit Mode' : 'Preview'}
            </button>
          )}

          {/* Refresh Button - Available to all */}
          <button
            onClick={() => {
              loadExistingABYIP();
              loadSKMembers();
            }}
            disabled={saving}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>

          {/* Debug Button */}
          <button
            onClick={() => {
              console.log('Current form state:', form);
              console.log('Centers:', form.centers);
              console.log('Existing ABYIP ID:', existingABYIPId);
              console.log('All ABYIPs:', allABYIPs);
              console.log('Selected Year:', selectedABYIPYear);
              console.log('Form Status:', form.status);
              console.log('Is Editing Open:', form.isEditingOpen);
            }}
            className="btn-secondary flex items-center"
          >
            Debug
          </button>

          {/* Reset All ABYIPs Button */}
          <button
            onClick={async () => {
              if (!window.confirm('Are you sure you want to delete ALL ABYIP documents? This action cannot be undone.')) {
                return;
              }

              try {
                setSaving(true);
                setError('');
                
                await clearAllABYIPs();
                
                // Reset form state
                setForm({
                  centers: [{ ...defaultCenter }],
                  skMembers: [],
                  showLogoInPrint: true,
                  status: 'not_initiated',
                  isEditingOpen: false,
                  year: new Date().getFullYear().toString()
                });
                setExistingABYIPId(null);
                setSelectedABYIPYear('');
                setAllABYIPs([]);
                setSaved(false);
                
                // Reload SK members
                await loadSKMembers();
                
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
                console.log('All ABYIPs have been reset successfully');
              } catch (error: any) {
                console.error('Error resetting ABYIPs:', error);
                setError(error?.message || 'Failed to reset ABYIPs');
              } finally {
                setSaving(false);
              }
            }}
            className="btn-danger flex items-center"
            disabled={saving}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Reset All ABYIPs
          </button>

          {/* Show All ABYIPs Button */}
          <button
            onClick={loadAllABYIPs}
            className="btn-secondary flex items-center"
          >
            <FileText className="h-4 w-4 mr-2" />
            Show All ABYIPs
        </button>
      </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={form.showLogoInPrint}
              onChange={(e) => setForm(prev => ({ ...prev, showLogoInPrint: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600">Show Logo in Printout</span>
          </label>
        </div>
      </div>

      {preview ? (
        <div className="space-y-6">
          {/* Print Preview */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Print Preview</h3>
              <div className="flex space-x-3">
                <button
                  onClick={handlePrint}
                  className="btn-primary flex items-center"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </button>
                <button
                  onClick={async () => {
                    try {
                      console.log('ABYIP Form data before export:', form);
                      console.log('ABYIP SK Profile data:', skProfile);
                      console.log('ABYIP Current user:', user);
                      
                      // Create comprehensive payload with multiple data sources
                      const payload = {
                        form,
                        skProfile,
                        user,
                        // Add any additional context that might help
                        timestamp: new Date().toISOString(),
                        exportType: 'ABYIP'
                      };
                      
                      const data = mapABYIPToTemplate(payload);
                      console.log('ABYIP Mapped data for export:', data);
                      await exportDocxFromTemplate({
                        templatePath: '/templates/abyip_template.docx',
                        data,
                        outputFileName: `ABYIP_${skProfile?.barangay || 'Document'}_${form.year || '2024'}`,
                      });
                    } catch (e) {
                      console.error('ABYIP template export failed', e);
                      alert('Failed to export ABYIP Word document from template.');
                    }
                  }}
                  className="btn-secondary flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export to Word
                </button>
              </div>
            </div>
            
            <div ref={printRef} className="print-content bg-white p-8" style={{ width: '13in', minHeight: '8.5in', display: 'block', visibility: 'visible', fontFamily: "'Times New Roman', serif" }}>
              {/* ABYIP Print Content - Separate page for each center like CBYDP */}
              {form.centers.map((center, ci) => {
                // Calculate how many rows can fit per page (approximately 2 rows per page to ensure "Prepared by" fits)
                const rowsPerPage = 2;
                const totalRows = center.projects.length;
                const totalPages = Math.ceil(totalRows / rowsPerPage);
                
                return Array.from({ length: totalPages }, (_, pageNum) => {
                  const startRow = pageNum * rowsPerPage;
                  const endRow = Math.min(startRow + rowsPerPage, totalRows);
                  const pageRows = center.projects.slice(startRow, endRow);
                 
                 return (
                   <div key={`${ci}-${pageNum}`} style={{ pageBreakAfter: 'always' }}>
                     {/* Header - repeated on every page - Matching CBYDP style exactly */}
                     <div className="mb-3" style={{ position: 'relative' }}>
                       {/* Annex B - Top Right */}
                       <div style={{ position: 'absolute', top: 0, right: 0 }}>
                         <div className="text-xs font-semibold border border-gray-700 px-2 py-1">Annex "B"</div>
                       </div>

                       {/* Barangay Logo */}
                       {form.showLogoInPrint && skProfile?.logo && (
                         <div className="w-full flex justify-center mb-2">
                           <img src={skProfile.logo} alt="Barangay Logo" style={{ width: '0.9in', height: '0.9in', objectFit: 'cover' }} />
                         </div>
                       )}

                       {/* Barangay + SK - Matching CBYDP format exactly */}
                       <div className="text-center leading-tight mb-2">
                         <div className="text-base font-bold mb-1">
                           <span style={{ fontSize: '16pt', fontWeight: 'bold' }}>Barangay </span>
                           <span style={{ fontSize: '16pt', fontWeight: 'bold' }}>
                             {skProfile?.barangay || '\u00A0'}
                           </span>
                         </div>
                         <div style={{ fontSize: '16pt', fontWeight: 'bold' }}>Sangguniang Kabataan</div>
                       </div>

                       {/* Title */}
                       <div className="text-center mb-2">
                         <div className="text-sm font-semibold">ANNUAL BARANGAY YOUTH INVESTMENT PROGRAM (ABYIP)</div>
                       </div>
                       
                       {/* Region / Province / City - Matching CBYDP format exactly */}
                       <div className="text-xs mb-1" style={{ width: '100%' }}>
                         <div className="flex items-center mb-1">
                           <span className="mr-2">Region:</span>
                           <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '1.6in' }}>{skProfile?.region || '\u00A0'}</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <div className="flex items-center">
                             <span className="mr-2">Province:</span>
                             <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '1.9in' }}>{skProfile?.province || '\u00A0'}</span>
                           </div>
                           <div className="flex items-center" style={{ marginLeft: '0.5in' }}>
                             <span className="mr-2">City/Municipality:</span>
                             <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '2.2in' }}>{skProfile?.city || '\u00A0'}</span>
                           </div>
                         </div>
                       </div>

                       {/* ABYIP CY - Matching CBYDP format exactly */}
                       <div className="text-center text-xs my-2">
                         <span>ANNUAL BARANGAY YOUTH INVESTMENT PROGRAM (ABYIP) CY</span>
                         <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '0.6in', margin: '0 0.1in' }}>
                           {form.year || '\u00A0'}
                         </span>
                       </div>
                     </div>

                     {/* Center of Participation and Agenda - show on every page for clarity - Matching CBYDP format exactly */}
                     <div className="mb-3">
                       {/* Center of Participation line */}
                       <div className="text-xs mb-1">
                         <span className="font-semibold">CENTER OF PARTICIPATION:</span>
                         <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '3.0in', marginLeft: '0.1in' }}>
                           {center.name || '\u00A0'}
                         </span>
                       </div>

                       {/* Agenda Statement */}
                       <div className="text-xs mb-2">
                         <div className="mb-1">Agenda Statement:</div>
                         <div style={{ borderBottom: '1px solid #000', minHeight: '0.25in' }}>
                           {center.agenda || '\u00A0'}
                         </div>
                       </div>
                     </div>
                     
                     {/* Page indicator for multi-page centers - Matching CBYDP format */}
                     {totalPages > 1 && (
                       <div className="text-xs text-right mt-2 mb-2">
                         Page {pageNum + 1} of {totalPages}
                       </div>
                     )}

                     {/* ABYIP Table - Exact template format */}
                     <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', border: '1px solid #000' }}>
                       <thead>
                         <tr>
                           <th style={{ width: '0.8in', border: '1px solid #000', padding: '4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Reference Code</th>
                           <th style={{ width: '1.5in', border: '1px solid #000', padding: '4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>PPAs</th>
                           <th style={{ width: '2.0in', border: '1px solid #000', padding: '4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Description</th>
                           <th style={{ width: '1.5in', border: '1px solid #000', padding: '4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Expected Result</th>
                           <th style={{ width: '1.2in', border: '1px solid #000', padding: '4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Performance Indicator</th>
                           <th style={{ width: '1.0in', border: '1px solid #000', padding: '4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Period of Implementation</th>
                           <th colSpan={4} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Budget</th>
                           <th style={{ width: '1.0in', border: '1px solid #000', padding: '4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Person Responsible</th>
                         </tr>
                         <tr>
                           <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                           <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                           <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                           <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                           <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                           <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                           <th style={{ width: '0.8in', border: '1px solid #000', padding: '4px', textAlign: 'center' }}>MOOE</th>
                           <th style={{ width: '0.8in', border: '1px solid #000', padding: '4px', textAlign: 'center' }}>CO</th>
                           <th style={{ width: '0.8in', border: '1px solid #000', padding: '4px', textAlign: 'center' }}>PS</th>
                           <th style={{ width: '0.9in', border: '1px solid #000', padding: '4px', textAlign: 'center' }}>Total</th>
                           <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                         </tr>
                       </thead>
                       <tbody>
                         {pageRows.length > 0 ? pageRows.map((project, pi) => (
                           <tr key={`${ci}-${pageNum}-${pi}`}>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.referenceCode}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.ppas}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.description}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.expectedResult}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.performanceIndicator}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.periodOfImplementation}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.budget.mooe && `₱${project.budget.mooe}`}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.budget.co && `₱${project.budget.co}`}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.budget.ps && `₱${project.budget.ps}`}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.budget.total && `₱${project.budget.total}`}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.personResponsible}</td>
                           </tr>
                         )) : Array.from({ length: 2 }).map((_, pi) => (
                           <tr key={`${ci}-${pageNum}-empty-${pi}`}>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', height: '0.5in' }}></td>
                           </tr>
                         ))}
                       </tbody>
                     </table>

                     {/* Prepared by - ABYIP format with Secretary */}
                     <div style={{ marginTop: '12px', pageBreakInside: 'avoid' }}>
                       <div style={{ textAlign: 'center', fontSize: '9pt', fontWeight: '600', marginBottom: '8px' }}>Prepared by:</div>
                       <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                         <div style={{ width: '2.5in' }}>
                           <div style={{ borderBottom: '1px solid #000', height: '0.25in' }}>
                             <div style={{ fontSize: '9pt' }}>{form.skMembers.find(m => m.position === 'SK Secretary')?.name || ''}</div>
                           </div>
                           <div style={{ fontSize: '9pt', marginTop: '4px' }}>SK Secretary</div>
                         </div>
                         <div style={{ width: '2.5in' }}>
                           <div style={{ borderBottom: '1px solid #000', height: '0.25in' }}>
                             <div style={{ fontSize: '9pt' }}>{form.skMembers.find(m => m.position === 'SK Treasurer')?.name || ''}</div>
                           </div>
                           <div style={{ fontSize: '9pt', marginTop: '4px' }}>SK Treasurer</div>
                         </div>
                         <div style={{ width: '2.5in' }}>
                           <div style={{ borderBottom: '1px solid #000', height: '0.25in' }}>
                             <div style={{ fontSize: '9pt' }}>{form.skMembers.find(m => m.position === 'SK Chairperson')?.name || ''}</div>
                           </div>
                           <div style={{ fontSize: '9pt', marginTop: '4px' }}>SK Chairperson</div>
                         </div>
        </div>
      </div>
                   </div>
                 );
               });
             })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Workflow Status Notices */}
          {form.status === 'not_initiated' && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              ABYIP for {form.year} has not been initiated yet. The SK Chairperson must initiate the ABYIP to begin the process.
            </div>
          )}

          {form.status === 'open_for_editing' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              ABYIP for {form.year} is open for editing. All SK members can add and edit projects.
            </div>
          )}

          {form.status === 'pending_approval' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              ABYIP for {form.year} is pending approval.
            </div>
          )}

          {form.status === 'approved' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              ABYIP for {form.year} has been approved and is now read-only.
            </div>
          )}

          {form.status === 'rejected' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              ABYIP for {form.year} was rejected. Reason: {form.rejectionReason}. The SK Chairperson can re-initiate the ABYIP to start the process again.
            </div>
          )}

          {/* Centers of Participation */}
          <div className="space-y-4">
            {form.centers.map((center, centerIdx) => (
              <div key={centerIdx} className="card">
                <div className="card-header">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Center of Participation {centerIdx + 1}
                    </h3>
                    {form.status !== 'not_initiated' && form.centers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updatedCenters = form.centers.filter((_, i) => i !== centerIdx);
                          setForm(prev => ({ ...prev, centers: updatedCenters }));
                        }}
                        className="text-danger-600 hover:text-danger-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="form-label">Center Name</label>
                      <input
                        type="text"
                        value={center.name}
                        onChange={async (e) => {
                          const updatedCenters = form.centers.map((c, i) =>
                            i === centerIdx ? { ...c, name: e.target.value } : c
                          );
                          const updatedForm = { ...form, centers: updatedCenters };
                          setForm(updatedForm);
                          
                          // Auto-save if ABYIP already exists (with debouncing)
                          if (existingABYIPId) {
                            // Clear any existing timeout
                            if ((window as any).centerNameTimeout) {
                              clearTimeout((window as any).centerNameTimeout);
                            }
                            
                            // Set new timeout for auto-save
                            (window as any).centerNameTimeout = setTimeout(async () => {
                              try {
                                const abyipData = {
                                  ...updatedForm,
                                  lastEditedBy: user?.name,
                                  lastEditedAt: new Date(),
                                  updatedAt: new Date()
                                };
                                await updateABYIP(existingABYIPId, abyipData as any);
                                setSaved(true);
                                setTimeout(() => setSaved(false), 3000);
                              } catch (error) {
                                console.error('Error auto-saving center name:', error);
                                setError('Failed to auto-save. Please click Save ABYIP manually.');
                              }
                            }, 2000); // Wait 2 seconds after user stops typing
                          }
                        }}
                        className="input-field"
                        placeholder="e.g., Health, Sports, Education"
                        required
                        disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                      />
                    </div>
                    <div>
                      <label className="form-label">Agenda Statement</label>
                      <textarea
                        value={center.agenda}
                        onChange={async (e) => {
                          const updatedCenters = form.centers.map((c, i) =>
                            i === centerIdx ? { ...c, agenda: e.target.value } : c
                          );
                          const updatedForm = { ...form, centers: updatedCenters };
                          setForm(updatedForm);
                          
                          // Auto-save if ABYIP already exists (with debouncing)
                          if (existingABYIPId) {
                            // Clear any existing timeout
                            if ((window as any).centerAgendaTimeout) {
                              clearTimeout((window as any).centerAgendaTimeout);
                            }
                            
                            // Set new timeout for auto-save
                            (window as any).centerAgendaTimeout = setTimeout(async () => {
                              try {
                                const abyipData = {
                                  ...updatedForm,
                                  lastEditedBy: user?.name,
                                  lastEditedAt: new Date(),
                                  updatedAt: new Date()
                                };
                                await updateABYIP(existingABYIPId, abyipData as any);
                                setSaved(true);
                                setTimeout(() => setSaved(false), 3000);
                              } catch (error) {
                                console.error('Error auto-saving center agenda:', error);
                                setError('Failed to auto-save. Please click Save ABYIP manually.');
                              }
                            }, 2000); // Wait 2 seconds after user stops typing
                          }
                        }}
                        className="input-field"
                        rows={3}
                        placeholder="Describe the agenda for this center"
                        required
                        disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                      />
                    </div>
                  </div>

                  {/* Projects Table */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-gray-900">Projects</h4>
                      {form.status !== 'not_initiated' && form.isEditingOpen && (
                        <button
                          type="button"
                          onClick={async () => {
                            const updatedCenters = form.centers.map((c, i) =>
                              i === centerIdx ? { ...c, projects: [...c.projects, { ...defaultRow }] } : c
                            );
                            const updatedForm = { ...form, centers: updatedCenters };
                            setForm(updatedForm);
                            
                            // Auto-save if ABYIP already exists
                            if (existingABYIPId) {
                              try {
                                const abyipData = {
                                  ...updatedForm,
                                  lastEditedBy: user?.name,
                                  lastEditedAt: new Date(),
                                  updatedAt: new Date()
                                };
                                await updateABYIP(existingABYIPId, abyipData as any);
                                setSaved(true);
                                setTimeout(() => setSaved(false), 3000);
                              } catch (error) {
                                console.error('Error auto-saving after adding project:', error);
                                setError('Failed to auto-save. Please click Save ABYIP manually.');
                              }
                            }
                          }}
                          className="btn-secondary flex items-center"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Project
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300" style={{ minWidth: '1800px' }}>
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '120px' }}>Reference Code</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '200px' }}>PPAs</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '250px' }}>Description</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '200px' }}>Expected Result</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '150px' }}>Performance Indicator</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '120px' }}>Period</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '120px' }}>MOOE</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '120px' }}>CO</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '120px' }}>PS</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '120px' }}>Total</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '120px' }}>Responsible</th>
                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '80px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {center.projects.map((project, projectIdx) => (
                            <tr key={projectIdx}>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.referenceCode}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, referenceCode: e.target.value } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-sm"
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.ppas}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, ppas: e.target.value } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-sm"
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <textarea
                                  value={project.description}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, description: e.target.value } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-sm resize-none"
                                  rows={3}
                                  style={{ minHeight: '60px' }}
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.expectedResult}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, expectedResult: e.target.value } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-sm"
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.performanceIndicator}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, performanceIndicator: e.target.value } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-sm"
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.periodOfImplementation}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, periodOfImplementation: e.target.value } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-sm"
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.budget.mooe}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, budget: { ...p.budget, mooe: e.target.value } } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-xs"
                                  placeholder="MOOE"
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.budget.co}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, budget: { ...p.budget, co: e.target.value } } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-xs"
                                  placeholder="CO"
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.budget.ps}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, budget: { ...p.budget, ps: e.target.value } } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-xs"
                                  placeholder="PS"
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.budget.total}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, budget: { ...p.budget, total: e.target.value } } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-xs font-semibold"
                                  placeholder="Total"
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.personResponsible}
                                  onChange={async (e) => {
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, personResponsible: e.target.value } : p
                                        )
                                      } : c
                                    );
                                    const updatedForm = { ...form, centers: updatedCenters };
                                    setForm(updatedForm);
                                    await autoSaveProjectChange(updatedForm);
                                  }}
                                  className="w-full border-none focus:ring-0 text-sm"
                                  disabled={form.status === 'not_initiated' || !form.isEditingOpen || form.status === 'approved'}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                {form.status !== 'not_initiated' && form.isEditingOpen && center.projects.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const updatedCenters = form.centers.map((c, i) =>
                                        i === centerIdx ? {
                                          ...c,
                                          projects: c.projects.filter((_, j) => j !== projectIdx)
                                        } : c
                                      );
                                      const updatedForm = { ...form, centers: updatedCenters };
                                      setForm(updatedForm);
                                      
                                      // Auto-save if ABYIP already exists
                                      if (existingABYIPId) {
                                        try {
                                          const abyipData = {
                                            ...updatedForm,
                                            lastEditedBy: user?.name,
                                            lastEditedAt: new Date(),
                                            updatedAt: new Date()
                                          };
                                          await updateABYIP(existingABYIPId, abyipData as any);
                                          setSaved(true);
                                          setTimeout(() => setSaved(false), 3000);
                                        } catch (error) {
                                          console.error('Error auto-saving after removing project:', error);
                                          setError('Failed to auto-save. Please click Save ABYIP manually.');
                                        }
                                      }
                                    }}
                                    className="text-danger-600 hover:text-danger-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {form.status !== 'not_initiated' && form.isEditingOpen && (
              <button
                type="button"
                onClick={() => {
                  setForm(prev => ({
                    ...prev,
                    centers: [...prev.centers, { ...defaultCenter }]
                  }));
                }}
                className="btn-secondary flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Center of Participation
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ABYIP; 