import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  createSKAnnualBudget, 
  getSKAnnualBudget, 
  getAllSKAnnualBudgets, 
  updateSKAnnualBudget, 
  deleteSKAnnualBudget,
  getABYIP
} from '../services/firebaseService';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { DollarSign, Plus, Save, Trash2, Download, FileText, RefreshCw, Eye, CheckCircle, Clock, X, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { exportDocxFromTemplate, mapBudgetToTemplate } from '../services/docxExport';

// Interface definitions based on the template structure
interface BudgetReceipt {
  source_description: string;
  duration: string;
  mooe_amount: number;
  co_amount: number;
  ps_amount: number;
  total_amount: number;
}

interface BudgetItem {
  item_name: string;
  item_description: string;
  expenditure_class: 'MOOE' | 'CO' | 'PS';
  amount: number;
  duration: string;
}

interface YouthCenter {
  center_name: string;
  items: BudgetItem[];
  mooe_total: number;
  co_total: number;
  ps_total: number;
  total_amount: number;
}

interface BudgetProgram {
  program_name: string;
  program_type: 'general_administration' | 'youth_development' | 'other';
  mooe_total: number;
  co_total: number;
  ps_total: number;
  total_amount: number;
  items: BudgetItem[];
  // For youth development programs, use centers instead of items
  centers?: YouthCenter[];
}

interface SKAnnualBudget {
  id?: string;
  year: string;
  barangay_name: string;
  city_municipality: string;
  province: string;
  sk_resolution_no: string;
  sk_resolution_series?: string;
  sk_resolution_date?: Date;
  barangay_appropriation_ordinance_no: string;
  ordinance_series?: string;
  total_budget: number;
  barangay_budget_percentage: number;
  status: 'not_initiated' | 'open_for_editing' | 'pending_approval' | 'approved' | 'rejected';
  receipts: BudgetReceipt[];
  programs: BudgetProgram[];
  skMembers?: any[]; // Add SK members like ABYIP
  created_by?: string;
  created_at?: any;
  updated_at?: any;
  initiatedBy?: string;
  initiatedAt?: Date;
  submittedBy?: string;
  submittedAt?: Date;
  closedBy?: string;
  closedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
}

const Budget: React.FC = () => {
  const { user, skProfile } = useAuth();
  const [budgets, setBudgets] = useState<SKAnnualBudget[]>([]);
  const [currentBudget, setCurrentBudget] = useState<SKAnnualBudget | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [abyipData, setAbyipData] = useState<any>(null);
  const [abyipSelectionModalOpen, setAbyipSelectionModalOpen] = useState(false);
  const [selectedProgramForImport, setSelectedProgramForImport] = useState<number | null>(null);
  const [abyipProjects, setAbyipProjects] = useState<any[]>([]);
  const [selectedAbyipProjects, setSelectedAbyipProjects] = useState<number[]>([]);
  const [preview, setPreview] = useState(false);
  const [skMembers, setSkMembers] = useState<any[]>([]);
  const [saved, setSaved] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    generalAdministration: true,
    youthDevelopment: true
  });

  // Toggle section expansion
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Helper to safely parse currency-like values
  const parseCurrency = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    const str = String(value).replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // Number formatting utility functions (adapted from CBYDP)
  const formatNumber = (value: string | number): string => {
    if (!value && value !== 0) return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseNumber = (value: string): string => {
    if (!value) return '';
    // Remove commas and parse as number
    const cleaned = value.replace(/,/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return '';
    return num.toString();
  };

  const handleNumberInput = (value: string, callback: (value: string) => void) => {
    // Allow only numbers, commas, and one decimal point
    const cleaned = value.replace(/[^0-9.,]/g, '');
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return; // Invalid input
    }
    
    // Store the raw input value without formatting during typing
    // This allows natural typing flow like 1 -> 10 -> 100 -> 1000
    // Remove any existing commas to prevent conflicts
    const rawValue = cleaned.replace(/,/g, '');
    callback(rawValue);
  };

  const handleNumberDisplay = (value: string): string => {
    if (!value) return '';
    // Always format for display - this ensures 5000 shows as 5,000.00
    return formatNumber(value);
  };
  const [selectedBudgetYear, setSelectedBudgetYear] = useState<string>('');
  const [showManagement, setShowManagement] = useState(true);

  // Default budget structure based on the template
  const defaultBudget: SKAnnualBudget = {
    year: new Date().getFullYear().toString(),
    barangay_name: skProfile?.barangay || '',
    city_municipality: skProfile?.city || '',
    province: skProfile?.province || '',
    sk_resolution_no: '',
    barangay_appropriation_ordinance_no: '',
    total_budget: 0,
    barangay_budget_percentage: 10.00,
    status: 'not_initiated',
    receipts: [
      {
        source_description: 'Ten percent (10%) of the general fund of the Barangay',
        duration: 'January - December',
        mooe_amount: 0,
        co_amount: 0,
        ps_amount: 0,
        total_amount: 0
      }
    ],
    programs: [
      {
        program_name: 'General Administration Program',
        program_type: 'general_administration',
        mooe_total: 0,
        co_total: 0,
        ps_total: 0,
        total_amount: 0,
        items: []
      },
      {
        program_name: 'SK Youth Development and Empowerment Program',
        program_type: 'youth_development',
        mooe_total: 0,
        co_total: 0,
        ps_total: 0,
        total_amount: 0,
        items: [],
        centers: [
          {
            center_name: 'Center of Participation 1',
            items: [],
            mooe_total: 0,
            co_total: 0,
            ps_total: 0,
            total_amount: 0
          }
        ]
      }
    ]
  };


  // Generate year options based on SK setup
  const generateYearOptions = () => {
    if (!skProfile?.skTermStart || !skProfile?.skTermEnd) {
      // Fallback to current year ± 2 years if SK setup is not available
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());
    }
    
    const years = [];
    for (let year = skProfile.skTermStart; year <= skProfile.skTermEnd; year++) {
      years.push(year.toString());
    }
    return years;
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'not_initiated': return 'bg-gray-100 text-gray-800';
      case 'open_for_editing': return 'bg-blue-100 text-blue-800';
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Load existing budgets
  const loadBudgets = useCallback(async () => {
    try {
      setLoading(true);
      const budgetsData = await getAllSKAnnualBudgets();
      setBudgets(budgetsData as SKAnnualBudget[]);
    } catch (error) {
      console.error('Error loading budgets:', error);
      setError('Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load budget by year
  const loadBudgetByYear = useCallback(async (year: number) => {
    try {
      setLoading(true);
      const budgetData = await getSKAnnualBudget(year.toString());
      
      if (budgetData) {
        setCurrentBudget(budgetData as SKAnnualBudget);
        setIsEditing(true);
        setIsCreating(false);
      } else {
        // Try auto-populate from ABYIP for the same year
        const abyip: any = await getABYIP(year.toString());
        let derivedTotal = 0;
        if (abyip && abyip.centers) {
          try {
            derivedTotal = (abyip.centers || []).reduce((sum: number, c: any) => {
              // Prefer computed totals if present; else compute from projects budgets
              const fromCenters = (c.centerSubtotal || 0) + (c.centerSubtotalMOOE || 0) + (c.centerSubtotalCO || 0) + (c.centerSubtotalPS || 0);
              if (fromCenters > 0) return sum + fromCenters;
              const projSum = (c.projects || []).reduce((s: number, p: any) => {
                const mooe = parseFloat((p?.budget?.mooe || '0').toString().replace(/,/g, '')) || 0;
                const co = parseFloat((p?.budget?.co || '0').toString().replace(/,/g, '')) || 0;
                const ps = parseFloat((p?.budget?.ps || '0').toString().replace(/,/g, '')) || 0;
                return s + mooe + co + ps;
              }, 0);
              return sum + projSum;
            }, 0);
          } catch {}
        }

        const newBudget = {
          ...defaultBudget,
          year: year.toString(),
          barangay_name: skProfile?.barangay || '',
          city_municipality: skProfile?.city || '',
          province: skProfile?.province || '',
          total_budget: derivedTotal || defaultBudget.total_budget,
        };
        setCurrentBudget(newBudget);
        setIsEditing(true);
        setIsCreating(true);
        setAbyipData(abyip);
      }
    } catch (error) {
      console.error('Error loading budget:', error);
      setError('Failed to load budget');
    } finally {
      setLoading(false);
    }
  }, [skProfile]);

  // Save budget
  const saveBudget = async () => {
    if (!currentBudget) return;

    setSaving(true);
    try {
      const budgetData = {
        ...currentBudget,
        // Always use SK Profile data for location fields
        barangay_name: skProfile?.barangay || currentBudget.barangay_name,
        city_municipality: skProfile?.city || currentBudget.city_municipality,
        province: skProfile?.province || currentBudget.province,
        // Add SK members to the budget data (like ABYIP)
        skMembers: skMembers,
        created_by: user?.uid || ''
      };

      if (isCreating) {
        const budgetId = await createSKAnnualBudget(budgetData);
        setCurrentBudget({ ...currentBudget, id: budgetId });
      } else {
        await updateSKAnnualBudget(currentBudget.id!, budgetData);
      }

      setError('');
      setIsEditing(false);
      setIsCreating(false);
      loadBudgets();
    } catch (err) {
      console.error('Error saving budget:', err);
      setError('Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  // Load ABYIP data for import
  const loadABYIPData = useCallback(async () => {
    try {
      // Load ABYIP for the currently selected year (fallback to current year)
      const yearToLoad = selectedBudgetYear || new Date().getFullYear().toString();
      const abyip = await getABYIP(yearToLoad);
      setAbyipData(abyip);
    } catch (error) {
      console.error('Error loading ABYIP data:', error);
    }
  }, [selectedBudgetYear]);

  // Load SK members
  const loadSKMembers = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const members: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive !== false) {
          members.push({
            id: doc.id,
            name: data.name || '',
            role: data.role || '',
            email: data.email || '',
            isActive: data.isActive !== false
          });
        }
      });
      console.log('Loaded SK members:', members);
      console.log('Treasurer found:', members.find(member => member.role === 'treasurer'));
      console.log('Chairperson found:', members.find(member => member.role === 'chairperson'));
      setSkMembers(members);
    } catch (error) {
      console.error('Error loading SK members:', error);
    }
  }, []);

  // Import ABYIP projects into a selected program
  const openImportFromABYIP = (programIndex: number) => {
    if (!abyipData) return;
    const projects = (abyipData.centers || []).flatMap((c: any) => (c.projects || []).map((p: any) => ({
      ...p,
      sourceCenter: c.name || ''
    })));
    setSelectedProgramForImport(programIndex);
    setAbyipProjects(projects);
    setSelectedAbyipProjects([]);
    setAbyipSelectionModalOpen(true);
  };

  const handleImportSelectedFromABYIP = () => {
    if (selectedProgramForImport === null || !currentBudget) return;
    const selected = selectedAbyipProjects.map(idx => abyipProjects[idx]).filter(Boolean);
    const convertedItems: BudgetItem[] = selected.map((p: any) => {
      // Read budgets from multiple possible shapes
      const mooe = parseCurrency(p?.budget?.mooe ?? p?.mooe ?? p?.mooe_amount);
      const co = parseCurrency(p?.budget?.co ?? p?.co ?? p?.co_amount);
      const ps = parseCurrency(p?.budget?.ps ?? p?.ps ?? p?.ps_amount);
      const amount = mooe + co + ps;
      return {
        item_name: p.ppas || p.description || 'ABYIP Project',
        item_description: p.description || p.expectedResult || '',
        expenditure_class: 'MOOE',
        amount,
        duration: p.periodOfImplementation || ''
      } as BudgetItem;
    });

    const updatedPrograms = [...currentBudget.programs];
    updatedPrograms[selectedProgramForImport].items = [
      ...updatedPrograms[selectedProgramForImport].items,
      ...convertedItems
    ];

    const program = updatedPrograms[selectedProgramForImport];
    program.mooe_total = program.items.filter(i => i.expenditure_class === 'MOOE').reduce((s, i) => s + (i.amount || 0), 0);
    program.co_total = program.items.filter(i => i.expenditure_class === 'CO').reduce((s, i) => s + (i.amount || 0), 0);
    program.ps_total = program.items.filter(i => i.expenditure_class === 'PS').reduce((s, i) => s + (i.amount || 0), 0);
    program.total_amount = program.mooe_total + program.co_total + program.ps_total;

    setCurrentBudget({ ...currentBudget, programs: updatedPrograms });
    setAbyipSelectionModalOpen(false);
    setSelectedProgramForImport(null);
    setSelectedAbyipProjects([]);
  };

  // Submit budget for approval
  const submitBudgetForApproval = async () => {
    if (!currentBudget) return;

    setSaving(true);
    try {
      const budgetData = {
        ...currentBudget,
        status: 'pending_approval' as const,
        submittedBy: user?.name || '',
        submittedAt: new Date(),
        barangay_name: skProfile?.barangay || currentBudget.barangay_name,
        city_municipality: skProfile?.city || currentBudget.city_municipality,
        province: skProfile?.province || currentBudget.province,
        created_by: user?.uid || ''
      };

      if (isCreating) {
        const budgetId = await createSKAnnualBudget(budgetData);
        setCurrentBudget({ ...currentBudget, id: budgetId, ...budgetData });
      } else {
        await updateSKAnnualBudget(currentBudget.id!, budgetData);
        setCurrentBudget({ ...currentBudget, ...budgetData });
      }

      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadBudgets();
    } catch (err) {
      console.error('Error submitting budget:', err);
      setError('Failed to submit budget for approval');
    } finally {
      setSaving(false);
    }
  };

  // Approve budget
  const approveBudget = async () => {
    if (!currentBudget) return;

    setSaving(true);
    try {
      const budgetData = {
        ...currentBudget,
        status: 'approved' as const,
        approvedBy: user?.name || '',
        approvedAt: new Date()
      };

      await updateSKAnnualBudget(currentBudget.id!, budgetData);
      setCurrentBudget({ ...currentBudget, ...budgetData });

      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadBudgets();
    } catch (err) {
      console.error('Error approving budget:', err);
      setError('Failed to approve budget');
    } finally {
      setSaving(false);
    }
  };

  // Preview budget - Toggle inline preview
  const previewBudget = () => {
    setPreview(!preview);
  };

  // Generate HTML content for preview
  const generatePreviewContent = () => {
    if (!currentBudget) return '';
    
    // Calculate totals
    const totalReceipts = currentBudget.receipts.reduce((sum, receipt) => sum + receipt.total_amount, 0);
    const totalPrograms = currentBudget.programs.reduce((sum, program) => sum + program.total_amount, 0);
    const balance = totalReceipts - totalPrograms;
    
    // Format date for resolution
    const resolutionDate = currentBudget.sk_resolution_date ? new Date(currentBudget.sk_resolution_date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) : '_____________';
    
    return (
      <div className="bg-white p-8 max-w-5xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-right mb-2">
            <div className="text-sm border border-gray-800 p-2 inline-block">
              <div>Annex "C"</div>
              <div>Sample SK Annual Budget</div>
              <div>(COA HFTSK page 112)</div>
            </div>
          </div>
          
          <div className="text-center mb-4">
            <div className="text-sm mb-2">
              {skProfile?.logo ? (
                <img src={skProfile.logo} alt="Barangay Logo" className="w-16 h-16 mx-auto mb-2" />
              ) : (
                <span>(Barangay Logo)</span>
              )}
            </div>
            <div className="text-sm mb-1">Province of <span className="underline">{skProfile?.province || '_____________'}</span></div>
            <div className="text-sm mb-1">City of <span className="underline">{skProfile?.city || '_____________'}</span></div>
            <div className="text-sm mb-4">Barangay <span className="underline">{skProfile?.barangay || '_____________'}</span></div>
          </div>
          
          <div className="text-lg font-bold mb-2">OFFICE OF THE SANGGUNIANG KABATAAN</div>
          <div className="text-lg font-bold mb-6">SK Approved Annual Budget for CY <span className="underline">{currentBudget.year}</span></div>
        </div>

        {/* Approval Statement */}
        <div className="mb-8 text-sm leading-relaxed">
          <p>
            On <span className="underline">{resolutionDate}</span>, the SK of Barangay <span className="underline">{skProfile?.barangay || '_____________'}</span>, <span className="underline">{skProfile?.city || '_____________'}</span>, 
            through SK Resolution No. <span className="underline">{currentBudget.sk_resolution_no || '_____________'}</span> S-<span className="underline">{currentBudget.sk_resolution_series || currentBudget.year}</span>, has approved the SK Annual Budget for CY {currentBudget.year}, 
            amounting to (P <span className="underline">{formatNumber(currentBudget.total_budget)}</span>) equivalent to {currentBudget.barangay_budget_percentage || 10}% of the approved budget of Barangay <span className="underline">{skProfile?.barangay || '_____________'}</span>, <span className="underline">{skProfile?.city || '_____________'}</span>, 
            per Barangay Appropriation Ordinance No. <span className="underline">{currentBudget.barangay_appropriation_ordinance_no || '_____________'}</span>, S-<span className="underline">{currentBudget.ordinance_series || currentBudget.year}</span>.
          </p>
        </div>

        {/* Budget Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-sm" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th className="border border-gray-800 p-2 text-left font-bold" style={{ width: '15%' }}>Program</th>
                <th className="border border-gray-800 p-2 text-left font-bold" style={{ width: '35%' }}>PROJECT/ACTIVITIES (Object of Expenditures)</th>
                <th className="border border-gray-800 p-2 text-center font-bold" style={{ width: '15%' }}>Duration of Projects/Activities</th>
                <th colSpan={3} className="border border-gray-800 p-2 text-center font-bold" style={{ width: '25%' }}>Expenditure Class</th>
                <th className="border border-gray-800 p-2 text-center font-bold" style={{ width: '10%' }}>Amount</th>
              </tr>
              <tr>
                <th className="border border-gray-800 p-1"></th>
                <th className="border border-gray-800 p-1"></th>
                <th className="border border-gray-800 p-1"></th>
                <th className="border border-gray-800 p-1 text-center font-bold">MOOE</th>
                <th className="border border-gray-800 p-1 text-center font-bold">CO</th>
                <th className="border border-gray-800 p-1 text-center font-bold">PS</th>
                <th className="border border-gray-800 p-1"></th>
              </tr>
            </thead>
            <tbody>
              {/* Part I: Receipts */}
              <tr>
                <td className="border border-gray-800 p-2 font-bold">Part I. Receipts Program</td>
                <td className="border border-gray-800 p-2">
                  Ten percent ({currentBudget.barangay_budget_percentage || 10}%) of the general fund of the Barangay <span className="underline">{skProfile?.barangay || '_____________'}</span>, <span className="underline">{skProfile?.city || '_____________'}</span>
                </td>
                <td className="border border-gray-800 p-2 text-center">January - December</td>
                <td className="border border-gray-800 p-2 text-center">P {formatNumber(currentBudget.receipts.reduce((sum, r) => sum + r.mooe_amount, 0))}</td>
                <td className="border border-gray-800 p-2 text-center">P {formatNumber(currentBudget.receipts.reduce((sum, r) => sum + r.co_amount, 0))}</td>
                <td className="border border-gray-800 p-2 text-center">P {formatNumber(currentBudget.receipts.reduce((sum, r) => sum + ((r as any).ps_amount || 0), 0))}</td>
                <td className="border border-gray-800 p-2 text-center">P {formatNumber(currentBudget.receipts.reduce((sum, r) => sum + r.total_amount, 0))}</td>
              </tr>
              
              {/* Total Receipts */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 font-bold uppercase">TOTAL ESTIMATED FUNDS AVAILABLE FOR BUDGET</td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2 text-center font-bold">P {formatNumber(currentBudget.receipts.reduce((sum, r) => sum + r.mooe_amount, 0))}</td>
                <td className="border border-gray-800 p-2 text-center font-bold">P {formatNumber(currentBudget.receipts.reduce((sum, r) => sum + r.co_amount, 0))}</td>
                <td className="border border-gray-800 p-2 text-center font-bold">P {formatNumber(currentBudget.receipts.reduce((sum, r) => sum + ((r as any).ps_amount || 0), 0))}</td>
                <td className="border border-gray-800 p-2 text-center font-bold">P {formatNumber(currentBudget.receipts.reduce((sum, r) => sum + r.total_amount, 0))}</td>
              </tr>

              {/* Part II: Expenditure Program */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 font-bold">Part II. Expenditure Program</td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
              </tr>

              {/* A. General Administration Program */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 font-bold">A. General Administration Program</td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
              </tr>

              {/* Current Operating Expenditures with MOOE */}
              <tr>
                <td rowSpan={3} className="border border-gray-800 p-2 pl-6">Current Operating Expenditures (COE)</td>
                <td className="border border-gray-800 p-2">
                  <div className="font-bold mb-1">Maintenance and Other Operating Expenses (MOOE):</div>
                  {currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                    .filter(item => item.expenditure_class === 'MOOE')
                    .map((item, index) => (
                      <div key={index} className="ml-2 mb-1">
                        {item.item_name || item.item_description} - <span className="text-[12px] align-middle">P <span className="underline align-middle">{formatNumber(item.amount)}</span></span>
                      </div>
                    )) || <div className="ml-2"></div>}
                </td>
                <td className="border border-gray-800 p-2 text-center">
                  {currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                    .filter(item => item.expenditure_class === 'MOOE')
                    .map((item, index) => (
                      <div key={index} className="mb-1">{item.duration || <span className="underline">_____________</span>}</div>
                    )) || <span className="underline">_____________</span>}
                </td>
                <td className="border border-gray-800 p-2 text-center">
                  {(() => {
                    const mooeTotal = currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                    .filter(item => item.expenditure_class === 'MOOE')
                      .reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                    return mooeTotal > 0 ? 
                      (<span className="whitespace-nowrap text-[12px]">P {formatNumber(mooeTotal)}</span>) : 
                      '';
                  })()}
                </td>
                <td className="border border-gray-800 p-2 text-center">
                </td>
                <td className="border border-gray-800 p-2 text-center">
                </td>
                <td className="border border-gray-800 p-2 text-center">
                  {(() => {
                    const mooeTotal = currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                    .filter(item => item.expenditure_class === 'MOOE')
                      .reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                    return mooeTotal > 0 ? 
                      (<span className="whitespace-nowrap text-[12px]">P {formatNumber(mooeTotal)}</span>) : 
                      '';
                  })()}
                </td>
              </tr>

              {/* Capital Outlay (CO) in separate row */}
              <tr>
                <td className="border border-gray-800 p-2">
                  <div className="font-bold mb-1">Capital Outlay (CO):</div>
                  {currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                    .filter(item => item.expenditure_class === 'CO')
                    .map((item, index) => (
                      <div key={index} className="ml-2 mb-1">
                        {item.item_name || item.item_description} - <span className="text-[12px] align-middle">P <span className="underline align-middle">{formatNumber(item.amount)}</span></span>
                      </div>
                    )) || <div className="ml-2"></div>}
                </td>
                <td className="border border-gray-800 p-2 text-center">
                  {currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                    .filter(item => item.expenditure_class === 'CO')
                    .map((item, index) => (
                      <div key={index} className="mb-1">{item.duration || <span className="underline">_____________</span>}</div>
                    )) || <span className="underline">_____________</span>}
                </td>
                <td className="border border-gray-800 p-2 text-center">
                </td>
                <td className="border border-gray-800 p-2 text-center">
                  {(() => {
                    const coTotal = currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                    .filter(item => item.expenditure_class === 'CO')
                      .reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                    return coTotal > 0 ? 
                      (<span className="whitespace-nowrap text-[12px]">P {formatNumber(coTotal)}</span>) : 
                      '';
                  })()}
                </td>
                <td className="border border-gray-800 p-2 text-center">
                </td>
                <td className="border border-gray-800 p-2 text-center">
                  {(() => {
                    const coTotal = currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                      .filter(item => item.expenditure_class === 'CO')
                      .reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                    return coTotal > 0 ? 
                      (<span className="whitespace-nowrap text-[12px]">P {formatNumber(coTotal)}</span>) : 
                      '';
                  })()}
                </td>
              </tr>

              {/* Personal Services (PS) in separate row */}
              <tr>
                <td className="border border-gray-800 p-2">
                  <div className="font-bold mb-1">Personal Services (PS):</div>
                  {currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                    .filter(item => item.expenditure_class === 'PS')
                    .map((item, index) => (
                      <div key={index} className="ml-2 mb-1">
                        {item.item_name || item.item_description} - <span className="text-[12px] align-middle">P <span className="underline align-middle">{formatNumber(item.amount)}</span></span>
                      </div>
                    )) || <div className="ml-2"></div>}
                </td>
                <td className="border border-gray-800 p-2 text-center">
                  {currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                    .filter(item => item.expenditure_class === 'PS')
                    .map((item, index) => (
                      <div key={index} className="mb-1">{item.duration || <span className="underline">_____________</span>}</div>
                    )) || <span className="underline">_____________</span>}
                </td>
                <td className="border border-gray-800 p-2 text-center">
                </td>
                <td className="border border-gray-800 p-2 text-center">
                </td>
                <td className="border border-gray-800 p-2 text-center">
                  {(() => {
                    const psTotal = currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                      .filter(item => item.expenditure_class === 'PS')
                      .reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                    return psTotal > 0 ? 
                      (<span className="whitespace-nowrap text-[12px]">P {formatNumber(psTotal)}</span>) : 
                      '';
                  })()}
                </td>
                <td className="border border-gray-800 p-2 text-center">
                  {(() => {
                    const psTotal = currentBudget.programs.find(p => p.program_type === 'general_administration')?.items
                      .filter(item => item.expenditure_class === 'PS')
                      .reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                    return psTotal > 0 ? 
                      (<span className="whitespace-nowrap text-[12px]">P {formatNumber(psTotal)}</span>) : 
                      '';
                  })()}
                </td>
              </tr>

              {/* Total General Administration */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 font-bold">Total General Administration Program</td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2 text-center font-bold"></td>
                <td className="border border-gray-800 p-2 text-center font-bold"></td>
                <td className="border border-gray-800 p-2 text-center font-bold"></td>
                <td className="border border-gray-800 p-2 text-center font-bold"></td>
              </tr>

              {/* B. SK Youth Development and Empowerment Program */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 font-bold">B. SK Youth Development and Empowerment Program</td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2"></td>
              </tr>

              {/* Dynamic SK Youth Development Programs from Budget Input */}
              {currentBudget.programs
                .filter(program => program.program_type === 'youth_development')
                .map((program, programIndex) => (
                  program.centers?.map((center, centerIndex) => (
                    <tr key={`${programIndex}-${centerIndex}`}>
                      <td className="border border-gray-800 p-2 pl-6">
                        <div className="font-bold mb-1">{center.center_name}</div>
                      </td>
                      <td className="border border-gray-800 p-2">
                        {center.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="mb-2">
                            <div className="text-sm text-gray-600 mb-1">{item.item_description}</div>
                            <div className="font-bold mb-1">{itemIndex + 1}. {item.item_name}</div>
                            <div className="text-xs text-gray-500">
                              Duration: {item.duration || 'As needed'} | 
                              Amount: P {formatNumber(item.amount)} ({item.expenditure_class})
                            </div>
                          </div>
                        ))}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {center.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="mb-1">{item.duration || 'As needed'}</div>
                        ))}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {center.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="mb-1">
                            {item.expenditure_class === 'MOOE' ? (<span className="whitespace-nowrap text-[12px]">P {formatNumber(item.amount)}</span>) : ''}
                          </div>
                        ))}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {center.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="mb-1">
                            {item.expenditure_class === 'CO' ? (<span className="whitespace-nowrap text-[12px]">P {formatNumber(item.amount)}</span>) : ''}
                          </div>
                        ))}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {center.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="mb-1">
                            {item.expenditure_class === 'PS' ? (<span className="whitespace-nowrap text-[12px]">P {formatNumber(item.amount)}</span>) : ''}
                          </div>
                        ))}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {center.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="mb-1">
                            <span className="whitespace-nowrap text-[12px]">P {formatNumber(item.amount)}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))
                ))}
              

              {/* Total SK Youth Development */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 font-bold">Total SK Youth Development and Empowerment Programs</td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2 text-center font-bold">
                  {(() => {
                    const youthProgram = currentBudget.programs.find(p => p.program_type === 'youth_development');
                    const mooeTotal = youthProgram?.centers?.reduce((sum, center) => sum + center.mooe_total, 0) || 0;
                    return mooeTotal > 0 ? `P ${formatNumber(mooeTotal)}` : '';
                  })()}
                </td>
                <td className="border border-gray-800 p-2 text-center font-bold">
                  {(() => {
                    const youthProgram = currentBudget.programs.find(p => p.program_type === 'youth_development');
                    const coTotal = youthProgram?.centers?.reduce((sum, center) => sum + center.co_total, 0) || 0;
                    return coTotal > 0 ? `P ${formatNumber(coTotal)}` : '';
                  })()}
                </td>
                <td className="border border-gray-800 p-2 text-center font-bold">
                  {(() => {
                    const youthProgram = currentBudget.programs.find(p => p.program_type === 'youth_development');
                    const psTotal = youthProgram?.centers?.reduce((sum, center) => sum + center.ps_total, 0) || 0;
                    return psTotal > 0 ? `P ${formatNumber(psTotal)}` : '';
                  })()}
                </td>
                <td className="border border-gray-800 p-2 text-center font-bold">
                  {(() => {
                    const youthProgram = currentBudget.programs.find(p => p.program_type === 'youth_development');
                    const totalAmount = youthProgram?.centers?.reduce((sum, center) => sum + center.total_amount, 0) || 0;
                    return totalAmount > 0 ? `P ${formatNumber(totalAmount)}` : '';
                  })()}
                </td>
              </tr>

              {/* Total Expenditure Program */}
              <tr>
                <td colSpan={2} className="border border-gray-800 p-2 font-bold uppercase">TOTAL EXPENDITURE PROGRAM</td>
                <td className="border border-gray-800 p-2"></td>
                <td className="border border-gray-800 p-2 text-center font-bold">P {formatNumber(currentBudget.programs.reduce((sum, p) => sum + p.mooe_total, 0))}</td>
                <td className="border border-gray-800 p-2 text-center font-bold">P {formatNumber(currentBudget.programs.reduce((sum, p) => sum + p.co_total, 0))}</td>
                <td className="border border-gray-800 p-2 text-center font-bold">P {formatNumber(currentBudget.programs.reduce((sum, p) => sum + p.ps_total, 0))}</td>
                <td className="border border-gray-800 p-2 text-center font-bold">P {formatNumber(currentBudget.programs.reduce((sum, p) => sum + p.total_amount, 0))}</td>
              </tr>

              {/* Balance */}
              <tr>
                <td colSpan={6} className="border border-gray-800 p-2 font-bold uppercase">BALANCE</td>
                <td className="border border-gray-800 p-2 text-center font-bold">P {formatNumber(balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signature Blocks */}
        <div className="mt-12 mx-16 flex justify-between gap-16">
          <div className="text-center">
            <div className="mb-2">Prepared by:</div>
            <div className="mb-1">
              {(() => {
                const treasurer = skMembers.find(member => member.role === 'treasurer');
                console.log('Treasurer lookup:', treasurer);
                console.log('All members:', skMembers);
                console.log('Current user role:', user?.role);
                return treasurer ? treasurer.name : (user?.role === 'treasurer' ? user.name : 'SK Treasurer');
              })()}
            </div>
            <div className="border-b border-gray-800 w-48 mb-1"></div>
            <div className="font-bold">
              SK Treasurer
            </div>
          </div>
          <div className="text-center">
            <div className="mb-2">Noted by:</div>
            <div className="mb-1">
              {(() => {
                const chairperson = skMembers.find(member => member.role === 'chairperson');
                return chairperson ? chairperson.name : (user?.role === 'chairperson' ? user.name : 'SK Chairperson');
              })()}
            </div>
            <div className="border-b border-gray-800 w-48 mb-1"></div>
            <div className="font-bold">
              SK Chairperson
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-xs italic text-gray-600">
          Note: The phrases "Prepared by" and "Noted by", by the SK Treasurer and SK Chairperson, respectively, were added for purposes of submission of the SK Annual Budget to the DILG City/Municipal Field Office.
        </div>
      </div>
    );
  };

  // Map budget data to DOCX template format (using [[]] delimiters like ABYIP)

  // Close editing period - similar to ABYIP
  const closeEditingPeriod = async () => {
    if (!currentBudget) return;

    if (!window.confirm('Are you sure you want to close the editing period? This will prevent further edits and submit the budget for approval.')) {
      return;
    }

    setSaving(true);
    try {
      const budgetData = {
        ...currentBudget,
        status: 'pending_approval' as const,
        closedBy: user?.name || '',
        closedAt: new Date()
      };

      await updateSKAnnualBudget(currentBudget.id!, budgetData);
      setCurrentBudget({ ...currentBudget, ...budgetData });

      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadBudgets();
    } catch (err) {
      console.error('Error closing editing period:', err);
      setError('Failed to close editing period');
    } finally {
      setSaving(false);
    }
  };

  // Autosave function
  const autoSave = async (updatedBudget: SKAnnualBudget) => {
    if (!currentBudget?.id) return;
    
    try {
      const budgetData = {
        ...updatedBudget,
        // Add SK members to the budget data (like ABYIP)
        skMembers: skMembers,
        lastEditedBy: user?.name,
        lastEditedAt: new Date()
      };
      
      await updateSKAnnualBudget(currentBudget.id, budgetData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error auto-saving budget:', error);
      setError('Failed to auto-save. Please click Save Budget manually.');
    }
  };

  // Update budget field with autosave
  const updateBudgetField = (field: string, value: any) => {
    if (!currentBudget) return;
    
    const updatedBudget = { ...currentBudget, [field]: value };
    setCurrentBudget(updatedBudget);
    
    // Clear any existing timeout
    if ((window as any).budgetFieldTimeout) {
      clearTimeout((window as any).budgetFieldTimeout);
    }
    
    // Set a new timeout for auto-save
    (window as any).budgetFieldTimeout = setTimeout(async () => {
      await autoSave(updatedBudget);
    }, 2000); // Wait 2 seconds after user stops typing
  };

  // Update receipt with autosave
  const updateReceipt = (index: number, field: string, value: any) => {
    if (!currentBudget) return;
    const updatedReceipts = [...currentBudget.receipts];
    updatedReceipts[index] = { ...updatedReceipts[index], [field]: value };
    
    // Recalculate total
  if (field === 'mooe_amount' || field === 'co_amount' || field === 'ps_amount') {
      const mooe = field === 'mooe_amount' ? value : updatedReceipts[index].mooe_amount;
      const co = field === 'co_amount' ? value : updatedReceipts[index].co_amount;
    const ps = field === 'ps_amount' ? value : (updatedReceipts[index] as any).ps_amount || 0;
    updatedReceipts[index].total_amount = (mooe || 0) + (co || 0) + (ps || 0);
  }
    
    const updatedBudget = { ...currentBudget, receipts: updatedReceipts };
    setCurrentBudget(updatedBudget);
    
    // Clear any existing timeout
    if ((window as any).receiptTimeout) {
      clearTimeout((window as any).receiptTimeout);
    }
    
    // Set a new timeout for auto-save
    (window as any).receiptTimeout = setTimeout(async () => {
      await autoSave(updatedBudget);
    }, 2000); // Wait 2 seconds after user stops typing
  };

  // Update program item with autosave
  const updateProgramItem = (programIndex: number, itemIndex: number, field: string, value: any) => {
    if (!currentBudget) return;
    const updatedPrograms = [...currentBudget.programs];
    const updatedItems = [...updatedPrograms[programIndex].items];
    const normalizedValue = field === 'amount' ? (Number(value) || 0) : value;
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], [field]: normalizedValue };
    updatedPrograms[programIndex].items = updatedItems;
    
    // Recalculate program totals
    const program = updatedPrograms[programIndex];
    program.mooe_total = program.items
      .filter(item => item.expenditure_class === 'MOOE')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    program.co_total = program.items
      .filter(item => item.expenditure_class === 'CO')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    program.ps_total = program.items
      .filter(item => item.expenditure_class === 'PS')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    program.total_amount = program.mooe_total + program.co_total + program.ps_total;
    
    const updatedBudget = { ...currentBudget, programs: updatedPrograms };
    setCurrentBudget(updatedBudget);
    
    // Clear any existing timeout
    if ((window as any).programItemTimeout) {
      clearTimeout((window as any).programItemTimeout);
    }
    
    // Set a new timeout for auto-save
    (window as any).programItemTimeout = setTimeout(async () => {
      await autoSave(updatedBudget);
    }, 2000); // Wait 2 seconds after user stops typing
  };

  // Add new item to a program with autosave
  const addProgramItem = async (programIndex: number) => {
    if (!currentBudget) return;
    const updatedPrograms = [...currentBudget.programs];
    const newItem: BudgetItem = {
      item_name: '',
      item_description: '',
      expenditure_class: 'MOOE',
      amount: 0,
      duration: ''
    };
    updatedPrograms[programIndex].items = [...updatedPrograms[programIndex].items, newItem];

    const program = updatedPrograms[programIndex];
    program.mooe_total = program.items.filter(i => i.expenditure_class === 'MOOE').reduce((s, i) => s + (i.amount || 0), 0);
    program.co_total = program.items.filter(i => i.expenditure_class === 'CO').reduce((s, i) => s + (i.amount || 0), 0);
    program.ps_total = program.items.filter(i => i.expenditure_class === 'PS').reduce((s, i) => s + (i.amount || 0), 0);
    program.total_amount = program.mooe_total + program.co_total + program.ps_total;

    const updatedBudget = { ...currentBudget, programs: updatedPrograms };
    setCurrentBudget(updatedBudget);
    
    // Auto-save after adding item
    if (currentBudget.id) {
      await autoSave(updatedBudget);
    }
  };

  // Remove item from a program with autosave
  const removeProgramItem = async (programIndex: number, itemIndex: number) => {
    if (!currentBudget) return;
    const updatedPrograms = [...currentBudget.programs];
    updatedPrograms[programIndex].items = updatedPrograms[programIndex].items.filter((_, idx) => idx !== itemIndex);

    const program = updatedPrograms[programIndex];
    program.mooe_total = program.items.filter(i => i.expenditure_class === 'MOOE').reduce((s, i) => s + (i.amount || 0), 0);
    program.co_total = program.items.filter(i => i.expenditure_class === 'CO').reduce((s, i) => s + (i.amount || 0), 0);
    program.ps_total = program.items.filter(i => i.expenditure_class === 'PS').reduce((s, i) => s + (i.amount || 0), 0);
    program.total_amount = program.mooe_total + program.co_total + program.ps_total;

    const updatedBudget = { ...currentBudget, programs: updatedPrograms };
    setCurrentBudget(updatedBudget);
    
    // Auto-save after removing item
    if (currentBudget.id) {
      await autoSave(updatedBudget);
    }
  };

  // Add new center to youth development program
  const addYouthCenter = async (programIndex: number) => {
    if (!currentBudget) return;
    const updatedPrograms = [...currentBudget.programs];
    const program = updatedPrograms[programIndex];
    
    if (!program.centers) {
      program.centers = [];
    }
    
    const newCenter: YouthCenter = {
      center_name: `Center of Participation ${program.centers.length + 1}`,
      items: [],
      mooe_total: 0,
      co_total: 0,
      ps_total: 0,
      total_amount: 0
    };
    
    program.centers.push(newCenter);
    const updatedBudget = { ...currentBudget, programs: updatedPrograms };
    setCurrentBudget(updatedBudget);
    
    // Auto-save after adding center
    if (currentBudget.id) {
      await autoSave(updatedBudget);
    }
  };

  // Remove center from youth development program
  const removeYouthCenter = async (programIndex: number, centerIndex: number) => {
    if (!currentBudget) return;
    const updatedPrograms = [...currentBudget.programs];
    const program = updatedPrograms[programIndex];
    
    if (program.centers) {
      program.centers = program.centers.filter((_, idx) => idx !== centerIndex);
      
      // Recalculate program totals from centers
      program.mooe_total = program.centers.reduce((sum, center) => sum + center.mooe_total, 0);
      program.co_total = program.centers.reduce((sum, center) => sum + center.co_total, 0);
      program.ps_total = program.centers.reduce((sum, center) => sum + center.ps_total, 0);
      program.total_amount = program.mooe_total + program.co_total + program.ps_total;
    }
    
    const updatedBudget = { ...currentBudget, programs: updatedPrograms };
    setCurrentBudget(updatedBudget);
    
    // Auto-save after removing center
    if (currentBudget.id) {
      await autoSave(updatedBudget);
    }
  };

  // Add new item to a youth center
  const addYouthCenterItem = async (programIndex: number, centerIndex: number) => {
    if (!currentBudget) return;
    const updatedPrograms = [...currentBudget.programs];
    const program = updatedPrograms[programIndex];
    
    if (program.centers && program.centers[centerIndex]) {
      const center = program.centers[centerIndex];
      const newItem: BudgetItem = {
        item_name: '',
        item_description: '',
        expenditure_class: 'MOOE',
        amount: 0,
        duration: ''
      };
      
      center.items.push(newItem);
      
      // Recalculate center totals
      center.mooe_total = center.items.filter(i => i.expenditure_class === 'MOOE').reduce((s, i) => s + (i.amount || 0), 0);
      center.co_total = center.items.filter(i => i.expenditure_class === 'CO').reduce((s, i) => s + (i.amount || 0), 0);
      center.ps_total = center.items.filter(i => i.expenditure_class === 'PS').reduce((s, i) => s + (i.amount || 0), 0);
      center.total_amount = center.mooe_total + center.co_total + center.ps_total;
      
      // Recalculate program totals
      program.mooe_total = program.centers.reduce((sum, c) => sum + c.mooe_total, 0);
      program.co_total = program.centers.reduce((sum, c) => sum + c.co_total, 0);
      program.ps_total = program.centers.reduce((sum, c) => sum + c.ps_total, 0);
      program.total_amount = program.mooe_total + program.co_total + program.ps_total;
    }
    
    const updatedBudget = { ...currentBudget, programs: updatedPrograms };
    setCurrentBudget(updatedBudget);
    
    // Auto-save after adding item
    if (currentBudget.id) {
      await autoSave(updatedBudget);
    }
  };

  // Remove item from a youth center
  const removeYouthCenterItem = async (programIndex: number, centerIndex: number, itemIndex: number) => {
    if (!currentBudget) return;
    const updatedPrograms = [...currentBudget.programs];
    const program = updatedPrograms[programIndex];
    
    if (program.centers && program.centers[centerIndex]) {
      const center = program.centers[centerIndex];
      center.items = center.items.filter((_, idx) => idx !== itemIndex);
      
      // Recalculate center totals
      center.mooe_total = center.items.filter(i => i.expenditure_class === 'MOOE').reduce((s, i) => s + (i.amount || 0), 0);
      center.co_total = center.items.filter(i => i.expenditure_class === 'CO').reduce((s, i) => s + (i.amount || 0), 0);
      center.ps_total = center.items.filter(i => i.expenditure_class === 'PS').reduce((s, i) => s + (i.amount || 0), 0);
      center.total_amount = center.mooe_total + center.co_total + center.ps_total;
      
      // Recalculate program totals
      program.mooe_total = program.centers.reduce((sum, c) => sum + c.mooe_total, 0);
      program.co_total = program.centers.reduce((sum, c) => sum + c.co_total, 0);
      program.ps_total = program.centers.reduce((sum, c) => sum + c.ps_total, 0);
      program.total_amount = program.mooe_total + program.co_total + program.ps_total;
    }
    
    const updatedBudget = { ...currentBudget, programs: updatedPrograms };
    setCurrentBudget(updatedBudget);
    
    // Auto-save after removing item
    if (currentBudget.id) {
      await autoSave(updatedBudget);
    }
  };

  // Update youth center field
  const updateYouthCenter = (programIndex: number, centerIndex: number, field: string, value: any) => {
    if (!currentBudget) return;
    const updatedPrograms = [...currentBudget.programs];
    const program = updatedPrograms[programIndex];
    
    if (program.centers && program.centers[centerIndex]) {
      program.centers[centerIndex] = { ...program.centers[centerIndex], [field]: value };
    }
    
    const updatedBudget = { ...currentBudget, programs: updatedPrograms };
    setCurrentBudget(updatedBudget);
    
    // Clear any existing timeout
    if ((window as any).youthCenterTimeout) {
      clearTimeout((window as any).youthCenterTimeout);
    }
    
    // Set a new timeout for auto-save
    (window as any).youthCenterTimeout = setTimeout(async () => {
      await autoSave(updatedBudget);
    }, 2000);
  };

  // Update youth center item
  const updateYouthCenterItem = (programIndex: number, centerIndex: number, itemIndex: number, field: string, value: any) => {
    if (!currentBudget) return;
    const updatedPrograms = [...currentBudget.programs];
    const program = updatedPrograms[programIndex];
    
    if (program.centers && program.centers[centerIndex]) {
      const center = program.centers[centerIndex];
      const updatedItems = [...center.items];
      const normalizedValue = field === 'amount' ? (Number(value) || 0) : value;
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], [field]: normalizedValue };
      center.items = updatedItems;
      
      // Recalculate center totals
      center.mooe_total = center.items.filter(i => i.expenditure_class === 'MOOE').reduce((s, i) => s + (i.amount || 0), 0);
      center.co_total = center.items.filter(i => i.expenditure_class === 'CO').reduce((s, i) => s + (i.amount || 0), 0);
      center.ps_total = center.items.filter(i => i.expenditure_class === 'PS').reduce((s, i) => s + (i.amount || 0), 0);
      center.total_amount = center.mooe_total + center.co_total + center.ps_total;
      
      // Recalculate program totals
      program.mooe_total = program.centers.reduce((sum, c) => sum + c.mooe_total, 0);
      program.co_total = program.centers.reduce((sum, c) => sum + c.co_total, 0);
      program.ps_total = program.centers.reduce((sum, c) => sum + c.ps_total, 0);
      program.total_amount = program.mooe_total + program.co_total + program.ps_total;
    }
    
    const updatedBudget = { ...currentBudget, programs: updatedPrograms };
    setCurrentBudget(updatedBudget);
    
    // Clear any existing timeout
    if ((window as any).youthCenterItemTimeout) {
      clearTimeout((window as any).youthCenterItemTimeout);
    }
    
    // Set a new timeout for auto-save
    (window as any).youthCenterItemTimeout = setTimeout(async () => {
      await autoSave(updatedBudget);
    }, 2000);
  };

  // Export to Word functionality
  const exportToWord = async () => {
    if (!currentBudget) {
      alert('No budget data to export');
      return;
    }

    try {
      console.log('=== STARTING BUDGET EXPORT ===');
      
      // Map budget data to template format
      const data = mapBudgetToTemplate({
        form: currentBudget,
        skProfile: skProfile,
        skMembers: skMembers // Pass the SK members from component state
      });
      
      console.log('Mapped budget data:', data);
      
      // Use the budget template
      const templatePath = '/templates/budget_template.docx';
      console.log('Using template path:', templatePath);
      
      const outputFileName = `SK_Budget_${skProfile?.barangay || 'Document'}_${currentBudget.year || '2024'}`;
      console.log('Output filename:', outputFileName);
      
      await exportDocxFromTemplate({
        templatePath,
        data,
        outputFileName,
      });
      
      console.log('=== BUDGET EXPORT COMPLETED SUCCESSFULLY ===');
      alert('Budget document exported successfully!');
    } catch (e) {
      console.error('Budget template export failed', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      alert(`Export failed: ${errorMessage}`);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadBudgets();
    loadABYIPData();
    loadSKMembers();
  }, [loadBudgets, loadABYIPData, loadSKMembers]);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">SK Annual Budget</h1>
        <p className="text-gray-600">Manage your annual budget according to COA guidelines</p>
        </div>

      {/* Budget Management Section */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-blue-800">Budget Management</h3>
        </div>

        {/* Year Selection */}
            <div className="flex items-center space-x-4 mb-4">
              <label className="text-sm font-medium text-blue-900">Select Year:</label>
              <select
                value={selectedBudgetYear}
                onChange={(e) => {
                  const newYear = e.target.value;
                  setSelectedBudgetYear(newYear);
                  
                  if (newYear) {
                    const budgetExists = budgets.some(budget => budget.year === newYear);
                    if (budgetExists) {
                      // Automatically load existing budget
                      loadBudgetByYear(parseInt(newYear));
                    } else {
                      // Reset editing state for available years
                      setIsEditing(false);
                      setCurrentBudget(null);
                      setPreview(false);
                    }
                  } else {
                    // Reset editing state when no year selected
                    setIsEditing(false);
                    setCurrentBudget(null);
                    setPreview(false);
                  }
                }}
                className="px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a year</option>
                {generateYearOptions().map((year) => {
                  const budgetExists = budgets.some(budget => budget.year === year);
                  return (
                    <option key={year} value={year}>
                      {year} ({budgetExists ? 'Created' : 'Available'})
                    </option>
                  );
                })}
              </select>
              
              {/* Create Budget Button - Only show when no budget exists for selected year */}
              {selectedBudgetYear && !budgets.some(budget => budget.year === selectedBudgetYear) && (
                <button
                  onClick={async () => {
                    if (!selectedBudgetYear) return;
                    const updatedBudget = {
                      ...defaultBudget,
                      year: selectedBudgetYear,
                      status: 'open_for_editing' as const,
                      initiatedBy: user?.name,
                      initiatedAt: new Date(),
                      barangay_name: skProfile?.barangay || '',
                      city_municipality: skProfile?.city || '',
                      province: skProfile?.province || ''
                    };
                    setCurrentBudget(updatedBudget);
                    setIsEditing(true);
                    setIsCreating(true);
                  }}
                  className="btn-primary"
                >
                  Create Budget
                </button>
              )}

            </div>

            {/* Budget Status for Selected Year - Inside Management */}
            {selectedBudgetYear && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h5 className="text-md font-semibold text-blue-800 mb-3">Budget Status for {selectedBudgetYear}</h5>
                
                {(() => {
                  const budgetForYear = (currentBudget && currentBudget.year === selectedBudgetYear)
                    ? currentBudget
                    : budgets.find(b => b.year === selectedBudgetYear);
                  if (budgetForYear) {
                    return (
                      <>
                        {/* Status Badge and Basic Info */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(budgetForYear.status)}`}>
                              {budgetForYear.status === 'not_initiated' ? 'Not Initiated' :
                               budgetForYear.status === 'open_for_editing' ? 'Open for Editing' :
                               budgetForYear.status === 'pending_approval' ? 'Pending Approval' :
                               budgetForYear.status === 'approved' ? 'Approved' : 'Rejected'}
                            </span>
                            {budgetForYear.initiatedBy && (
                              <span className="text-sm text-blue-700">
                                Initiated by: {budgetForYear.initiatedBy}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Detailed Information Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-blue-700">Year:</span>
                            <div className="text-gray-600">{budgetForYear.year}</div>
                          </div>
                          <div>
                            <span className="font-medium text-blue-700">Budget ID:</span>
                            <div className="text-gray-600">{budgetForYear.id ? budgetForYear.id.substring(0, 8) + '...' : 'None'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-blue-700">Total Budget:</span>
                            <div className="text-gray-600">₱{formatNumber(budgetForYear.total_budget.toString())}</div>
                          </div>
                          <div>
                            <span className="font-medium text-blue-700">Created:</span>
                            <div className="text-gray-600">{budgetForYear.initiatedAt ? new Date(budgetForYear.initiatedAt).toLocaleDateString() : 'N/A'}</div>
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
                            <div className="text-gray-600">{selectedBudgetYear}</div>
                          </div>
                          <div>
                            <span className="font-medium text-blue-700">Budget ID:</span>
                            <div className="text-gray-600">None</div>
                          </div>
                          <div>
                            <span className="font-medium text-blue-700">Total Budget:</span>
                            <div className="text-gray-600">₱0.00</div>
                          </div>
                          <div>
                            <span className="font-medium text-blue-700">Created:</span>
                            <div className="text-gray-600">N/A</div>
                          </div>
                        </div>
                      </>
                    );
                  }
                })()}
                
                {/* Warning Message - Similar to ABYIP */}
                {(() => {
                  const budgetForYear = budgets.find(b => b.year === selectedBudgetYear);
                  if (!budgetForYear || budgetForYear.status === 'not_initiated') {
                    return (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center">
                          <span className="text-amber-600 mr-2">⚠️</span>
                          <span className="text-sm text-amber-800">
                            Budget for {selectedBudgetYear} has not been initiated yet. The SK Chairperson must initiate the budget to begin the process.
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

      </div>


      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center">
          <CheckCircle className="h-4 w-4 mr-2" />
          Budget auto-saved successfully!
        </div>
      )}

      {!isEditing ? (
      <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Existing Budgets</h2>
          {budgets.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Budgets Created Yet
          </h3>
              <p className="text-gray-600 mb-4">
                Create your first SK Annual Budget to get started.
              </p>
              <div className="flex gap-2 justify-center">
                <button 
                  onClick={() => loadBudgetByYear(new Date().getFullYear())}
                  className="btn-primary"
                >
                  Create Budget for {new Date().getFullYear()}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {budgets.map((budget) => (
                <div key={budget.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">SK Annual Budget {budget.year}</h3>
          <p className="text-gray-600">
                        {budget.barangay_name}, {budget.city_municipality}, {budget.province}
                      </p>
                      <p className="text-sm text-gray-500">
                        Total Budget: ₱{formatNumber(budget.total_budget)} | Status: {budget.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => loadBudgetByYear(parseInt(budget.year))}
                        className="btn-secondary flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View/Edit
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            // Map budget data to template format
                            const data = mapBudgetToTemplate({
                              form: budget,
                              skProfile: skProfile
                            });
                            
                            // Use the budget template
                            const templatePath = '/templates/budget_template.docx';
                            const outputFileName = `SK_Budget_${skProfile?.barangay || 'Document'}_${budget.year || '2024'}`;
                            
                            await exportDocxFromTemplate({
                              templatePath,
                              data,
                              outputFileName,
                            });
                            
                            alert('Budget document exported successfully!');
                          } catch (e) {
                            console.error('Budget template export failed', e);
                            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                            alert(`Export failed: ${errorMessage}`);
                          }
                        }}
                        className="btn-secondary flex items-center"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </button>
                      <button 
                        onClick={async () => {
                          if (budget.id && window.confirm('Are you sure you want to delete this budget?')) {
                            try {
                              await deleteSKAnnualBudget(budget.id);
                              loadBudgets();
                            } catch (error) {
                              setError('Failed to delete budget');
                            }
                          }
                        }}
                        className="btn-danger flex items-center"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action Buttons - Always visible */}
          <div className="mb-6 flex gap-2">
            {!currentBudget ? (
              <button
                onClick={async () => {
                  if (!selectedBudgetYear) return;
                  const updatedBudget = {
                    ...defaultBudget,
                    year: selectedBudgetYear,
                    status: 'open_for_editing' as const,
                    initiatedBy: user?.name,
                    initiatedAt: new Date(),
                    barangay_name: skProfile?.barangay || '',
                    city_municipality: skProfile?.city || '',
                    province: skProfile?.province || ''
                  };
                  setCurrentBudget(updatedBudget);
                  setIsEditing(true);
                  setIsCreating(true);
                }}
                className="btn-primary"
              >
                Initiate Budget
              </button>
            ) : currentBudget?.status === 'not_initiated' ? (
              <button
                onClick={async () => {
                  if (!selectedBudgetYear) return;
                  const updatedBudget = {
                    ...defaultBudget,
                    year: selectedBudgetYear,
                    status: 'open_for_editing' as const,
                    initiatedBy: user?.name,
                    initiatedAt: new Date(),
                    barangay_name: skProfile?.barangay || '',
                    city_municipality: skProfile?.city || '',
                    province: skProfile?.province || ''
                  };
                  setCurrentBudget(updatedBudget);
                  setIsEditing(true);
                  setIsCreating(true);
                }}
                className="btn-primary"
              >
                Initiate Budget
              </button>
            ) : (
              <>
                <button 
                  onClick={saveBudget}
                  disabled={saving}
                  className="btn-primary flex items-center"
                >
                  <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
                  {saving ? 'Saving...' : 'Save Budget'}
                </button>
                <button 
                  onClick={previewBudget}
                  className="btn-secondary flex items-center"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {preview ? 'Edit Mode' : 'Preview'}
                </button>
              </>
            )}
            <button 
              onClick={loadBudgets}
              className="btn-secondary flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            {currentBudget?.status === 'open_for_editing' && (
              <button 
                onClick={closeEditingPeriod}
                disabled={saving}
                className="btn-secondary flex items-center bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <Clock className="h-4 w-4 mr-2" />
                Close Editing Period
              </button>
            )}
            <button 
              onClick={async () => {
                if (window.confirm('Are you sure you want to reset all budgets? This action cannot be undone.')) {
                  setSaving(true);
                  try {
                    // Delete all budgets
                    for (const budget of budgets) {
                      if (budget.id) {
                        await deleteSKAnnualBudget(budget.id);
                      }
                    }
                    
                    // Reset state
                    setBudgets([]);
                    setCurrentBudget(null);
                    setIsEditing(false);
                    setIsCreating(false);
                    setError('');
                    setSaved(true);
                    setTimeout(() => setSaved(false), 3000);
                  } catch (err) {
                    console.error('Error resetting budgets:', err);
                    setError('Failed to reset budgets');
                  } finally {
                    setSaving(false);
                  }
                }
              }}
              disabled={saving}
              className="btn-secondary flex items-center bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Reset All Budgets
            </button>
            
            {/* Back to List Button - Show when editing */}
            {isEditing && (
              <button
                onClick={() => {
                  setIsEditing(false);
                  setCurrentBudget(null);
                  setPreview(false);
                }}
                className="btn-secondary flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Back to List
              </button>
            )}
            
            {/* Show Logo in Printout Checkbox */}
            <div className="flex items-center ml-4">
              <input
                type="checkbox"
                id="showLogo"
                className="mr-2"
                defaultChecked
              />
              <label htmlFor="showLogo" className="text-sm text-gray-600">
                Show Logo in Printout
              </label>
            </div>
          </div>


          {/* Main Content - Hidden when preview is active or not editing */}
          {!preview && isEditing && (
            <>
              {/* Budget Status Messages - Similar to ABYIP */}
              {currentBudget?.status === 'not_initiated' && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Budget for {currentBudget.year} has not been initiated yet. The SK Chairperson must initiate the budget to begin the process.
                </div>
              )}

              {currentBudget?.status === 'open_for_editing' && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Budget for {currentBudget.year} is open for editing. All SK members can add and edit budget items.
                </div>
              )}

              {currentBudget?.status === 'pending_approval' && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Budget for {currentBudget.year} is pending approval. The SK Chairperson must review and approve the budget.
                </div>
              )}

              {currentBudget?.status === 'approved' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Budget for {currentBudget.year} has been approved and is now read-only.
                </div>
              )}

              {currentBudget?.status === 'rejected' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
                  <X className="h-5 w-5 mr-2" />
                  Budget for {currentBudget.year} was rejected. The SK Chairperson can re-initiate the budget to start the process again.
                </div>
              )}

          {/* Budget Header Information */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Budget Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Overall Budget Amount</label>
                <input
                  type="text"
                  value={currentBudget?.total_budget?.toString() || ''}
                  onChange={(e) => {
                    handleNumberInput(e.target.value, (value) => 
                      updateBudgetField('total_budget', parseFloat(value) || 0)
                    );
                  }}
                  onBlur={(e) => {
                    // Format the number when user finishes typing
                    const formatted = handleNumberDisplay(e.target.value);
                    updateBudgetField('total_budget', parseFloat(formatted.replace(/,/g, '')) || 0);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SK Resolution No.</label>
                <input
                  type="text"
                  value={currentBudget?.sk_resolution_no || ''}
                  onChange={(e) => updateBudgetField('sk_resolution_no', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SK Resolution Series</label>
                <input
                  type="text"
                  value={currentBudget?.sk_resolution_series || ''}
                  onChange={(e) => updateBudgetField('sk_resolution_series', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2024"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SK Resolution Approval Date</label>
                <input
                  type="date"
                  value={currentBudget?.sk_resolution_date ? new Date(currentBudget.sk_resolution_date).toISOString().split('T')[0] : ''}
                  onChange={(e) => updateBudgetField('sk_resolution_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barangay Appropriation Ordinance No.</label>
                <input
                  type="text"
                  value={currentBudget?.barangay_appropriation_ordinance_no || ''}
                  onChange={(e) => updateBudgetField('barangay_appropriation_ordinance_no', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2024-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ordinance Series</label>
                <input
                  type="text"
                  value={currentBudget?.ordinance_series || ''}
                  onChange={(e) => updateBudgetField('ordinance_series', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2024"
                />
              </div>
            </div>
          </div>

          {/* Approval Buttons - Show when status is pending_approval */}
          {currentBudget?.status === 'pending_approval' && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">Budget Approval</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 mb-2">
                    Budget for {currentBudget.year} is pending approval. 
                    {currentBudget.closedBy && ` Closed by: ${currentBudget.closedBy}`}
                    {currentBudget.closedAt && ` on ${new Date(currentBudget.closedAt).toLocaleDateString()}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    Only SK Chairperson can approve or reject this budget.
                  </p>
                </div>
                {user?.role === 'chairperson' && (
                  <div className="flex gap-2">
                    <button 
                      onClick={approveBudget}
                      disabled={saving}
                      className="btn-primary flex items-center bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Budget
                    </button>
                    <button 
                      onClick={async () => {
                        if (!currentBudget) return;
                        
                        if (!window.confirm('Are you sure you want to reject this budget? This will return it to open for editing status.')) {
                          return;
                        }

                        setSaving(true);
                        try {
                          const budgetData = {
                            ...currentBudget,
                            status: 'open_for_editing' as const,
                            rejectedBy: user?.name || '',
                            rejectedAt: new Date()
                          };

                          await updateSKAnnualBudget(currentBudget.id!, budgetData);
                          setCurrentBudget({ ...currentBudget, ...budgetData });

                          setError('');
                          setSaved(true);
                          setTimeout(() => setSaved(false), 3000);
                          loadBudgets();
                        } catch (err) {
                          console.error('Error rejecting budget:', err);
                          setError('Failed to reject budget');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      className="btn-secondary flex items-center bg-red-600 hover:bg-red-700 text-white"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject Budget
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Part I: Receipts Program */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Part I: Receipts Program</h2>
            <div className="space-y-4">
              {currentBudget?.receipts.map((receipt, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Source Description</label>
                      <input
                        type="text"
                        value={receipt.source_description}
                        onChange={(e) => updateReceipt(index, 'source_description', e.target.value)}
                        disabled={currentBudget?.status !== 'open_for_editing'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                      <input
                        type="text"
                        value={receipt.duration}
                        onChange={(e) => updateReceipt(index, 'duration', e.target.value)}
                        disabled={currentBudget?.status !== 'open_for_editing'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">MOOE Amount</label>
                      <input
                        type="text"
                        value={receipt.mooe_amount.toString()}
                        onChange={(e) => {
                          handleNumberInput(e.target.value, (value) => 
                            updateReceipt(index, 'mooe_amount', parseFloat(value) || 0)
                          );
                        }}
                        onBlur={(e) => {
                          // Format the number when user finishes typing
                          const formatted = handleNumberDisplay(e.target.value);
                          updateReceipt(index, 'mooe_amount', parseFloat(formatted.replace(/,/g, '')) || 0);
                        }}
                        disabled={currentBudget?.status !== 'open_for_editing'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CO Amount</label>
                      <input
                        type="text"
                        value={receipt.co_amount.toString()}
                        onChange={(e) => {
                          handleNumberInput(e.target.value, (value) => 
                            updateReceipt(index, 'co_amount', parseFloat(value) || 0)
                          );
                        }}
                        onBlur={(e) => {
                          // Format the number when user finishes typing
                          const formatted = handleNumberDisplay(e.target.value);
                          updateReceipt(index, 'co_amount', parseFloat(formatted.replace(/,/g, '')) || 0);
                        }}
                        disabled={currentBudget?.status !== 'open_for_editing'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PS Amount</label>
                      <input
                        type="text"
                        value={(receipt as any).ps_amount?.toString?.() || '0'}
                        onChange={(e) => {
                          handleNumberInput(e.target.value, (value) => 
                            updateReceipt(index, 'ps_amount', parseFloat(value) || 0)
                          );
                        }}
                        onBlur={(e) => {
                          const formatted = handleNumberDisplay(e.target.value);
                          updateReceipt(index, 'ps_amount', parseFloat(formatted.replace(/,/g, '')) || 0);
                        }}
                        disabled={currentBudget?.status !== 'open_for_editing'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                      <input
                        type="text"
                        value={handleNumberDisplay((((receipt as any).mooe_amount || 0) + ((receipt as any).co_amount || 0) + (((receipt as any).ps_amount) || 0)).toString())}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Part II: Expenditure Program */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Part II: Expenditure Program</h2>
            <div className="space-y-6">
              {currentBudget?.programs.map((program, programIndex) => (
                <div key={programIndex} className="border rounded-lg p-4">
                  {/* Collapsible Header */}
                  <div 
                    className="flex items-center justify-between cursor-pointer mb-4"
                    onClick={() => toggleSection(program.program_type === 'general_administration' ? 'generalAdministration' : 'youthDevelopment')}
                  >
                    <h3 className="text-lg font-semibold">{program.program_name}</h3>
                    {expandedSections[program.program_type === 'general_administration' ? 'generalAdministration' : 'youthDevelopment'] ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  
                  {/* Collapsible Content */}
                  {expandedSections[program.program_type === 'general_administration' ? 'generalAdministration' : 'youthDevelopment'] && (
                    <>
                  
                  {program.program_type === 'youth_development' ? (
                    // Youth Development Program with Centers
                    <div className="space-y-6">
                      {program.centers?.map((center, centerIndex) => (
                        <div key={centerIndex} className="border rounded-lg p-4 bg-blue-50">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex-1 mr-4">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Center of Participation</label>
                              <input
                                type="text"
                                value={center.center_name}
                                onChange={(e) => updateYouthCenter(programIndex, centerIndex, 'center_name', e.target.value)}
                                disabled={currentBudget?.status !== 'open_for_editing'}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter center name"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeYouthCenter(programIndex, centerIndex)}
                              disabled={currentBudget?.status !== 'open_for_editing' || (program.centers?.length || 0) <= 1}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove Center
                            </button>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => addYouthCenterItem(programIndex, centerIndex)}
                                disabled={currentBudget?.status !== 'open_for_editing'}
                                className="btn-secondary text-sm"
                              >
                                + Add Item
                              </button>
                            </div>
                            
                            {center.items.map((item, itemIndex) => (
                              <div key={itemIndex} className="border rounded p-3 bg-white">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                                    <input
                                      type="text"
                                      value={item.item_name}
                                      onChange={(e) => updateYouthCenterItem(programIndex, centerIndex, itemIndex, 'item_name', e.target.value)}
                                      disabled={currentBudget?.status !== 'open_for_editing'}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder="Enter item name"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Expenditure Class</label>
                                    <select
                                      value={item.expenditure_class}
                                      onChange={(e) => updateYouthCenterItem(programIndex, centerIndex, itemIndex, 'expenditure_class', e.target.value)}
                                      disabled={currentBudget?.status !== 'open_for_editing'}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      <option value="MOOE">MOOE</option>
                                      <option value="CO">CO</option>
                                      <option value="PS">PS</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                                    <input
                                      type="text"
                                      value={item.amount.toString()}
                                      onChange={(e) => {
                                        handleNumberInput(e.target.value, (value) => 
                                          updateYouthCenterItem(programIndex, centerIndex, itemIndex, 'amount', parseFloat(value) || 0)
                                        );
                                      }}
                                      onBlur={(e) => {
                                        const formatted = handleNumberDisplay(e.target.value);
                                        updateYouthCenterItem(programIndex, centerIndex, itemIndex, 'amount', parseFloat(formatted.replace(/,/g, '')) || 0);
                                      }}
                                      disabled={currentBudget?.status !== 'open_for_editing'}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                                    <input
                                      type="text"
                                      value={item.duration}
                                      onChange={(e) => updateYouthCenterItem(programIndex, centerIndex, itemIndex, 'duration', e.target.value)}
                                      disabled={currentBudget?.status !== 'open_for_editing'}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder="e.g., January - March"
                                    />
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                  <input
                                    type="text"
                                    value={item.item_description}
                                    onChange={(e) => updateYouthCenterItem(programIndex, centerIndex, itemIndex, 'item_description', e.target.value)}
                                    disabled={currentBudget?.status !== 'open_for_editing'}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter item description"
                                  />
                                </div>
                                <div className="mt-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => removeYouthCenterItem(programIndex, centerIndex, itemIndex)}
                                    disabled={currentBudget?.status !== 'open_for_editing'}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                  >
                                    Remove Item
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Center Totals */}
                          <div className="mt-4 p-3 bg-blue-100 rounded">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">MOOE Total</label>
                                <input
                                  type="text"
                                  value={handleNumberDisplay(center.mooe_total.toString())}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                  readOnly
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">CO Total</label>
                                <input
                                  type="text"
                                  value={handleNumberDisplay(center.co_total.toString())}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                  readOnly
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">PS Total</label>
                                <input
                                  type="text"
                                  value={handleNumberDisplay(center.ps_total.toString())}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                  readOnly
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                                <input
                                  type="text"
                                  value={handleNumberDisplay(center.total_amount.toString())}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                  readOnly
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => addYouthCenter(programIndex)}
                          disabled={currentBudget?.status !== 'open_for_editing'}
                          className="btn-secondary text-sm"
                        >
                          + Add Center of Participation
                        </button>
                      </div>
                    </div>
                  ) : (
                    // General Administration Program (existing structure)
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => addProgramItem(programIndex)}
                        disabled={currentBudget?.status !== 'open_for_editing'}
                        className="btn-secondary text-sm"
                      >
                        + Add Item
                      </button>
                    </div>
                    {abyipData && (
                      <div className="flex justify-end -mt-2">
                        <button
                          type="button"
                          onClick={() => openImportFromABYIP(programIndex)}
                          disabled={currentBudget?.status !== 'open_for_editing'}
                          className="btn-secondary text-sm"
                        >
                          Import from ABYIP
                        </button>
                      </div>
                    )}
                    {program.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="border rounded p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                            <input
                              type="text"
                              value={item.item_name}
                              onChange={(e) => updateProgramItem(programIndex, itemIndex, 'item_name', e.target.value)}
                                disabled={currentBudget?.status !== 'open_for_editing'}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Expenditure Class</label>
                            <select
                              value={item.expenditure_class}
                              onChange={(e) => updateProgramItem(programIndex, itemIndex, 'expenditure_class', e.target.value)}
                                disabled={currentBudget?.status !== 'open_for_editing'}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="MOOE">MOOE</option>
                              <option value="CO">CO</option>
                              <option value="PS">PS</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                            <input
                              type="text"
                              value={item.amount.toString()}
                              onChange={(e) => {
                                handleNumberInput(e.target.value, (value) => 
                                  updateProgramItem(programIndex, itemIndex, 'amount', parseFloat(value) || 0)
                                );
                              }}
                              onBlur={(e) => {
                                const formatted = handleNumberDisplay(e.target.value);
                                updateProgramItem(programIndex, itemIndex, 'amount', parseFloat(formatted.replace(/,/g, '')) || 0);
                              }}
                                disabled={currentBudget?.status !== 'open_for_editing'}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                            <input
                              type="text"
                              value={item.duration}
                              onChange={(e) => updateProgramItem(programIndex, itemIndex, 'duration', e.target.value)}
                                disabled={currentBudget?.status !== 'open_for_editing'}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        {item.item_description && (
                          <div className="mt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <input
                              type="text"
                              value={item.item_description}
                              onChange={(e) => updateProgramItem(programIndex, itemIndex, 'item_description', e.target.value)}
                                disabled={currentBudget?.status !== 'open_for_editing'}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeProgramItem(programIndex, itemIndex)}
                            disabled={currentBudget?.status !== 'open_for_editing'}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove Item
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* Program Totals */}
                  <div className="mt-4 p-3 bg-gray-50 rounded">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">MOOE Total</label>
                        <input
                          type="text"
                          value={handleNumberDisplay(program.mooe_total.toString())}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CO Total</label>
                        <input
                          type="text"
                          value={handleNumberDisplay(program.co_total.toString())}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PS Total</label>
                        <input
                          type="text"
                          value={handleNumberDisplay(program.ps_total.toString())}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                        <input
                          type="text"
                          value={handleNumberDisplay(program.total_amount.toString())}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                    </>
                  )}
                </div>
              ))}
        </div>
      </div>
      {/* ABYIP Project Selection Modal */}
      {abyipSelectionModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6">
            <h3 className="text-lg font-semibold mb-4">Select Projects from ABYIP</h3>
            {!abyipProjects.length ? (
              <div className="text-sm text-gray-600">No projects found in ABYIP for this year.</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {abyipProjects.map((project, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 border rounded-md">
                    <input
                      type="checkbox"
                      checked={selectedAbyipProjects.includes(index)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAbyipProjects(prev => [...prev, index]);
                        } else {
                          setSelectedAbyipProjects(prev => prev.filter(i => i !== index));
                        }
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{project.ppas || project.description || 'Untitled Project'}</div>
                      <div className="text-xs text-gray-500">Center: {project.sourceCenter || 'N/A'}</div>
                      <div className="text-xs text-gray-500 mt-1">Period: {project.periodOfImplementation || 'N/A'}</div>
                    </div>
                    <div className="text-xs text-gray-600">
                      Amount: ₱{(
                        (parseFloat((project?.budget?.mooe || '0').toString().replace(/,/g, '')) || 0) +
                        (parseFloat((project?.budget?.co || '0').toString().replace(/,/g, '')) || 0) +
                        (parseFloat((project?.budget?.ps || '0').toString().replace(/,/g, '')) || 0)
                      ).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end space-x-3">
              <button className="btn-secondary" onClick={() => setAbyipSelectionModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleImportSelectedFromABYIP} disabled={selectedAbyipProjects.length === 0}>Import Selected</button>
        </div>
      </div>
        </div>
      )}

              </>
            )}

            {/* Preview Section - Show when preview is true */}
            {preview && currentBudget && (
              <div className="space-y-6">
                {/* Print Preview */}
                <div className="bg-white border rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Print Preview</h3>
                    <div className="flex space-x-3">
                      <button
                        onClick={exportToWord}
                        className="btn-secondary flex items-center"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export to Word
                      </button>
                    </div>
                  </div>
                  
                  {/* Note about printing process */}
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Note about printing:</p>
                        <p className="text-sm mt-1">
                          To print the SK Annual Budget, you must first export it to Word, then manually add the logo to the downloaded document, and then print from there.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {generatePreviewContent()}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default Budget; 