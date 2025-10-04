import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Layers, ReceiptText, Wallet } from 'lucide-react';
import Budget from './Budget';
import { useAuth } from '../contexts/AuthContext';
import { getSKProfile, saveRCBData, loadRCBData } from '../services/firebaseService';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { logActivity } from '../services/activityService';
import { exportDocxFromTemplate, mapRCBToTemplate } from '../services/docxExport';

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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('rcb');
  const [financialYear, setFinancialYear] = useState<string>(new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [skProfile, setSkProfile] = useState<SKProfile | null>(null);
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
        entries: entries 
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
        const [profile, rcbData] = await Promise.all([
          getSKProfile(),
          loadRCBData(yqKey)
        ]);
        setSkProfile(profile as SKProfile);
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
        entries: entries 
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
  }, [user, yqKey, rcbSettings, rcbMetadata, entries, saving, quarter, financialYear, hasChanges]);

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
                <p className="text-sm text-gray-600">Year {financialYear} • {quarter} ({quarterMonths[quarter]})</p>
                
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
              <div className="flex items-center gap-3">
                <div className="min-w-0 relative">
                  <select
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
                    className="px-4 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium appearance-none"
                  >
                    {Array.from({ length: 7 }, (_, i) => String(new Date().getFullYear() - 3 + i)).map(y => (
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
                <div className="flex items-center gap-2">
                  <button 
                    className="btn-secondary text-sm"
                    onClick={() => setShowRcbInstructions(!showRcbInstructions)}
                  >
                    {showRcbInstructions ? 'Hide Instructions' : 'Show Instructions'}
                  </button>
                  <button 
                    className="btn-secondary text-sm"
                    onClick={() => setShowRcbPreview(!showRcbPreview)}
                  >
                    {showRcbPreview ? 'Hide Preview' : 'Print Preview'}
                  </button>
                  <button 
                    onClick={resetRCB}
                    className="btn-secondary text-sm"
                  >
                    Reset
                  </button>
                  <button 
                    onClick={handleSaveRCB}
                    disabled={saving}
                    className="btn-primary text-sm"
                  >
                    {saving ? 'Saving...' : 'Save RCB'}
                  </button>
                  <button 
                    onClick={handleExportRCB}
                    className="btn-secondary text-sm"
                  >
                    Export to Word
                  </button>
                </div>
              </div>
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
            ) : !showRcbPreview ? (
              <div className="card p-6">
                <div className="mb-4">
                  <div className="text-lg font-semibold text-gray-900">RCB Data Entry</div>
                  <div className="text-sm text-gray-600">Configure columns and add entries for {quarter} {financialYear}</div>
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
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-20">Sheet No:</span>
                        <input
                          value={rcbMetadata.sheetNo}
                          onChange={e => updateRcbMetadata(m => ({ ...m, sheetNo: e.target.value }))}
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="1"
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
                    <td className="border p-1"><input type="date" value={draft.date} onChange={e=>setDraft({...draft, date: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.reference} onChange={e=>setDraft({...draft, reference: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.payee} onChange={e=>setDraft({...draft, payee: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.particulars} onChange={e=>setDraft({...draft, particulars: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.deposit} onChange={e=>setDraft({...draft, deposit: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.withdrawal} onChange={e=>setDraft({...draft, withdrawal: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1 text-right text-gray-500">{draft.balance.toLocaleString()}</td>
                    {rcbSettings.mooeAccounts.map((n,i)=>(
                      <td key={`mooei-${i}`} className="border p-1"><input value={draft.mooe[n]} onChange={e=>setDraft({...draft, mooe: {...draft.mooe, [n]: toNumber(e.target.value)}})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    ))}
                    {rcbSettings.coAccounts.map((n,i)=>(
                      <td key={`coi-${i}`} className="border p-1"><input value={draft.co[n]} onChange={e=>setDraft({...draft, co: {...draft.co, [n]: toNumber(e.target.value)}})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    ))}
                    <td className="border p-1"><input value={draft.advOfficials} onChange={e=>setDraft({...draft, advOfficials: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.advTreasurer} onChange={e=>setDraft({...draft, advTreasurer: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    {rcbSettings.withholdingTypes.map((n,i)=>(
                      <td key={`wti-${i}`} className="border p-1"><input value={draft.withholding[n] || 0} onChange={e=>setDraft({...draft, withholding: {...draft.withholding, [n]: toNumber(e.target.value)}})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    ))}
                    <td className="border p-1"><input value={draft.others} onChange={e=>setDraft({...draft, others: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"></td>
                  </tr>
                  <tr>
                    <td className="border p-1" colSpan={
                      7 + rcbSettings.mooeAccounts.length + rcbSettings.coAccounts.length + 2 + 1 + rcbSettings.withholdingTypes.length + 1
                    }>
                      <button className="btn-primary text-xs" onClick={addEntry}>Add entry</button>
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
            ) : (
              <div className="card p-6">
                <div className="mb-4">
                  <div className="text-lg font-semibold text-gray-900">RCB Print Preview</div>
                  <div className="text-sm text-gray-600">Preview of {quarter} {financialYear} RCB</div>
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
                  >
                    {Array.from({ length: 7 }, (_, i) => String(new Date().getFullYear() - 3 + i)).map(y => (
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
                <div className="flex items-center gap-2">
                  <button className="btn-primary text-sm">Create PR</button>
                  <button className="btn-secondary text-sm">Export to Word</button>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="text-gray-600 text-sm">Purchase Requests will be implemented here. It will support PR creation, line items, attachments, status tracking, and exports.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Financial;


