import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Layers, ReceiptText, Wallet } from 'lucide-react';
import Budget from './Budget';
import { useAuth } from '../contexts/AuthContext';
import { saveRCBData, loadRCBData, deleteAllRCBData } from '../services/firebaseService';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { logActivity } from '../services/activityService';
import { exportDocxFromTemplate, mapRCBToTemplate } from '../services/docxExport';
import googleDriveService from '../services/googleDriveService';

type SKProfile = {
  barangay?: string;
  city?: string;
  province?: string;
  logo?: string;
};

type SKMember = {
  id: string;
  name: string;
  role: string;
};

type TabKey = 'budget' | 'rcb' | 'pr';

const Financial: React.FC = () => {
  const { user, skProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('rcb');
  // Calculate current term year based on SK profile
  const getCurrentTermYear = useCallback(() => {
    if (!skProfile || !skProfile.skTermStart) {
      return new Date().getFullYear().toString(); // Fallback to current calendar year
    }
    
    const currentYear = new Date().getFullYear();
    const termStart = skProfile.skTermStart;
    const termEnd = skProfile.skTermEnd || (termStart + 2); // Default 3-year term
    
    // If current year is within term, use current year
    if (currentYear >= termStart && currentYear <= termEnd) {
      return currentYear.toString();
    }
    
    // Otherwise, use the term start year
    return termStart.toString();
  }, [skProfile]);

  const [financialYear, setFinancialYear] = useState<string>('');
  const [quarter, setQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [skMembers, setSkMembers] = useState<SKMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [balanceCarried, setBalanceCarried] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // RCB settings per year/quarter for dynamic columns
  type RCBSettings = {
    mooeAccounts: string[];
    coAccounts: string[];
    withholdingTypes: string[]; // up to 2 entries
  };
  const [rcbSettingsByYQ, setRcbSettingsByYQ] = useState<Record<string, RCBSettings>>({});

  // RCB metadata per year/quarter
  type RCBMetadata = {
    fund: string;
    sheetNo: string;
    balanceBroughtForward: number;
  };
  const [rcbMetadataByYQ, setRcbMetadataByYQ] = useState<Record<string, RCBMetadata>>({});

  // Quarter month mapping
  const quarterMonths = {
    'Q1': 'January - March',
    'Q2': 'April - June', 
    'Q3': 'July - September',
    'Q4': 'October - December'
  };

  // Year-Quarter key and settings (define early for draft defaults)
  const yqKey = `${financialYear}-${quarter}`;
  
  const rcbSettings: RCBSettings = useMemo(() => {
    if (!rcbSettingsByYQ[yqKey]) {
      const defaults: RCBSettings = {
        mooeAccounts: ['Travelling Expenses', 'Maintenance/Other Operating'],
        coAccounts: ['Office Equipment'],
        withholdingTypes: ['Type 1', 'Type 2']
      };
      setRcbSettingsByYQ(prev => ({ ...prev, [yqKey]: defaults }));
      return defaults;
    }
    return rcbSettingsByYQ[yqKey];
  }, [yqKey, rcbSettingsByYQ]);

  const rcbMetadata: RCBMetadata = useMemo(() => {
    if (!rcbMetadataByYQ[yqKey]) {
      const defaults: RCBMetadata = {
        fund: 'SK Fund',
        sheetNo: '1',
        balanceBroughtForward: 0
      };
      setRcbMetadataByYQ(prev => ({ ...prev, [yqKey]: defaults }));
      return defaults;
    }
    return rcbMetadataByYQ[yqKey];
  }, [yqKey, rcbMetadataByYQ]);

  // RCB entries per year-quarter
  type RCBEntry = {
    date: string;
    reference: string;
    payee: string;
    particulars: string;
    deposit: number;
    withdrawal: number;
    balance: number; // computed client-side for now
    mooe: Record<string, number>;
    co: Record<string, number>;
    advOfficials: number;
    advTreasurer: number;
    others: number;
    withholding: Record<string, number>;
  };
  const [rcbEntriesByYQ, setRcbEntriesByYQ] = useState<Record<string, RCBEntry[]>>({});
  const [showRcbPreview, setShowRcbPreview] = useState<boolean>(false);
  const [showRcbInstructions, setShowRcbInstructions] = useState<boolean>(false);
  const [isEditingPeriodClosedByYQ, setIsEditingPeriodClosedByYQ] = useState<Record<string, boolean>>({});
  const [showPdfUpload, setShowPdfUpload] = useState<boolean>(false);
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState<boolean>(false);
  const [signedPdfUrlsByYQ, setSignedPdfUrlsByYQ] = useState<Record<string, string>>({});

  // Set initial financial year when SK profile is loaded
  useEffect(() => {
    if (skProfile && !financialYear) {
      const termYear = getCurrentTermYear();
      setFinancialYear(termYear);
    }
  }, [skProfile, financialYear, getCurrentTermYear]);

  // Get available years based on SK term
  const getAvailableYears = useCallback(() => {
    if (!skProfile || !skProfile.skTermStart) {
      // Fallback: show current year and 3 years before/after
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 7 }, (_, i) => String(currentYear - 3 + i));
    }
    
    const termStart = skProfile.skTermStart;
    const termEnd = skProfile.skTermEnd || (termStart + 2); // Default 3-year term
    
    // Return years from term start to term end
    const years = [];
    for (let year = termStart; year <= termEnd; year++) {
      years.push(year.toString());
    }
    
    return years;
  }, [skProfile]);

  // Helper to get editing period status for current YQ
  const isEditingPeriodClosed = useMemo(() => {
    return isEditingPeriodClosedByYQ[yqKey] || false;
  }, [isEditingPeriodClosedByYQ, yqKey]);

  // Helper to get signed PDF URL for current YQ
  const signedPdfUrl = useMemo(() => {
    return signedPdfUrlsByYQ[yqKey] || null;
  }, [signedPdfUrlsByYQ, yqKey]);

  // Draft entry inputs
  const emptyDraft = (): RCBEntry => ({
    date: new Date().toISOString().slice(0,10),
    reference: '',
    payee: '',
    particulars: '',
    deposit: 0,
    withdrawal: 0,
    balance: 0,
    mooe: Object.fromEntries(rcbSettings.mooeAccounts.map(n => [n, 0])),
    co: Object.fromEntries(rcbSettings.coAccounts.map(n => [n, 0])),
    advOfficials: 0,
    advTreasurer: 0,
    others: 0,
    withholding: Object.fromEntries((rcbSettings.withholdingTypes.length? rcbSettings.withholdingTypes:['Withholding']).map(n => [n, 0])),
  });
  const [draft, setDraft] = useState<RCBEntry>(emptyDraft());
  
  // Reset draft when settings change
  const settingsKey = JSON.stringify(rcbSettings);
  React.useEffect(() => { setDraft(emptyDraft()); }, [settingsKey]);
  
  const toNumber = (v: string) => {
    const n = parseFloat(v.replace(/,/g,''));
    return isNaN(n)? 0 : n;
  };
  
  const entries = useMemo(() => rcbEntriesByYQ[yqKey] || [], [rcbEntriesByYQ, yqKey]);

  const addEntry = async () => {
    if (!draft.date || !draft.reference || !draft.payee) {
      alert('Please fill in date, reference, and payee');
      return;
    }
    
    const newEntries = [...entries, { ...draft }];
    // recompute running balance: start from previous balance, then +deposit -withdrawal
    let run = rcbMetadata.balanceBroughtForward;
    newEntries.forEach((e, idx) => {
      run = (idx === 0 ? rcbMetadata.balanceBroughtForward : newEntries[idx-1].balance) + (e.deposit||0) - (e.withdrawal||0);
      e.balance = run;
    });
    setRcbEntriesByYQ(prev => ({ ...prev, [yqKey]: newEntries }));
    setDraft(emptyDraft());
    setHasChanges(true); // Mark that changes have been made
    
    // Log activity
    try {
      await logActivity({
        type: 'budget',
        title: 'RCB Entry Added',
        description: `Added RCB entry: ${draft.payee} - ${draft.particulars}`,
        member: {
          name: user?.name || 'Unknown',
          role: user?.role || 'user',
          id: user?.uid || ''
        },
        status: 'completed',
        module: 'Financial',
        details: {
          year: financialYear,
          quarter: quarter,
          entry: draft
        }
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };
  
  const totals = useMemo(() => {
    const sum = (arr: number[]) => arr.reduce((a,b)=>a+b,0);
    return {
      deposit: sum(entries.map(e=>e.deposit||0)),
      withdrawal: sum(entries.map(e=>e.withdrawal||0)),
      balance: entries.length ? entries[entries.length-1].balance : rcbMetadata.balanceBroughtForward,
      mooe: Object.fromEntries(rcbSettings.mooeAccounts.map(n => [n, sum(entries.map(e=>e.mooe[n]||0))])),
      co: Object.fromEntries(rcbSettings.coAccounts.map(n => [n, sum(entries.map(e=>e.co[n]||0))])),
      advOfficials: sum(entries.map(e=>e.advOfficials||0)),
      advTreasurer: sum(entries.map(e=>e.advTreasurer||0)),
      others: sum(entries.map(e=>e.others||0)),
      withholding: Object.fromEntries((rcbSettings.withholdingTypes.length? rcbSettings.withholdingTypes:['Withholding']).map(n => [n, sum(entries.map(e=>e.withholding[n]||0))])),
    };
  }, [entries, rcbSettings, rcbMetadata]);

  // (removed duplicate yqKey/rcbSettings)

  const updateRcbSettings = (updater: (s: RCBSettings) => RCBSettings) => {
    setRcbSettingsByYQ(prev => ({ ...prev, [yqKey]: updater(rcbSettings) }));
    setHasChanges(true); // Mark that changes have been made
  };

  const updateRcbMetadata = (updater: (m: RCBMetadata) => RCBMetadata) => {
    setRcbMetadataByYQ(prev => ({ ...prev, [yqKey]: updater(rcbMetadata) }));
    setHasChanges(true); // Mark that changes have been made
  };

  const resetRCB = async () => {
    if (window.confirm('Are you sure you want to reset all RCB data for this quarter? This action cannot be undone.')) {
      setRcbEntriesByYQ(prev => ({ ...prev, [yqKey]: [] }));
      setDraft(emptyDraft());
      setHasChanges(true); // Mark that changes have been made
      
      // Log reset activity
      try {
        await logActivity({
          type: 'budget',
          title: 'RCB Reset',
          description: `RCB reset for ${quarter} ${financialYear}`,
          member: {
            name: user?.name || 'Unknown',
            role: user?.role || 'user',
            id: user?.uid || ''
          },
          status: 'completed',
          module: 'Financial',
          details: {
            year: financialYear,
            quarter: quarter
          }
        });
      } catch (error) {
        console.error('Error logging reset activity:', error);
      }
    }
  };


  // Refresh RCB data
  const refreshRCB = async () => {
    try {
      setLoading(true);
      const rcbData = await loadRCBData(yqKey);
      
      // Reload existing RCB data if available
      if (rcbData.settings && Object.keys(rcbData.settings).length > 0) {
        setRcbSettingsByYQ(prev => ({ ...prev, [yqKey]: rcbData.settings }));
        setRcbMetadataByYQ(prev => ({ ...prev, [yqKey]: rcbData.metadata }));
        setRcbEntriesByYQ(prev => ({ ...prev, [yqKey]: rcbData.entries }));
        setIsEditingPeriodClosedByYQ(prev => ({ ...prev, [yqKey]: rcbData.isEditingPeriodClosed || false }));
        setSignedPdfUrlsByYQ(prev => ({ ...prev, [yqKey]: rcbData.signedPdfUrl || '' }));
      }
      
      setSaved(false);
      setHasChanges(false);
    } catch (error) {
      console.error('Error refreshing RCB data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset all RCB data across all years and quarters
  const resetAllRCB = async () => {
    const confirmMessage = `⚠️ WARNING: This will permanently delete ALL RCB data across ALL years and quarters!\n\nThis includes:\n• All transaction entries\n• All settings and metadata\n• All editing period statuses\n\nThis action CANNOT be undone. Are you absolutely sure you want to proceed?`;
    
    if (window.confirm(confirmMessage)) {
      try {
        // Delete all RCB data from Firebase
        await deleteAllRCBData();
        
        // Reset all state
        setRcbEntriesByYQ({});
        setRcbSettingsByYQ({});
        setRcbMetadataByYQ({});
        setIsEditingPeriodClosedByYQ({});
        setSignedPdfUrlsByYQ({});
        setDraft(emptyDraft());
        setHasChanges(false); // No changes to save since we deleted everything
        
        // Log reset all activity
        await logActivity({
          type: 'budget',
          title: 'RCB Reset All',
          description: 'All RCB data across all years and quarters has been reset',
          member: {
            name: user?.name || 'Unknown',
            role: user?.role || 'user',
            id: user?.uid || ''
          },
          status: 'completed',
          module: 'Financial',
          details: {
            action: 'reset_all_rcb',
            affectedData: 'all_years_quarters'
          }
        });
        
        alert('All RCB data has been permanently deleted and reset successfully.');
      } catch (error) {
        console.error('Error during reset all RCB:', error);
        alert('There was an error resetting all RCB data. Please try again.');
      }
    }
  };

  // Calculate ending balance for current quarter
  const getEndingBalance = () => {
    if (entries.length === 0) {
      // If no entries, return the brought forward balance
      return rcbMetadata.balanceBroughtForward || 0;
    }
    const lastEntry = entries[entries.length - 1];
    return lastEntry.balance || 0;
  };

  // Save RCB to Firebase
  const handleSaveRCB = async () => {
    try {
      setSaving(true);
      await saveRCBData(yqKey, { 
        settings: rcbSettings, 
        metadata: rcbMetadata, 
        entries: entries,
        isEditingPeriodClosed: isEditingPeriodClosed,
        signedPdfUrl: signedPdfUrl || null
      });
      
      // Log save activity
      await logActivity({
        type: 'budget',
        title: 'RCB Saved',
        description: `Saved RCB data for ${quarter} ${financialYear}`,
        member: {
          name: user?.name || 'Unknown',
          role: user?.role || 'user',
          id: user?.uid || ''
        },
        status: 'completed',
        module: 'Financial',
        details: {
          year: financialYear,
          quarter: quarter,
          action: 'save'
        }
      });
      
      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving RCB:', error);
      alert('Error saving RCB. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Export RCB to Word
  const handleExportRCB = async () => {
    try {
      console.log('=== STARTING RCB EXPORT ===');
      
      // Follow the same pattern as Budget component
      const exportData = {
        form: {
          quarter,
          financialYear,
          settings: rcbSettings,
          metadata: rcbMetadata,
          entries: entries
        },
        skProfile: skProfile,
        skMembers: skMembers
      };

      console.log('RCB Export Data:', exportData);
      const mappedData = mapRCBToTemplate(exportData);
      console.log('Mapped RCB data:', mappedData);
      
      await exportDocxFromTemplate({
        templatePath: '/templates/rcb_template.docx',
        data: mappedData,
        outputFileName: `RCB_${quarter}_${financialYear}.docx`
      });

      // Log export activity
      await logActivity({
        type: 'budget',
        title: 'RCB Exported',
        description: `Exported RCB for ${quarter} ${financialYear}`,
        member: {
          name: user?.name || 'Unknown',
          role: user?.role || 'user',
          id: user?.uid || ''
        },
        status: 'completed',
        module: 'Financial',
        details: {
          year: financialYear,
          quarter: quarter,
          exportType: 'RCB'
        }
      });

    } catch (error) {
      console.error('Error exporting RCB:', error);
      alert('Error exporting RCB. Please try again.');
    }
  };

  // Auto-carry balance to next quarter
  const carryBalanceToNextQuarter = () => {
    const endingBalance = getEndingBalance();
    const nextQuarter = quarter === 'Q1' ? 'Q2' : quarter === 'Q2' ? 'Q3' : quarter === 'Q3' ? 'Q4' : 'Q1';
    const nextYear = quarter === 'Q4' ? (parseInt(financialYear) + 1).toString() : financialYear;
    const nextYQKey = `${nextYear}-${nextQuarter}`;
    
    // Update next quarter's balance brought forward (don't mark as changes since it's automatic)
    setRcbMetadataByYQ(prev => ({
      ...prev,
      [nextYQKey]: {
        ...prev[nextYQKey],
        fund: prev[nextYQKey]?.fund || 'SK Fund',
        sheetNo: prev[nextYQKey]?.sheetNo || '1',
        balanceBroughtForward: endingBalance
      }
    }));

    // Show notification
    setBalanceCarried(true);
    setTimeout(() => setBalanceCarried(false), 3000);
  };

  // Auto-carry balance when quarter changes
  useEffect(() => {
    // Always carry balance, even if no entries (carry the brought forward balance)
    carryBalanceToNextQuarter();
  }, [quarter, financialYear]);

  // Close editing period function
  const closeEditingPeriod = async () => {
    if (window.confirm(`Are you sure you want to close the editing period for ${quarter} ${financialYear}? This will make forms read-only for this quarter only.`)) {
      setIsEditingPeriodClosedByYQ(prev => ({ ...prev, [yqKey]: true }));
      setHasChanges(true); // Mark that changes have been made
      setShowPdfUpload(true);
      
      // Log activity
      try {
        await logActivity({
          type: 'budget',
          title: 'RCB Editing Period Closed',
          description: `RCB editing period closed for ${quarter} ${financialYear}`,
          member: {
            name: user?.name || 'Unknown',
            role: user?.role || 'user',
            id: user?.uid || ''
          },
          status: 'completed',
          module: 'Financial',
          details: {
            year: financialYear,
            quarter: quarter
          }
        });
      } catch (error) {
        console.error('Error logging close editing period activity:', error);
      }
    }
  };

  // Handle PDF upload
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setUploadedPdf(file);
    } else {
      alert('Please select a PDF file.');
    }
  };

  // Submit signed RCB
  const submitSignedRcb = async () => {
    if (!uploadedPdf) {
      alert('Please upload the signed RCB PDF first.');
      return;
    }

    try {
      setUploadingPdf(true);
      console.log('Uploading signed RCB PDF to Google Drive:', uploadedPdf.name);
      
      // Upload PDF to Google Drive
      const driveFile = await googleDriveService.uploadFile(uploadedPdf, 'SK Management System - RCB Documents');
      
      if (driveFile && driveFile.webViewLink) {
        // Save the PDF URL to state and Firebase
        setSignedPdfUrlsByYQ(prev => ({ ...prev, [yqKey]: driveFile.webViewLink }));
        setHasChanges(true); // Mark that changes have been made
        
        // Save to Firebase immediately
        await saveRCBData(yqKey, { 
          settings: rcbSettings, 
          metadata: rcbMetadata, 
          entries: entries,
          isEditingPeriodClosed: isEditingPeriodClosed,
          signedPdfUrl: driveFile.webViewLink
        });
      
      // Log activity
      await logActivity({
        type: 'budget',
        title: 'Signed RCB Submitted',
          description: `Signed RCB PDF uploaded to Google Drive for ${quarter} ${financialYear}`,
        member: {
          name: user?.name || 'Unknown',
          role: user?.role || 'user',
          id: user?.uid || ''
        },
        status: 'completed',
        module: 'Financial',
        details: {
          year: financialYear,
          quarter: quarter,
            fileName: uploadedPdf.name,
            driveFileId: driveFile.fileId,
            pdfUrl: driveFile.webViewLink
        }
      });

      setShowPdfUpload(false);
        setUploadedPdf(null);
        alert('Signed RCB uploaded to Google Drive and saved successfully! You can now proceed to the next quarter.');
      } else {
        throw new Error('Failed to get Google Drive URL for uploaded PDF');
      }
    } catch (error) {
      console.error('Error uploading signed RCB to Google Drive:', error);
      alert('Error uploading signed RCB to Google Drive. Please try again.');
    } finally {
      setUploadingPdf(false);
    }
  };

  // Load SK Members
  const loadSKMembers = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const members: SKMember[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive !== false) {
          members.push({
            id: doc.id,
            name: data.name || '',
            role: data.role || '',
          });
        }
      });
      setSkMembers(members);
    } catch (error) {
      console.error('Error loading SK members:', error);
    }
  }, []);

  // Load SK Profile and Members
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const rcbData = await loadRCBData(yqKey);
        await loadSKMembers();
        
        // Load existing RCB data if available
        if (rcbData.settings && Object.keys(rcbData.settings).length > 0) {
          setRcbSettingsByYQ(prev => ({ ...prev, [yqKey]: rcbData.settings }));
        }
        if (rcbData.metadata && Object.keys(rcbData.metadata).length > 0) {
          setRcbMetadataByYQ(prev => ({ ...prev, [yqKey]: rcbData.metadata }));
        }
        if (rcbData.entries && rcbData.entries.length > 0) {
          setRcbEntriesByYQ(prev => ({ ...prev, [yqKey]: rcbData.entries }));
        }
        if (rcbData.isEditingPeriodClosed !== undefined) {
          setIsEditingPeriodClosedByYQ(prev => ({ ...prev, [yqKey]: rcbData.isEditingPeriodClosed }));
        }
        if (rcbData.signedPdfUrl) {
          setSignedPdfUrlsByYQ(prev => ({ ...prev, [yqKey]: rcbData.signedPdfUrl }));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, loadSKMembers, yqKey]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!user || saving || !hasChanges) return;
    try {
      setSaving(true);
      await saveRCBData(yqKey, { 
        settings: rcbSettings, 
        metadata: rcbMetadata, 
        entries: entries,
        isEditingPeriodClosed: isEditingPeriodClosed,
        signedPdfUrl: signedPdfUrl || null
      });
      
      // No activity logging for auto-save - only for actual user actions
      
      setSaved(true);
      setHasChanges(false); // Reset changes flag after saving
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error auto-saving RCB:', error);
    } finally {
      setSaving(false);
    }
  }, [user, yqKey, rcbSettings, rcbMetadata, entries, saving, quarter, financialYear, hasChanges, isEditingPeriodClosed, signedPdfUrl]);

  // Auto-save when data changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (hasChanges) {
        autoSave();
      }
    }, 5000); // Auto-save after 5 seconds of inactivity, only if there are changes

    return () => clearTimeout(timeoutId);
  }, [hasChanges, autoSave]);
  

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial</h1>
          <p className="text-sm text-gray-500">Unified module for Budget, Register of Cash in Bank (RCB), and Purchase Requests.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('budget')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'budget' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Wallet className="h-4 w-4" /> Budget
          </button>
          <button
            onClick={() => setActiveTab('rcb')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'rcb' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Layers className="h-4 w-4" /> Register of Cash in Bank
          </button>
          <button
            onClick={() => setActiveTab('pr')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'pr' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ReceiptText className="h-4 w-4" /> Purchase Requests
          </button>
        </nav>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'budget' && (
          <div className="space-y-4">
            <Budget />
          </div>
        )}

        {activeTab === 'rcb' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Register of Cash in Bank (RCB)</h2>
                <p className="text-sm text-gray-600">
                  Year {financialYear} • {quarter} ({quarterMonths[quarter]})
                  {skProfile && (
                    <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                      SK Term {skProfile.skTermStart}-{skProfile.skTermEnd || skProfile.skTermStart + 2}
                    </span>
                  )}
                </p>
                
                <div className="flex items-center gap-2">
                  {saving && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </div>
                  )}
                  {saved && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Saved
                    </div>
                  )}
                  {balanceCarried && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                      Balance carried to next quarter
                    </div>
                  )}
                  {hasChanges && !saving && !saved && (
                    <div className="flex items-center gap-1 text-xs text-orange-600">
                      <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                      Unsaved changes
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RCB Status for Selected Year/Quarter - Inside Management */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-md font-semibold text-blue-800">RCB Status</h5>
                
                {/* Year and Quarter Selectors */}
                <div className="flex items-center gap-2">
                <div className="min-w-0 relative">
                  <select
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
                      className="px-3 py-1.5 pr-6 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium appearance-none"
                      title={skProfile ? `SK Term: ${skProfile.skTermStart}-${skProfile.skTermEnd || skProfile.skTermStart + 2}` : 'Year selection'}
                  >
                      {getAvailableYears().map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="min-w-0 relative">
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value as any)}
                      className="px-3 py-1.5 pr-6 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium appearance-none"
                  >
                    {(['Q1','Q2','Q3','Q4'] as const).map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                  <span className="text-sm text-blue-700 font-medium">
                    ({quarterMonths[quarter]})
                  </span>
                </div>
              </div>
              
              {(() => {
                const rcbForYQ = entries.length > 0 ? {
                  year: financialYear,
                  quarter: quarter,
                  status: isEditingPeriodClosed ? 'closed_for_editing' : entries.length > 0 ? 'active' : 'not_initiated',
                  entriesCount: entries.length,
                  totalDeposits: totals.deposit,
                  totalWithdrawals: totals.withdrawal,
                  endingBalance: totals.balance,
                  balanceBroughtForward: rcbMetadata.balanceBroughtForward,
                  lastEntryDate: entries.length > 0 ? entries[entries.length - 1].date : null,
                  fund: rcbMetadata.fund,
                  sheetNo: rcbMetadata.sheetNo
                } : null;

                if (rcbForYQ && (rcbForYQ.status === 'active' || rcbForYQ.status === 'closed_for_editing')) {
                  return (
                    <>
                      {/* Status Badge and Basic Info */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            rcbForYQ.status === 'closed_for_editing' 
                              ? 'bg-orange-100 text-orange-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {rcbForYQ.status === 'closed_for_editing' ? 'Closed for Editing' : 'Active'}
                          </span>
                          {rcbForYQ.lastEntryDate && (
                            <span className="text-sm text-blue-700">
                              Last entry: {rcbForYQ.lastEntryDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detailed Information Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-blue-700">Year:</span>
                          <div className="text-gray-600">{rcbForYQ.year}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Quarter:</span>
                          <div className="text-gray-600">{rcbForYQ.quarter}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Fund:</span>
                          <div className="text-gray-600">{rcbForYQ.fund}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Sheet No:</span>
                          <div className="text-gray-600">{rcbForYQ.sheetNo}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Entries Count:</span>
                          <div className="text-gray-600">{rcbForYQ.entriesCount}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Total Deposits:</span>
                          <div className="text-gray-600">₱{rcbForYQ.totalDeposits.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Total Withdrawals:</span>
                          <div className="text-gray-600">₱{rcbForYQ.totalWithdrawals.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Ending Balance:</span>
                          <div className="text-gray-600 font-semibold text-green-600">₱{rcbForYQ.endingBalance.toLocaleString()}</div>
                        </div>
                      </div>
                    </>
                  );
                } else {
                  return (
                    <>
                      {/* Status Badge and Basic Info */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4">
                          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                            Not Initiated
                          </span>
                        </div>
                      </div>

                      {/* Detailed Information Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-blue-700">Year:</span>
                          <div className="text-gray-600">{financialYear}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Quarter:</span>
                          <div className="text-gray-600">{quarter}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Fund:</span>
                          <div className="text-gray-600">{rcbMetadata.fund}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Sheet No:</span>
                          <div className="text-gray-600">{rcbMetadata.sheetNo}</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Entries Count:</span>
                          <div className="text-gray-600">0</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Total Deposits:</span>
                          <div className="text-gray-600">₱0.00</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Total Withdrawals:</span>
                          <div className="text-gray-600">₱0.00</div>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Balance Brought Forward:</span>
                          <div className="text-gray-600">₱{rcbMetadata.balanceBroughtForward.toLocaleString()}</div>
                        </div>
                      </div>
                    </>
                  );
                }
              })()}
              
              {/* Warning Message */}
              {entries.length === 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-amber-600 mr-2">⚠️</span>
                    <span className="text-sm text-amber-800">
                      RCB for {quarter} {financialYear} has not been initiated yet. Start adding entries to begin tracking cash in bank transactions.
                    </span>
                  </div>
                </div>
              )}

              {/* Success Message for Active RCB */}
              {entries.length > 0 && !isEditingPeriodClosed && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    <span className="text-sm text-green-800">
                      RCB for {quarter} {financialYear} is active with {entries.length} transaction{entries.length !== 1 ? 's' : ''}. 
                      Current balance: ₱{totals.balance.toLocaleString()}
                    </span>
                  </div>
                    </div>
                  )}

              {/* Closed for Editing Message */}
              {entries.length > 0 && isEditingPeriodClosed && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-orange-600 mr-2">🔒</span>
                    <span className="text-sm text-orange-800">
                      RCB for {quarter} {financialYear} is closed for editing. {entries.length} transaction{entries.length !== 1 ? 's' : ''} recorded. 
                      Final balance: ₱{totals.balance.toLocaleString()}
                    </span>
                </div>
              </div>
              )}
            </div>

            {showRcbInstructions ? (
              <div className="card p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">RCB Instructions & Guidelines</h3>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm max-h-96 overflow-y-auto">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-2">REGISTER OF CASH IN BANK AND OTHER RELATED FINANCIAL TRANSACTIONS (RCB)</h4>
                        <p className="text-blue-800 text-xs">The RCB shall be maintained by the SK Treasurer to record daily deposits and withdrawals/payments and monitor the balance of Cash in Bank under his/her accountability.</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-blue-900 mb-2">Basic Information:</h5>
                          <div className="space-y-1 text-blue-800 text-xs">
                            <div><strong>1. SK of Barangay</strong> – name of the Barangay SK</div>
                            <div><strong>2. SK Treasurer</strong> – name of the SK Treasurer</div>
                            <div><strong>3. City/Municipality</strong> – the city/municipality of the barangay</div>
                            <div><strong>4. Province</strong> – the province of the barangay</div>
                            <div><strong>5. Fund</strong> – name of fund such as General Fund or any other authorized fund</div>
                            <div><strong>6. Sheet No.</strong> – shall be numbered as follows: 0000-000 (Serial number - Year)</div>
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-blue-900 mb-2">Transaction Details:</h5>
                          <div className="space-y-1 text-blue-800 text-xs">
                            <div><strong>7. Date</strong> – date of the source document/transaction</div>
                            <div><strong>8. Reference</strong> – the number of the documents such as Credit Memo (CM) No., DV No., Check No., Validated Deposit Slip, etc.</div>
                            <div><strong>9. Name of Payee</strong> – name of individual/entity indicated in the check/ADA</div>
                            <div><strong>10. Particulars</strong> – nature and details of the transactions</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-blue-900 mb-2">Cash in Bank:</h5>
                          <div className="space-y-1 text-blue-800 text-xs">
                            <div><strong>a. Deposit</strong> – amount deposited in the account of the SK per VDS or CM No.</div>
                            <div><strong>b. Withdrawal</strong> – amounts of checks/ADA issued by the SK Treasurer charged to the account of the SK</div>
                            <div><strong>c. Balance</strong> – daily balance of Cash in Bank</div>
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-blue-900 mb-2">Breakdown of Withdrawals/Payments:</h5>
                          <div className="space-y-1 text-blue-800 text-xs">
                            <div><strong>• MOOE</strong> – amount spent for operating expenses</div>
                            <div><strong>• Capital Outlay</strong> – amount spent for the purchase/construction of property and equipment</div>
                            <div><strong>• Advances to SK Officials</strong> – cash advance granted to SK Officials for official travel</div>
                            <div><strong>• Advances to SK Treasurer</strong> – cash advance granted to SK Treasurer for special purpose/time-bound undertakings</div>
                            <div><strong>• Others</strong> – amount of other adjustments involving cash in bank</div>
                            <div><strong>• Withholding Tax</strong> – amount of tax withheld from the suppliers/payees</div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="font-medium text-blue-900 mb-2">Important Notes:</h5>
                        <div className="space-y-1 text-blue-800 text-xs">
                          <div><strong>• Totals/Balance brought forward</strong> – total amount/balance pulled forward from previous sheet</div>
                          <div><strong>• Totals for the quarter</strong> – total amount of transactions for the quarter</div>
                          <div><strong>• Totals/Balance carried forward</strong> – total amount/balance at the end of a sheet forwarded to the next sheet</div>
                          <div><strong>• A new sheet shall be used at the beginning of each quarter</strong></div>
                          <div><strong>• Every sheet shall be certified correct by the SK Treasurer</strong></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            
            {/* Action Buttons - Always Visible */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {/* Save RCB - Leftmost */}
              <button 
                onClick={handleSaveRCB}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save RCB'
                )}
              </button>
              
              {/* Print Preview - Right beside Save RCB */}
              <button 
                className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                  showRcbPreview 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setShowRcbPreview(!showRcbPreview)}
              >
                {showRcbPreview ? 'Hide Preview' : 'Print Preview'}
              </button>
              
              {/* Refresh Button */}
              <button 
                onClick={refreshRCB}
                disabled={loading}
                className="px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
              
              {/* Show/Hide Instructions */}
              <button 
                className="px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors"
                onClick={() => setShowRcbInstructions(!showRcbInstructions)}
              >
                {showRcbInstructions ? 'Hide Instructions' : 'Show Instructions'}
              </button>
              
              {/* Close Editing Period - beside Show Instructions */}
              {!isEditingPeriodClosed && (
                <button 
                  onClick={closeEditingPeriod}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium transition-colors"
                >
                  Close Editing Period
                </button>
              )}
              
              {/* Export to Word - only show when NOT in preview mode */}
              {!showRcbPreview && (
                <button 
                  onClick={handleExportRCB}
                  className="px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  Export to Word
                </button>
              )}
              
              {/* Only show when editing period is open */}
              {!isEditingPeriodClosed && (
                <>
                  {/* Reset */}
                  <button 
                    onClick={resetRCB}
                    className="px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors"
                  >
                    Reset
                  </button>
                  
                  {/* Reset All RCB */}
                  <button 
                    onClick={resetAllRCB}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium transition-colors"
                  >
                    Reset All RCB
                  </button>
                </>
              )}
              
              {/* Editing Period Status */}
              {isEditingPeriodClosed && (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Editing Period Closed
                </div>
              )}
            </div>

            {/* Data Entry Section - Only show when not in preview mode */}
            {!showRcbPreview && (
              <div className="card p-6">
                <div className="mb-4">
                  <div className="text-lg font-semibold text-gray-900">RCB Data Entry</div>
                  <div className="text-sm text-gray-600">Configure columns and add entries for {quarter} {financialYear}</div>
                  {isEditingPeriodClosed && (
                    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                      <div className="flex items-center gap-2 text-orange-800">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-medium">Editing period is closed. Forms are read-only.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* RCB Metadata */}
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded p-3">
                    <div className="text-sm font-medium mb-2">RCB Information</div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-20">Fund:</span>
                        <input
                          value={rcbMetadata.fund}
                          onChange={e => updateRcbMetadata(m => ({ ...m, fund: e.target.value }))}
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="SK Fund"
                          readOnly={isEditingPeriodClosed}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-20">Sheet No:</span>
                        <input
                          value={rcbMetadata.sheetNo}
                          onChange={e => updateRcbMetadata(m => ({ ...m, sheetNo: e.target.value }))}
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="1"
                          readOnly={isEditingPeriodClosed}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-20">Balance Brought Forward:</span>
                        <input
                          type="number"
                          value={rcbMetadata.balanceBroughtForward}
                          onChange={e => updateRcbMetadata(m => ({ ...m, balanceBroughtForward: toNumber(e.target.value) }))}
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="0.00"
                          readOnly={isEditingPeriodClosed}
                        />
                      </div>
                      {entries.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm w-20">Ending Balance:</span>
                          <span className="flex-1 text-sm font-medium text-green-600">
                            ₱{getEndingBalance().toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

            {/* RCB column settings (quick inline editor) */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border border-gray-200 rounded p-3">
                <div className="text-sm font-medium mb-2">MOOE subaccounts (max 3)</div>
                <div className="space-y-2">
                  {rcbSettings.mooeAccounts.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={name}
                        onChange={e => updateRcbSettings(s => ({ ...s, mooeAccounts: s.mooeAccounts.map((n, i) => i===idx? e.target.value : n) }))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <button
                        className="text-red-600 text-xs"
                        onClick={() => updateRcbSettings(s => ({ ...s, mooeAccounts: s.mooeAccounts.filter((_, i) => i!==idx) }))}
                      >Remove</button>
                    </div>
                  ))}
                  {rcbSettings.mooeAccounts.length < 3 && (
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => updateRcbSettings(s => ({ ...s, mooeAccounts: [...s.mooeAccounts, 'New MOOE'] }))}
                    >Add subaccount</button>
                  )}
                </div>
              </div>

              <div className="border border-gray-200 rounded p-3">
                <div className="text-sm font-medium mb-2">Capital Outlay subaccounts (max 3)</div>
                <div className="space-y-2">
                  {rcbSettings.coAccounts.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={name}
                        onChange={e => updateRcbSettings(s => ({ ...s, coAccounts: s.coAccounts.map((n, i) => i===idx? e.target.value : n) }))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <button
                        className="text-red-600 text-xs"
                        onClick={() => updateRcbSettings(s => ({ ...s, coAccounts: s.coAccounts.filter((_, i) => i!==idx) }))}
                      >Remove</button>
                    </div>
                  ))}
                  {rcbSettings.coAccounts.length < 3 && (
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => updateRcbSettings(s => ({ ...s, coAccounts: [...s.coAccounts, 'New CO'] }))}
                    >Add subaccount</button>
                  )}
                </div>
              </div>

              <div className="border border-gray-200 rounded p-3">
                <div className="text-sm font-medium mb-2">Withholding types (max 3)</div>
                <div className="space-y-2">
                  {rcbSettings.withholdingTypes.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={name}
                        onChange={e => updateRcbSettings(s => ({ ...s, withholdingTypes: s.withholdingTypes.map((n, i) => i===idx? e.target.value : n) }))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <button
                        className="text-red-600 text-xs"
                        onClick={() => updateRcbSettings(s => ({ ...s, withholdingTypes: s.withholdingTypes.filter((_, i) => i!==idx) }))}
                      >Remove</button>
                    </div>
                  ))}
                  {rcbSettings.withholdingTypes.length < 3 && (
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => updateRcbSettings(s => ({ ...s, withholdingTypes: [...s.withholdingTypes, 'New Tax Type'] }))}
                    >Add type</button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-xs">
                <thead>
                  {/* Row 1: Group headers */}
                  <tr className="bg-gray-50">
                    <th className="border p-2 text-left" rowSpan={3}>Date</th>
                    <th className="border p-2 text-left" rowSpan={3}>Reference</th>
                    <th className="border p-2 text-left" rowSpan={3}>Name of Payee</th>
                    <th className="border p-2 text-left" rowSpan={3}>Particulars</th>
                    <th className="border p-2 text-center" colSpan={3}>Cash in Bank</th>
                    <th className="border p-2 text-center" colSpan={
                      rcbSettings.mooeAccounts.length + rcbSettings.coAccounts.length + 2
                    }>Breakdown of Withdrawals/Payments</th>
                    <th className="border p-2 text-center" rowSpan={3}>Others</th>
                    <th className="border p-2 text-center" rowSpan={2} colSpan={Math.max(1, rcbSettings.withholdingTypes.length)}>Withholding Tax</th>
                    <th className="border p-2 text-center" rowSpan={3}>Actions</th>
                  </tr>
                  {/* Row 2: Sub-groups under Breakdown */}
                  <tr className="bg-gray-50">
                    <th className="border p-2" rowSpan={2}>Deposit</th>
                    <th className="border p-2" rowSpan={2}>Withdrawal</th>
                    <th className="border p-2" rowSpan={2}>Balance</th>
                    <th className="border p-2 text-center" colSpan={rcbSettings.mooeAccounts.length}>Maintenance and Other Operating Expenses (MOOE)</th>
                    <th className="border p-2 text-center" colSpan={rcbSettings.coAccounts.length}>Capital Outlay</th>
                    <th className="border p-2 text-center" colSpan={2}>Advances</th>
                    {/* Withholding Tax header in row 1 spans to row 3 via colSpan; no cells needed here */}
                  </tr>
                  {/* Row 3: Individual sub-accounts and withholding types */}
                  <tr className="bg-gray-50">
                    {rcbSettings.mooeAccounts.map((n, i) => (
                      <th key={`mooe-${i}`} className="border p-2">{n}</th>
                    ))}
                    {rcbSettings.coAccounts.map((n, i) => (
                      <th key={`co-${i}`} className="border p-2">{n}</th>
                    ))}
                    <th className="border p-2">Adv. to SK officials</th>
                    <th className="border p-2">Adv. to SK treasurer</th>
                    {rcbSettings.withholdingTypes.map((n, i) => (
                      <th key={`wt-${i}`} className="border p-2">{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Input row */}
                  <tr className="bg-yellow-50">
                    <td className="border p-1"><input type="date" value={draft.date} onChange={e=>setDraft({...draft, date: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    <td className="border p-1"><input value={draft.reference} onChange={e=>setDraft({...draft, reference: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    <td className="border p-1"><input value={draft.payee} onChange={e=>setDraft({...draft, payee: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    <td className="border p-1"><input value={draft.particulars} onChange={e=>setDraft({...draft, particulars: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    <td className="border p-1"><input value={draft.deposit} onChange={e=>setDraft({...draft, deposit: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    <td className="border p-1"><input value={draft.withdrawal} onChange={e=>setDraft({...draft, withdrawal: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    <td className="border p-1 text-right text-gray-500">{draft.balance.toLocaleString()}</td>
                    {rcbSettings.mooeAccounts.map((n,i)=>(
                      <td key={`mooei-${i}`} className="border p-1"><input value={draft.mooe[n]} onChange={e=>setDraft({...draft, mooe: {...draft.mooe, [n]: toNumber(e.target.value)}})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    ))}
                    {rcbSettings.coAccounts.map((n,i)=>(
                      <td key={`coi-${i}`} className="border p-1"><input value={draft.co[n]} onChange={e=>setDraft({...draft, co: {...draft.co, [n]: toNumber(e.target.value)}})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    ))}
                    <td className="border p-1"><input value={draft.advOfficials} onChange={e=>setDraft({...draft, advOfficials: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    <td className="border p-1"><input value={draft.advTreasurer} onChange={e=>setDraft({...draft, advTreasurer: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    {rcbSettings.withholdingTypes.map((n,i)=>(
                      <td key={`wti-${i}`} className="border p-1"><input value={draft.withholding[n] || 0} onChange={e=>setDraft({...draft, withholding: {...draft.withholding, [n]: toNumber(e.target.value)}})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    ))}
                    <td className="border p-1"><input value={draft.others} onChange={e=>setDraft({...draft, others: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs" readOnly={isEditingPeriodClosed}/></td>
                    <td className="border p-1"></td>
                  </tr>
                  <tr>
                    <td className="border p-1" colSpan={
                      7 + rcbSettings.mooeAccounts.length + rcbSettings.coAccounts.length + 2 + 1 + rcbSettings.withholdingTypes.length + 1
                    }>
                      <button 
                        className="btn-primary text-xs" 
                        onClick={addEntry}
                        disabled={isEditingPeriodClosed}
                      >
                        Add entry
                      </button>
                    </td>
                    <td className="border p-1"></td>
                  </tr>
                  {/* Existing entries */}
                  {entries.length === 0 ? (
                    <tr>
                      <td className="border p-2" colSpan={
                        7 + rcbSettings.mooeAccounts.length + rcbSettings.coAccounts.length + 2 + 1 + rcbSettings.withholdingTypes.length
                      }>
                        No entries yet for {quarter} {financialYear}.
                      </td>
                      <td className="border p-2"></td>
                    </tr>
                  ) : entries.map((e, idx) => (
                    <tr key={idx}>
                      <td className="border p-1">{e.date}</td>
                      <td className="border p-1">{e.reference}</td>
                      <td className="border p-1">{e.payee}</td>
                      <td className="border p-1">{e.particulars}</td>
                      <td className="border p-1 text-right">{e.deposit.toLocaleString()}</td>
                      <td className="border p-1 text-right">{e.withdrawal.toLocaleString()}</td>
                      <td className="border p-1 text-right">{e.balance.toLocaleString()}</td>
                      {rcbSettings.mooeAccounts.map((n,i)=>(
                        <td key={`mooev-${i}`} className="border p-1 text-right">{(e.mooe[n]||0).toLocaleString()}</td>
                      ))}
                      {rcbSettings.coAccounts.map((n,i)=>(
                        <td key={`cov-${i}`} className="border p-1 text-right">{(e.co[n]||0).toLocaleString()}</td>
                      ))}
                      <td className="border p-1 text-right">{e.advOfficials.toLocaleString()}</td>
                      <td className="border p-1 text-right">{e.advTreasurer.toLocaleString()}</td>
                      {rcbSettings.withholdingTypes.map((n,i)=>(
                        <td key={`wtv-${i}`} className="border p-1 text-right">{(e.withholding[n]||0).toLocaleString()}</td>
                      ))}
                      <td className="border p-1 text-right">{e.others.toLocaleString()}</td>
                      <td className="border p-1">
                        <button
                          onClick={() => {
                            setDraft(e);
                            setRcbEntriesByYQ(prev => ({
                              ...prev,
                              [yqKey]: prev[yqKey].filter((_, i) => i !== idx)
                            }));
                          }}
                          className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-300 rounded hover:bg-blue-50"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="border p-2 italic" colSpan={4}>Balance brought forward</td>
                    <td className="border p-2 text-right">0.00</td>
                    <td className="border p-2 text-right">0.00</td>
                    <td className="border p-2 text-right">{rcbMetadata.balanceBroughtForward.toLocaleString()}</td>
                    {rcbSettings.mooeAccounts.map((n,i)=>(
                      <td key={`bmooe-${i}`} className="border p-2 text-right">0.00</td>
                    ))}
                    {rcbSettings.coAccounts.map((n,i)=>(
                      <td key={`bco-${i}`} className="border p-2 text-right">0.00</td>
                    ))}
                    <td className="border p-2 text-right">0.00</td>
                    <td className="border p-2 text-right">0.00</td>
                    {rcbSettings.withholdingTypes.map((n,i)=>(
                      <td key={`bwt-${i}`} className="border p-2 text-right">0.00</td>
                    ))}
                    <td className="border p-2 text-right">0.00</td>
                  </tr>
                  <tr>
                    <td className="border p-2 italic" colSpan={4}>Totals for the quarter</td>
                    <td className="border p-2 text-right">{totals.deposit.toLocaleString()}</td>
                    <td className="border p-2 text-right">{totals.withdrawal.toLocaleString()}</td>
                    <td className="border p-2 text-right">{totals.balance.toLocaleString()}</td>
                    {rcbSettings.mooeAccounts.map((n,i)=>(
                      <td key={`tmooe-${i}`} className="border p-2 text-right">{(((totals.mooe as any)[n]) || 0).toLocaleString()}</td>
                    ))}
                    {rcbSettings.coAccounts.map((n,i)=>(
                      <td key={`tco-${i}`} className="border p-2 text-right">{(((totals.co as any)[n]) || 0).toLocaleString()}</td>
                    ))}
                    <td className="border p-2 text-right">{totals.advOfficials.toLocaleString()}</td>
                    <td className="border p-2 text-right">{totals.advTreasurer.toLocaleString()}</td>
                    {rcbSettings.withholdingTypes.map((n,i)=>(
                      <td key={`twt-${i}`} className="border p-2 text-right">{(((totals.withholding as any)[n]) || 0).toLocaleString()}</td>
                    ))}
                    <td className="border p-2 text-right">{totals.others.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="border p-2 italic" colSpan={4}>Totals/Balance carried forward</td>
                    <td className="border p-2 text-right" colSpan={
                      3 + (rcbSettings.mooeAccounts.length + rcbSettings.coAccounts.length + 2) + 1 + rcbSettings.withholdingTypes.length
                    }></td>
                    <td className="border p-2 text-right">{totals.balance.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>


            <div className="text-xs text-gray-500 mt-3">Prepared and certified correct by: SK Treasurer • Noted by: SK Chairperson</div>
              </div>
            )}

            {/* Preview Section */}
            {showRcbPreview && (
              <div className="card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                  <div className="text-lg font-semibold text-gray-900">RCB Print Preview</div>
                  <div className="text-sm text-gray-600">Preview of {quarter} {financialYear} RCB</div>
                  </div>
                  
                  {/* Export to Word button in top right when in preview */}
                  <button 
                    onClick={handleExportRCB}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export to Word
                  </button>
                </div>
                
                {/* Export and Print Note */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="font-medium text-blue-800">Note about downloading and printing:</p>
                      <p className="text-sm text-blue-700 mt-1">
                        To download and print the RCB, click the "Export to Word" button above, then open the downloaded document and print from there.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Document Header */}
                <div className="text-center mb-6">
                  {skProfile?.logo ? (
                    <img src={skProfile.logo} alt="Barangay Logo" className="w-16 h-16 mx-auto mb-2" />
                  ) : (
                    <div className="w-16 h-16 mx-auto mb-2 border border-gray-300 flex items-center justify-center text-xs text-gray-500">
                      (Barangay Logo)
                    </div>
                  )}
                  <div className="text-xs text-gray-700 mb-2">OFFICE OF THE SANGGUNIANG KABATAAN</div>
                  <div className="font-semibold text-lg mb-2">REGISTER OF CASH IN BANK AND OTHER RELATED FINANCIAL TRANSACTION</div>
                  <div className="text-xs text-gray-600">({quarter === 'Q1' ? '1st' : quarter === 'Q2' ? '2nd' : quarter === 'Q3' ? '3rd' : '4th'} Quarter of CY {financialYear})</div>
                </div>

                {/* Information Fields */}
                <div className="mb-6">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <span className="text-sm font-medium w-32">SK of Barangay:</span>
                        <div className="flex-1 border-b border-gray-400 pb-1">
                          <span className="text-sm">{skProfile?.barangay || 'Loading...'}</span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium w-32">SK Treasurer:</span>
                        <div className="flex-1 border-b border-gray-400 pb-1">
                          <span className="text-sm">
                            {(() => {
                              const treasurer = skMembers.find(member => member.role === 'treasurer');
                              return treasurer ? treasurer.name : (user?.role === 'treasurer' ? user.name : 'Loading...');
                            })()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium w-32">Fund:</span>
                        <div className="flex-1 border-b border-gray-400 pb-1">
                          <span className="text-sm">{rcbMetadata.fund}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <span className="text-sm font-medium w-32">City/Municipality:</span>
                        <div className="flex-1 border-b border-gray-400 pb-1">
                          <span className="text-sm">{skProfile?.city || 'Loading...'}</span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium w-32">Province:</span>
                        <div className="flex-1 border-b border-gray-400 pb-1">
                          <span className="text-sm">{skProfile?.province || 'Loading...'}</span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium w-32">Sheet No:</span>
                        <div className="flex-1 border-b border-gray-400 pb-1">
                          <span className="text-sm">{rcbMetadata.sheetNo}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-800 text-[10px]">
                    <thead>
                      <tr>
                        <th className="border border-gray-800 p-1 text-center font-semibold" rowSpan={3}>Date</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" rowSpan={3}>Reference</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" rowSpan={3}>Name of Payee</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" rowSpan={3}>Particular</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" colSpan={3}>Cash in Bank</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" colSpan={rcbSettings.mooeAccounts.length + rcbSettings.coAccounts.length + 2}>BREAKDOWN OF WITHDRAWALS/PAYMENTS</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" rowSpan={3}>Others</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" colSpan={Math.max(1, rcbSettings.withholdingTypes.length)}>Withholding Tax</th>
                      </tr>
                      <tr>
                        <th className="border border-gray-800 p-1 text-center font-semibold" rowSpan={2}>Deposit</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" rowSpan={2}>Withdrawal</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" rowSpan={2}>Balance</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" colSpan={rcbSettings.mooeAccounts.length}>Maintenance and Other Operating Expenses</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" colSpan={rcbSettings.coAccounts.length}>Capital Outlay</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold" colSpan={2}>Advances</th>
                        {rcbSettings.withholdingTypes.length > 0 ? (
                          <th className="border border-gray-800 p-1 text-center font-semibold" colSpan={rcbSettings.withholdingTypes.length}></th>
                        ) : (
                          <th className="border border-gray-800 p-1 text-center font-semibold"></th>
                        )}
                      </tr>
                      <tr>
                        {rcbSettings.mooeAccounts.map((n,i)=>(
                          <th key={`pmooe-${i}`} className="border border-gray-800 p-1 text-center font-semibold">{n}</th>
                        ))}
                        {rcbSettings.coAccounts.map((n,i)=>(
                          <th key={`pco-${i}`} className="border border-gray-800 p-1 text-center font-semibold">{n}</th>
                        ))}
                        <th className="border border-gray-800 p-1 text-center font-semibold">Adv. to SK officials</th>
                        <th className="border border-gray-800 p-1 text-center font-semibold">Adv. to SK treasurer</th>
                        {(rcbSettings.withholdingTypes.length ? rcbSettings.withholdingTypes : ['Specify the type of Withholding tax']).map((n,i)=>(
                          <th key={`pwt-${i}`} className="border border-gray-800 p-1 text-center font-semibold">{n || 'Specify the type of Withholding tax'}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Total/Balance brought forwarded row */}
                      <tr>
                        <td className="border border-gray-800 p-1"></td>
                        <td className="border border-gray-800 p-1"></td>
                        <td className="border border-gray-800 p-1"></td>
                        <td className="border border-gray-800 p-1 font-semibold">Total/Balance brought forwarded</td>
                        <td className="border border-gray-800 p-1 text-right">0.00</td>
                        <td className="border border-gray-800 p-1 text-right">0.00</td>
                        <td className="border border-gray-800 p-1 text-right">{rcbMetadata.balanceBroughtForward.toLocaleString()}</td>
                        {rcbSettings.mooeAccounts.map((n,i)=>(
                          <td key={`brought-mooe-${i}`} className="border border-gray-800 p-1 text-right">0.00</td>
                        ))}
                        {rcbSettings.coAccounts.map((n,i)=>(
                          <td key={`brought-co-${i}`} className="border border-gray-800 p-1 text-right">0.00</td>
                        ))}
                        <td className="border border-gray-800 p-1 text-right">0.00</td>
                        <td className="border border-gray-800 p-1 text-right">0.00</td>
                        {(rcbSettings.withholdingTypes.length ? rcbSettings.withholdingTypes : ['Specify the type of Withholding tax']).map((n,i)=>(
                          <td key={`brought-wt-${i}`} className="border border-gray-800 p-1 text-right">0.00</td>
                        ))}
                        <td className="border border-gray-800 p-1 text-right">0.00</td>
                      </tr>
                      
                      {/* Data entries */}
                      {entries.length === 0 ? (
                        Array.from({length: 15}).map((_, idx) => (
                          <tr key={`empty-${idx}`}>
                            <td className="border border-gray-800 p-1 h-6"></td>
                            <td className="border border-gray-800 p-1 h-6"></td>
                            <td className="border border-gray-800 p-1 h-6"></td>
                            <td className="border border-gray-800 p-1 h-6"></td>
                            <td className="border border-gray-800 p-1 h-6"></td>
                            <td className="border border-gray-800 p-1 h-6"></td>
                            <td className="border border-gray-800 p-1 h-6"></td>
                            {rcbSettings.mooeAccounts.map((n,i)=>(
                              <td key={`empty-mooe-${idx}-${i}`} className="border border-gray-800 p-1 h-6"></td>
                            ))}
                            {rcbSettings.coAccounts.map((n,i)=>(
                              <td key={`empty-co-${idx}-${i}`} className="border border-gray-800 p-1 h-6"></td>
                            ))}
                            <td className="border border-gray-800 p-1 h-6"></td>
                            <td className="border border-gray-800 p-1 h-6"></td>
                            {(rcbSettings.withholdingTypes.length ? rcbSettings.withholdingTypes : ['Specify the type of Withholding tax']).map((n,i)=>(
                              <td key={`empty-wt-${idx}-${i}`} className="border border-gray-800 p-1 h-6"></td>
                            ))}
                            <td className="border border-gray-800 p-1 h-6"></td>
                          </tr>
                        ))
                      ) : entries.map((e, idx) => (
                        <tr key={`pr-${idx}`}>
                          <td className="border border-gray-800 p-1">{e.date}</td>
                          <td className="border border-gray-800 p-1">{e.reference}</td>
                          <td className="border border-gray-800 p-1">{e.payee}</td>
                          <td className="border border-gray-800 p-1">{e.particulars}</td>
                          <td className="border border-gray-800 p-1 text-right">{e.deposit.toLocaleString()}</td>
                          <td className="border border-gray-800 p-1 text-right">{e.withdrawal.toLocaleString()}</td>
                          <td className="border border-gray-800 p-1 text-right">{e.balance.toLocaleString()}</td>
                          {rcbSettings.mooeAccounts.map((n,i)=>(
                            <td key={`prm-${idx}-${i}`} className="border border-gray-800 p-1 text-right">{(e.mooe[n]||0).toLocaleString()}</td>
                          ))}
                          {rcbSettings.coAccounts.map((n,i)=>(
                            <td key={`prc-${idx}-${i}`} className="border border-gray-800 p-1 text-right">{(e.co[n]||0).toLocaleString()}</td>
                          ))}
                          <td className="border border-gray-800 p-1 text-right">{e.advOfficials.toLocaleString()}</td>
                          <td className="border border-gray-800 p-1 text-right">{e.advTreasurer.toLocaleString()}</td>
                          {(rcbSettings.withholdingTypes.length ? rcbSettings.withholdingTypes : ['Specify the type of Withholding tax']).map((n,i)=>(
                            <td key={`prw-${idx}-${i}`} className="border border-gray-800 p-1 text-right">{(e.withholding[n]||0).toLocaleString()}</td>
                          ))}
                          <td className="border border-gray-800 p-1 text-right">{e.others.toLocaleString()}</td>
                        </tr>
                      ))}
                      
                      {/* Totals */}
                      <tr className="font-semibold">
                        <td className="border border-gray-800 p-1"></td>
                        <td className="border border-gray-800 p-1"></td>
                        <td className="border border-gray-800 p-1"></td>
                        <td className="border border-gray-800 p-1 font-semibold">Totals for the quarter</td>
                        <td className="border border-gray-800 p-1 text-right">{totals.deposit.toLocaleString()}</td>
                        <td className="border border-gray-800 p-1 text-right">{totals.withdrawal.toLocaleString()}</td>
                        <td className="border border-gray-800 p-1 text-right">{totals.balance.toLocaleString()}</td>
                        {rcbSettings.mooeAccounts.map((n,i)=>(
                          <td key={`ptm-${i}`} className="border border-gray-800 p-1 text-right">{(((totals.mooe as any)[n])||0).toLocaleString()}</td>
                        ))}
                        {rcbSettings.coAccounts.map((n,i)=>(
                          <td key={`ptc-${i}`} className="border border-gray-800 p-1 text-right">{(((totals.co as any)[n])||0).toLocaleString()}</td>
                        ))}
                        <td className="border border-gray-800 p-1 text-right">{totals.advOfficials.toLocaleString()}</td>
                        <td className="border border-gray-800 p-1 text-right">{totals.advTreasurer.toLocaleString()}</td>
                        {(rcbSettings.withholdingTypes.length ? rcbSettings.withholdingTypes : ['Specify the type of Withholding tax']).map((n,i)=>(
                          <td key={`ptw-${i}`} className="border border-gray-800 p-1 text-right">{(((totals.withholding as any)[n])||0).toLocaleString()}</td>
                        ))}
                        <td className="border border-gray-800 p-1 text-right">{totals.others.toLocaleString()}</td>
                      </tr>
                      <tr className="font-semibold">
                        <td className="border border-gray-800 p-1"></td>
                        <td className="border border-gray-800 p-1"></td>
                        <td className="border border-gray-800 p-1"></td>
                        <td className="border border-gray-800 p-1 font-semibold">Totals/Balance carried forward</td>
                        <td className="border border-gray-800 p-1 text-right">{totals.deposit.toLocaleString()}</td>
                        <td className="border border-gray-800 p-1 text-right">{totals.withdrawal.toLocaleString()}</td>
                        <td className="border border-gray-800 p-1 text-right">{totals.balance.toLocaleString()}</td>
                        {rcbSettings.mooeAccounts.map((n,i)=>(
                          <td key={`carry-mooe-${i}`} className="border border-gray-800 p-1 text-right">{(((totals.mooe as any)[n])||0).toLocaleString()}</td>
                        ))}
                        {rcbSettings.coAccounts.map((n,i)=>(
                          <td key={`carry-co-${i}`} className="border border-gray-800 p-1 text-right">{(((totals.co as any)[n])||0).toLocaleString()}</td>
                        ))}
                        <td className="border border-gray-800 p-1 text-right">{totals.advOfficials.toLocaleString()}</td>
                        <td className="border border-gray-800 p-1 text-right">{totals.advTreasurer.toLocaleString()}</td>
                        {(rcbSettings.withholdingTypes.length ? rcbSettings.withholdingTypes : ['Specify the type of Withholding tax']).map((n,i)=>(
                          <td key={`carry-wt-${i}`} className="border border-gray-800 p-1 text-right">{(((totals.withholding as any)[n])||0).toLocaleString()}</td>
                        ))}
                        <td className="border border-gray-800 p-1 text-right">{totals.others.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Signature Section */}
                <div className="mt-8 grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-sm font-medium mb-2">Prepared and Certified Correct by:</div>
                    <div className="text-sm font-medium mb-1">
                      {(() => {
                        const treasurer = skMembers.find(member => member.role === 'treasurer');
                        return treasurer ? treasurer.name : (user?.role === 'treasurer' ? user.name : 'SK Treasurer');
                      })()}
                    </div>
                    <div className="border-b border-gray-400 pb-1 h-6 mb-1"></div>
                    <div className="text-xs text-gray-600 mb-1">Signature over Printed Name</div>
                    <div className="text-sm font-medium mb-1">SK Treasurer</div>
                    <div className="border-b border-gray-400 pb-1 h-6 w-24 mb-1"></div>
                    <div className="text-xs text-gray-600">Date</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">Noted by:</div>
                    <div className="text-sm font-medium mb-1">
                      {(() => {
                        const chairperson = skMembers.find(member => member.role === 'chairperson');
                        return chairperson ? chairperson.name : (user?.role === 'chairperson' ? user.name : 'SK Chairperson');
                      })()}
                    </div>
                    <div className="border-b border-gray-400 pb-1 h-6 mb-1"></div>
                    <div className="text-xs text-gray-600 mb-1">Signature over Printed Name</div>
                    <div className="text-sm font-medium mb-1">SK Chairperson</div>
                    <div className="border-b border-gray-400 pb-1 h-6 w-24 mb-1"></div>
                    <div className="text-xs text-gray-600">Date</div>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="mt-6 text-[9px] text-gray-500 leading-tight">
                  <div>Note: For the instruction on how to fill out the form, please refer to page 179 of the COA Handbook on the Financial Transaction of SK.</div>
                  <div>The "Noted by" phrase is added for purposes of submission of RCB to the DILG City/Municipal Field Office.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pr' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Purchase Requests</h2>
                <p className="text-sm text-gray-600">Year {financialYear} • {quarter}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="min-w-0 relative">
                  <select
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
                    className="px-4 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium appearance-none"
                    title={skProfile ? `SK Term: ${skProfile.skTermStart}-${skProfile.skTermEnd || skProfile.skTermStart + 2}` : 'Year selection'}
                  >
                    {getAvailableYears().map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="min-w-0 relative">
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value as any)}
                    className="px-4 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium appearance-none"
                  >
                    {(['Q1','Q2','Q3','Q4'] as const).map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors">
                    Create PR
                  </button>
                  <button className="px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors">
                    Export to Word
                  </button>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="text-gray-600 text-sm">Purchase Requests will be implemented here. It will support PR creation, line items, attachments, status tracking, and exports.</div>
            </div>
          </div>
        )}
      </div>

      {/* PDF Upload Modal */}
      {showPdfUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload Signed RCB PDF</h3>
              <button
                onClick={() => {
                  setShowPdfUpload(false);
                  // Reset editing period status for this YQ when canceling
                  setIsEditingPeriodClosedByYQ(prev => ({ ...prev, [yqKey]: false }));
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Please upload the signed PDF of the RCB for {quarter} {financialYear}. This is required before proceeding to the next quarter.
              </p>
              
              {signedPdfUrl && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-green-800 font-medium">Signed PDF already uploaded</span>
                  </div>
                  <a 
                    href={signedPdfUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline mt-1 inline-block"
                  >
                    View uploaded PDF
                  </a>
                </div>
              )}
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                  id="pdf-upload"
                />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-600">
                    {uploadedPdf ? uploadedPdf.name : 'Click to upload signed RCB PDF'}
                  </p>
                </label>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPdfUpload(false);
                  // Reset editing period status for this YQ when canceling
                  setIsEditingPeriodClosedByYQ(prev => ({ ...prev, [yqKey]: false }));
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitSignedRcb}
                disabled={!uploadedPdf || uploadingPdf}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploadingPdf ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Uploading...
                  </>
                ) : (
                  'Submit Signed RCB'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Financial;


