import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createCBYDP, getCBYDP, updateCBYDP } from '../services/firebaseService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { FileText, Plus, Trash2, Save, Eye, Printer, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface CBYDPRow {
  concern: string;
  objective: string;
  indicator: string;
  target1: string;
  target2: string;
  target3: string;
  ppas: string;
  budget: string;
  responsible: string;
}

interface CBYDCenter {
  name: string;
  agenda: string;
  projects: CBYDPRow[];
}

interface SKMember {
  name: string;
  position: string;
}

interface CBYDPForm {
  region: string;
  province: string;
  city: string;
  barangay: string;
  centers: CBYDCenter[];
  skMembers: SKMember[];
  federationPresident: string;
  showLogoInPrint: boolean;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  lastEditedBy?: string;
  lastEditedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
}

const defaultRow: CBYDPRow = {
  concern: '',
  objective: '',
  indicator: '',
  target1: '',
  target2: '',
  target3: '',
  ppas: '',
  budget: '',
  responsible: '',
};

const defaultCenter: CBYDCenter = {
  name: '',
  agenda: '',
  projects: [{ ...defaultRow }],
};

const CBYDP: React.FC = () => {
  const { user, skProfile } = useAuth();
  const [form, setForm] = useState<CBYDPForm>({
    region: skProfile?.region || '',
    province: skProfile?.province || user?.province || '',
    city: skProfile?.city || user?.municipality || '',
    barangay: skProfile?.barangay || user?.barangay || '',
    centers: [{ ...defaultCenter }],
    skMembers: [],
    federationPresident: skProfile?.federationPresident || '',
    showLogoInPrint: true,
    status: 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [existingCBYDPId, setExistingCBYDPId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch existing CBYDP and SK members
  useEffect(() => {
    loadExistingCBYDP();
    loadSKMembers();
  }, []);

  // Reload CBYDP when user changes (in case of switching accounts)
  useEffect(() => {
    if (user) {
      console.log('User changed, reloading CBYDP for:', user.name);
      loadExistingCBYDP();
    }
  }, [user?.uid]);

  const loadExistingCBYDP = async () => {
    try {
      console.log('Loading existing CBYDP for user:', user?.name, user?.role);
      const existingCBYDP = await getCBYDP();
      console.log('Existing CBYDP result:', existingCBYDP);
      
      if (existingCBYDP) {
        const { id, ...cbydpData } = existingCBYDP;
        console.log('Setting CBYDP form data:', cbydpData);
        setForm(cbydpData as CBYDPForm);
        setExistingCBYDPId(id);
        setSaved(true);
      } else {
        console.log('No existing CBYDP found, starting with empty form');
      }
    } catch (error) {
      console.error('Error loading CBYDP:', error);
    }
  };

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

  const handleChange = async (field: keyof CBYDPForm, value: string | boolean) => {
    const updatedForm = { ...form, [field]: value };
    setForm(updatedForm);
    
    // Auto-save if CBYDP already exists (with debouncing)
    if (existingCBYDPId) {
      // Clear any existing timeout
      if ((window as any).basicInfoTimeout) {
        clearTimeout((window as any).basicInfoTimeout);
      }
      
      // Set a new timeout for auto-save
      (window as any).basicInfoTimeout = setTimeout(async () => {
        try {
          const cbydpData = {
            ...updatedForm,
            lastEditedBy: user?.name,
            lastEditedAt: new Date(),
            updatedAt: new Date()
          };
          await updateCBYDP(existingCBYDPId, cbydpData);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        } catch (error) {
          console.error('Error auto-saving basic info changes:', error);
          setError('Failed to auto-save. Please click Save CBYDP manually.');
        }
      }, 2000); // Wait 2 seconds after user stops typing
    }
  };

  const handleCenterChange = async (idx: number, field: keyof CBYDCenter, value: string) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === idx ? { ...center, [field]: value } : center
      ),
    };
    setForm(updatedForm);
    
    // Auto-save if CBYDP already exists (with debouncing)
    if (existingCBYDPId) {
      // Clear any existing timeout
      if ((window as any).centerChangeTimeout) {
        clearTimeout((window as any).centerChangeTimeout);
      }
      
      // Set a new timeout for auto-save
      (window as any).centerChangeTimeout = setTimeout(async () => {
        try {
          const cbydpData = {
            ...updatedForm,
            lastEditedBy: user?.name,
            lastEditedAt: new Date(),
            updatedAt: new Date()
          };
          await updateCBYDP(existingCBYDPId, cbydpData);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        } catch (error) {
          console.error('Error auto-saving center changes:', error);
          setError('Failed to auto-save. Please click Save CBYDP manually.');
        }
      }, 2000); // Wait 2 seconds after user stops typing
    }
  };

  const handleProjectChange = async (centerIdx: number, projectIdx: number, field: keyof CBYDPRow, value: string) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) =>
                j === projectIdx ? { ...project, [field]: value } : project
              ),
            }
          : center
      ),
    };
    setForm(updatedForm);
    
    // Auto-save if CBYDP already exists (with debouncing)
    if (existingCBYDPId) {
      // Clear any existing timeout
      if ((window as any).projectChangeTimeout) {
        clearTimeout((window as any).projectChangeTimeout);
      }
      
      // Set a new timeout for auto-save
      (window as any).projectChangeTimeout = setTimeout(async () => {
        try {
          const cbydpData = {
            ...updatedForm,
            lastEditedBy: user?.name,
            lastEditedAt: new Date(),
            updatedAt: new Date()
          };
          await updateCBYDP(existingCBYDPId, cbydpData);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        } catch (error) {
          console.error('Error auto-saving project changes:', error);
          setError('Failed to auto-save. Please click Save CBYDP manually.');
        }
      }, 2000); // Wait 2 seconds after user stops typing
    }
  };

  const addCenter = async () => {
    const updatedForm = {
      ...form,
      centers: [...form.centers, { ...defaultCenter }],
    };
    setForm(updatedForm);
    
    // Auto-save if CBYDP already exists
    if (existingCBYDPId) {
      try {
        const cbydpData = {
          ...updatedForm,
          lastEditedBy: user?.name,
          lastEditedAt: new Date(),
          updatedAt: new Date()
        };
        await updateCBYDP(existingCBYDPId, cbydpData);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (error) {
        console.error('Error auto-saving after adding center:', error);
        setError('Failed to auto-save. Please click Save CBYDP manually.');
      }
    }
  };

  const removeCenter = async (idx: number) => {
    if (form.centers.length > 1) {
      const updatedForm = {
        ...form,
        centers: form.centers.filter((_, i) => i !== idx),
      };
      setForm(updatedForm);
      
      // Auto-save if CBYDP already exists
      if (existingCBYDPId) {
        try {
          const cbydpData = {
            ...updatedForm,
            lastEditedBy: user?.name,
            lastEditedAt: new Date(),
            updatedAt: new Date()
          };
          await updateCBYDP(existingCBYDPId, cbydpData);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        } catch (error) {
          console.error('Error auto-saving after removing center:', error);
          setError('Failed to auto-save. Please click Save CBYDP manually.');
        }
      }
    }
  };

  const addProject = async (centerIdx: number) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? { ...center, projects: [...center.projects, { ...defaultRow }] }
          : center
      ),
    };
    setForm(updatedForm);
    
    // Auto-save if CBYDP already exists
    if (existingCBYDPId) {
      try {
        const cbydpData = {
          ...updatedForm,
          lastEditedBy: user?.name,
          lastEditedAt: new Date(),
          updatedAt: new Date()
        };
        await updateCBYDP(existingCBYDPId, cbydpData);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (error) {
        console.error('Error auto-saving after adding project:', error);
        setError('Failed to auto-save. Please click Save CBYDP manually.');
      }
    }
  };

  const removeProject = async (centerIdx: number, projectIdx: number) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.filter((_, j) => j !== projectIdx),
            }
          : center
      ),
    };
    setForm(updatedForm);
    
    // Auto-save if CBYDP already exists
    if (existingCBYDPId) {
      try {
        const cbydpData = {
          ...updatedForm,
          lastEditedBy: user?.name,
          lastEditedAt: new Date(),
          updatedAt: new Date()
        };
        await updateCBYDP(existingCBYDPId, cbydpData);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (error) {
        console.error('Error auto-saving after removing project:', error);
        setError('Failed to auto-save. Please click Save CBYDP manually.');
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const cbydpData = {
        ...form,
        lastEditedBy: user?.name,
        lastEditedAt: new Date(),
        updatedAt: new Date()
      };

      console.log('Saving CBYDP data:', cbydpData);
      console.log('Existing CBYDP ID:', existingCBYDPId);

      if (existingCBYDPId) {
        console.log('Updating existing CBYDP with ID:', existingCBYDPId);
        await updateCBYDP(existingCBYDPId, cbydpData);
        console.log('CBYDP updated successfully');
      } else {
        console.log('Creating new CBYDP');
        const newId = await createCBYDP(cbydpData);
        console.log('New CBYDP created with ID:', newId);
        setExistingCBYDPId(newId);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving CBYDP:', error);
      setError('Failed to save CBYDP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setSaving(true);
    setError('');

    try {
      const cbydpData = {
        ...form,
        status: 'pending_approval',
        lastEditedBy: user?.name,
        lastEditedAt: new Date(),
        updatedAt: new Date()
      };

      await updateCBYDP(existingCBYDPId!, cbydpData);
      setForm(prev => ({ ...prev, status: 'pending_approval' }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error submitting for approval:', error);
      setError('Failed to submit for approval. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    setError('');

    try {
      const cbydpData = {
        ...form,
        status: 'approved',
        approvedBy: user?.name,
        approvedAt: new Date(),
        updatedAt: new Date()
      };

      await updateCBYDP(existingCBYDPId!, cbydpData);
      setForm(prev => ({ ...prev, status: 'approved' }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error approving CBYDP:', error);
      setError('Failed to approve CBYDP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (reason: string) => {
    setSaving(true);
    setError('');

    try {
      const cbydpData = {
        ...form,
        status: 'rejected',
        rejectionReason: reason,
        approvedBy: user?.name,
        approvedAt: new Date(),
        updatedAt: new Date()
      };

      await updateCBYDP(existingCBYDPId!, cbydpData);
      setForm(prev => ({ ...prev, status: 'rejected', rejectionReason: reason }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error rejecting CBYDP:', error);
      setError('Failed to reject CBYDP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (printRef.current) {
      window.print();
    }
  };

  const handleRefresh = async () => {
    console.log('Manual refresh requested');
    await loadExistingCBYDP();
    await loadSKMembers();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">CBYDP Creation</h1>
        <p className="text-gray-600">Create Comprehensive Barangay Youth Development Plan</p>
      </div>

             {/* Status Messages */}
       {saved && (
         <div className="mb-6 p-4 bg-success-50 border border-success-200 text-success-700 rounded-lg flex items-center">
           <CheckCircle className="h-5 w-5 mr-2" />
           CBYDP saved successfully!
         </div>
       )}

       {error && (
         <div className="mb-6 p-4 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg flex items-center">
           <AlertCircle className="h-5 w-5 mr-2" />
           {error}
         </div>
       )}

       {/* CBYDP Status */}
       {existingCBYDPId && (
         <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
           <div className="flex justify-between items-center">
             <div>
               <h3 className="font-semibold text-blue-900">CBYDP Status</h3>
               <div className="flex items-center space-x-4 mt-2">
                 <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                   form.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                   form.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                   form.status === 'approved' ? 'bg-green-100 text-green-800' :
                   'bg-red-100 text-red-800'
                 }`}>
                   {form.status === 'draft' ? 'Draft' :
                    form.status === 'pending_approval' ? 'Pending Approval' :
                    form.status === 'approved' ? 'Approved' : 'Rejected'}
                 </span>
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
           {/* Save Button - Available to all members */}
           <button
             onClick={handleSave}
             disabled={saving || form.status === 'approved'}
             className="btn-primary flex items-center"
           >
             {saving ? (
               <>
                 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                 Saving...
               </>
             ) : (
               <>
                 <Save className="h-4 w-4 mr-2" />
                 Save CBYDP
               </>
             )}
           </button>

           {/* Submit for Approval - Available to all members except chairperson */}
           {user?.role !== 'chairperson' && form.status === 'draft' && existingCBYDPId && (
             <button
               onClick={handleSubmitForApproval}
               disabled={saving}
               className="btn-secondary flex items-center"
             >
               {saving ? (
                 <>
                   <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                   Submitting...
                 </>
               ) : (
                 <>
                   <FileText className="h-4 w-4 mr-2" />
                   Submit for Approval
                 </>
               )}
             </button>
           )}

           {/* Approval Actions - Only for Chairperson */}
           {user?.role === 'chairperson' && form.status === 'pending_approval' && (
             <>
               <button
                 onClick={handleApprove}
                 disabled={saving}
                 className="btn-primary flex items-center bg-green-600 hover:bg-green-700"
               >
                 {saving ? (
                   <>
                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                     Approving...
                   </>
                 ) : (
                   <>
                     <CheckCircle className="h-4 w-4 mr-2" />
                     Approve
                   </>
                 )}
               </button>
               <button
                 onClick={() => {
                   const reason = prompt('Please provide a reason for rejection:');
                   if (reason) {
                     handleReject(reason);
                   }
                 }}
                 disabled={saving}
                 className="btn-danger flex items-center"
               >
                 {saving ? (
                   <>
                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                     Rejecting...
                   </>
                 ) : (
                   <>
                     <AlertCircle className="h-4 w-4 mr-2" />
                     Reject
                   </>
                 )}
               </button>
             </>
           )}

                       {/* Preview Button - Available to all */}
            <button
              onClick={() => setPreview(!preview)}
              className="btn-secondary flex items-center"
            >
              <Eye className="h-4 w-4 mr-2" />
              {preview ? 'Edit Mode' : 'Preview'}
            </button>

            {/* Refresh Button - Available to all */}
            <button
              onClick={handleRefresh}
              disabled={saving}
              className="btn-secondary flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
         </div>

         <div className="flex items-center space-x-4">
           <label className="flex items-center space-x-2">
             <input
               type="checkbox"
               checked={form.showLogoInPrint}
               onChange={(e) => handleChange('showLogoInPrint', e.target.checked)}
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
              <button
                onClick={handlePrint}
                className="btn-primary flex items-center"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </button>
            </div>
            <div ref={printRef} className="print-content">
              {/* Header */}
              <div className="text-center mb-8">
                {form.showLogoInPrint && skProfile?.logo && (
                  <img 
                    src={skProfile.logo} 
                    alt="Barangay Logo" 
                    className="h-16 w-16 mx-auto mb-4"
                  />
                )}
                <h1 className="text-2xl font-bold mb-2">COMPREHENSIVE BARANGAY YOUTH DEVELOPMENT PLAN</h1>
                <p className="text-lg font-semibold mb-1">{form.barangay}, {form.city}, {form.province}</p>
                <p className="text-lg">Year {new Date().getFullYear()}</p>
              </div>

              {/* Centers of Participation */}
              {form.centers.map((center, centerIdx) => (
                <div key={centerIdx} className="mb-8">
                  <div className="text-left mb-4">
                    <h2 className="text-xl font-bold mb-2">Center of Participation: {center.name}</h2>
                    <p className="text-left"><strong>Agenda Statement:</strong> {center.agenda}</p>
                  </div>
                  
                  <table className="w-full border-collapse border border-gray-300 mb-6">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Concern</th>
                        <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Objective</th>
                        <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Indicator</th>
                        <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Target 1</th>
                        <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Target 2</th>
                        <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Target 3</th>
                        <th className="border border-gray-300 p-2 text-left text-sm font-semibold">PPAs</th>
                        <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Budget</th>
                        <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Responsible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {center.projects.map((project, projectIdx) => (
                        <tr key={projectIdx}>
                          <td className="border border-gray-300 p-2 text-sm">{project.concern}</td>
                          <td className="border border-gray-300 p-2 text-sm">{project.objective}</td>
                          <td className="border border-gray-300 p-2 text-sm">{project.indicator}</td>
                          <td className="border border-gray-300 p-2 text-sm">{project.target1}</td>
                          <td className="border border-gray-300 p-2 text-sm">{project.target2}</td>
                          <td className="border border-gray-300 p-2 text-sm">{project.target3}</td>
                          <td className="border border-gray-300 p-2 text-sm">{project.ppas}</td>
                          <td className="border border-gray-300 p-2 text-sm">{project.budget}</td>
                          <td className="border border-gray-300 p-2 text-sm">{project.responsible}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Prepared By Section - Last Page */}
              <div className="page-break-before">
                <div className="mt-8">
                  <p className="text-left mb-4"><strong>Prepared by:</strong></p>
                  
                  {/* SK Members */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {form.skMembers.map((member, idx) => (
                      <div key={idx} className="text-center">
                        <div className="border-b-2 border-gray-400 pb-1 mb-2">
                          <p className="font-semibold text-sm">{member.name}</p>
                        </div>
                        <p className="text-xs text-gray-600">{member.position}</p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Federation President */}
                  <div className="text-center mt-8">
                    <div className="border-b-2 border-gray-400 pb-1 mb-2 inline-block">
                      <p className="font-semibold text-sm">{form.federationPresident}</p>
                    </div>
                    <p className="text-xs text-gray-600">SK Federation President</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
             ) : (
         <div className="space-y-6">
           {/* Edit Restriction Notice */}
           {form.status === 'approved' && (
             <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
               <CheckCircle className="h-5 w-5 mr-2" />
               This CBYDP has been approved and is now read-only. Contact the chairperson if changes are needed.
             </div>
           )}

           {form.status === 'rejected' && (
             <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
               <AlertCircle className="h-5 w-5 mr-2" />
               This CBYDP was rejected. Reason: {form.rejectionReason}. Please make necessary changes and resubmit.
             </div>
           )}

           {/* Basic Information */}
           <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Region</label>
                                     <input
                     type="text"
                     value={form.region}
                     onChange={(e) => handleChange('region', e.target.value)}
                     className="input-field"
                     required
                     disabled={form.status === 'approved'}
                   />
                </div>
                                 <div>
                   <label className="form-label">Province</label>
                   <input
                     type="text"
                     value={form.province}
                     onChange={(e) => handleChange('province', e.target.value)}
                     className="input-field"
                     required
                     disabled={form.status === 'approved'}
                   />
                 </div>
                 <div>
                   <label className="form-label">City/Municipality</label>
                   <input
                     type="text"
                     value={form.city}
                     onChange={(e) => handleChange('city', e.target.value)}
                     className="input-field"
                     required
                     disabled={form.status === 'approved'}
                   />
                 </div>
                 <div>
                   <label className="form-label">Barangay</label>
                   <input
                     type="text"
                     value={form.barangay}
                     onChange={(e) => handleChange('barangay', e.target.value)}
                     className="input-field"
                     required
                     disabled={form.status === 'approved'}
                   />
                 </div>
                 <div>
                   <label className="form-label">SK Federation President</label>
                   <input
                     type="text"
                     value={form.federationPresident}
                     onChange={(e) => handleChange('federationPresident', e.target.value)}
                     className="input-field"
                     required
                     disabled={form.status === 'approved'}
                   />
                 </div>
              </div>
            </div>
          </div>

          {/* Centers of Participation */}
          <div className="space-y-4">
            {form.centers.map((center, centerIdx) => (
              <div key={centerIdx} className="card">
                <div className="card-header">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Center of Participation {centerIdx + 1}
                    </h3>
                    {form.centers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCenter(centerIdx)}
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
                        onChange={(e) => handleCenterChange(centerIdx, 'name', e.target.value)}
                        className="input-field"
                        placeholder="e.g., Health, Sports, Education"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Agenda Statement</label>
                      <textarea
                        value={center.agenda}
                        onChange={(e) => handleCenterChange(centerIdx, 'agenda', e.target.value)}
                        className="input-field"
                        rows={3}
                        placeholder="Describe the agenda for this center"
                        required
                      />
                    </div>
                  </div>

                  {/* Projects Table */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-gray-900">Projects</h4>
                      <button
                        type="button"
                        onClick={() => addProject(centerIdx)}
                        className="btn-secondary flex items-center"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Project
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 p-2 text-left text-sm">Concern</th>
                            <th className="border border-gray-300 p-2 text-left text-sm">Objective</th>
                            <th className="border border-gray-300 p-2 text-left text-sm">Indicator</th>
                            <th className="border border-gray-300 p-2 text-left text-sm">Target 1</th>
                            <th className="border border-gray-300 p-2 text-left text-sm">Target 2</th>
                            <th className="border border-gray-300 p-2 text-left text-sm">Target 3</th>
                            <th className="border border-gray-300 p-2 text-left text-sm">PPAs</th>
                            <th className="border border-gray-300 p-2 text-left text-sm">Budget</th>
                            <th className="border border-gray-300 p-2 text-left text-sm">Responsible</th>
                            <th className="border border-gray-300 p-2 text-left text-sm">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {center.projects.map((project, projectIdx) => (
                            <tr key={projectIdx}>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.concern}
                                  onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'concern', e.target.value)}
                                  className="w-full border-none focus:ring-0 text-sm"
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.objective}
                                  onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'objective', e.target.value)}
                                  className="w-full border-none focus:ring-0 text-sm"
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.indicator}
                                  onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'indicator', e.target.value)}
                                  className="w-full border-none focus:ring-0 text-sm"
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.target1}
                                  onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'target1', e.target.value)}
                                  className="w-full border-none focus:ring-0 text-sm"
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.target2}
                                  onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'target2', e.target.value)}
                                  className="w-full border-none focus:ring-0 text-sm"
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.target3}
                                  onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'target3', e.target.value)}
                                  className="w-full border-none focus:ring-0 text-sm"
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.ppas}
                                  onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'ppas', e.target.value)}
                                  className="w-full border-none focus:ring-0 text-sm"
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.budget}
                                  onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'budget', e.target.value)}
                                  className="w-full border-none focus:ring-0 text-sm"
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={project.responsible}
                                  onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'responsible', e.target.value)}
                                  className="w-full border-none focus:ring-0 text-sm"
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                {center.projects.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeProject(centerIdx, projectIdx)}
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

            <button
              type="button"
              onClick={addCenter}
              className="btn-secondary flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Center of Participation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CBYDP; 