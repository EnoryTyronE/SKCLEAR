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
import { DollarSign, Plus, Save, Trash2, Download, FileText, RefreshCw, Eye, CheckCircle, Clock, X } from 'lucide-react';

// Interface definitions based on the template structure
interface BudgetReceipt {
  source_description: string;
  duration: string;
  mooe_amount: number;
  co_amount: number;
  total_amount: number;
}

interface BudgetItem {
  item_name: string;
  item_description: string;
  expenditure_class: 'MOOE' | 'CO' | 'PS';
  amount: number;
  duration: string;
}

interface BudgetProgram {
  program_name: string;
  program_type: 'general_administration' | 'youth_development' | 'other';
  mooe_total: number;
  co_total: number;
  ps_total: number;
  total_amount: number;
  items: BudgetItem[];
}

interface SKAnnualBudget {
  id?: string;
  year: string;
  barangay_name: string;
  city_municipality: string;
  province: string;
  sk_resolution_no: string;
  barangay_appropriation_ordinance_no: string;
  total_budget: number;
  barangay_budget_percentage: number;
  status: 'not_initiated' | 'open_for_editing' | 'pending_approval' | 'approved' | 'rejected';
  receipts: BudgetReceipt[];
  programs: BudgetProgram[];
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

  // Helper to safely parse currency-like values
  const parseCurrency = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    const str = String(value).replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };
  const [selectedBudgetYear, setSelectedBudgetYear] = useState<string>('');
  const [showManagement, setShowManagement] = useState(true);
  const [saved, setSaved] = useState(false);

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
        items: []
      }
    ]
  };

  // Number formatting utility functions
  const formatNumber = (value: string | number): string => {
    if (!value && value !== 0) return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseNumber = (value: string): string => {
    if (!value) return '';
    const cleaned = value.replace(/,/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return '';
    return num.toString();
  };

  const handleNumberInput = (value: string, callback: (value: string) => void) => {
    const cleaned = value.replace(/[^0-9.,]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    
    const rawValue = cleaned.replace(/,/g, '');
    callback(rawValue);
  };

  const handleNumberDisplay = (value: string): string => {
    if (!value) return '';
    return formatNumber(value);
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

  // Preview budget - Export to DOCX like ABYIP
  const previewBudget = async () => {
    if (!currentBudget) return;
    
    try {
      console.log('=== BUDGET EXPORT STARTED ===');
      console.log('Budget data before export:', currentBudget);
      console.log('SK Profile data:', skProfile);
      console.log('Current user:', user);
      
      // Create comprehensive payload with multiple data sources
      const payload = {
        form: currentBudget,
        skProfile,
        user,
        // Add any additional context that might help
        timestamp: new Date().toISOString(),
        exportType: 'BUDGET'
      };
      
      // Import the export function
      const { exportDocxFromTemplate } = await import('../services/docxExport');
      
      // Map budget data to template format
      const data = mapBudgetToTemplate(payload);
      console.log('Budget mapped data for export:', data);
      
      // Verify template path exists
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
      alert(`Failed to export Budget Word document: ${errorMessage}`);
    }
  };

  // Map budget data to template format (similar to ABYIP mapping)
  const mapBudgetToTemplate = (payload: any) => {
    console.log('Mapping Budget data:', payload);
    
    const budget = payload.form;
    const skProfile = payload.skProfile;
    
    // Get member names from SK Profile
    const memberNames = {
      secretary: skProfile?.skMembers?.find((m: any) => 
        m.position === 'SK Secretary' || m.role === 'secretary'
      ) || { name: 'Secretary Name', position: 'SK Secretary' },
      chairperson: skProfile?.skMembers?.find((m: any) => 
        m.position === 'SK Chairperson' || m.role === 'chairperson'
      ) || { name: 'Chairperson Name', position: 'SK Chairperson' },
      treasurer: skProfile?.skMembers?.find((m: any) => 
        m.position === 'SK Treasurer' || m.role === 'treasurer'
      ) || { name: 'Treasurer Name', position: 'SK Treasurer' },
    };
    
    const result = {
      logo: skProfile?.logo || '',
      barangay: skProfile?.barangay || '',
      region: skProfile?.region || '',
      province: skProfile?.province || '',
      city: skProfile?.city || '',
      year: budget?.year || '',
      sk_resolution_no: budget?.sk_resolution_no || '',
      barangay_appropriation_ordinance_no: budget?.barangay_appropriation_ordinance_no || '',
      
      // Receipts data
      receipts: budget?.receipts || [],
      
      // Programs data
      programs: budget?.programs || [],
      
      // Totals
      total_budget: budget?.total_budget || 0,
      
      // Prepared by section
      prepared_by: {
        secretary: String(memberNames.secretary?.name || ''),
        chairperson: String(memberNames.chairperson?.name || ''),
        treasurer: String(memberNames.treasurer?.name || ''),
      },
      
      // Flattened structure for template compatibility
      'prepared_by.secretary': String(memberNames.secretary?.name || ''),
      'prepared_by.chairperson': String(memberNames.chairperson?.name || ''),
      'prepared_by.treasurer': String(memberNames.treasurer?.name || ''),
    };
    
    console.log('Final Budget mapped data:', result);
    return result;
  };

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

  // Update budget field
  const updateBudgetField = (field: string, value: any) => {
    if (!currentBudget) return;
    setCurrentBudget({ ...currentBudget, [field]: value });
  };

  // Update receipt
  const updateReceipt = (index: number, field: string, value: any) => {
    if (!currentBudget) return;
    const updatedReceipts = [...currentBudget.receipts];
    updatedReceipts[index] = { ...updatedReceipts[index], [field]: value };
    
    // Recalculate total
    if (field === 'mooe_amount' || field === 'co_amount') {
      const mooe = field === 'mooe_amount' ? value : updatedReceipts[index].mooe_amount;
      const co = field === 'co_amount' ? value : updatedReceipts[index].co_amount;
      updatedReceipts[index].total_amount = mooe + co;
    }
    
    setCurrentBudget({ ...currentBudget, receipts: updatedReceipts });
  };

  // Update program item
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
    
    setCurrentBudget({ ...currentBudget, programs: updatedPrograms });
  };

  // Add new item to a program
  const addProgramItem = (programIndex: number) => {
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

    setCurrentBudget({ ...currentBudget, programs: updatedPrograms });
  };

  // Remove item from a program
  const removeProgramItem = (programIndex: number, itemIndex: number) => {
    if (!currentBudget) return;
    const updatedPrograms = [...currentBudget.programs];
    updatedPrograms[programIndex].items = updatedPrograms[programIndex].items.filter((_, idx) => idx !== itemIndex);

    const program = updatedPrograms[programIndex];
    program.mooe_total = program.items.filter(i => i.expenditure_class === 'MOOE').reduce((s, i) => s + (i.amount || 0), 0);
    program.co_total = program.items.filter(i => i.expenditure_class === 'CO').reduce((s, i) => s + (i.amount || 0), 0);
    program.ps_total = program.items.filter(i => i.expenditure_class === 'PS').reduce((s, i) => s + (i.amount || 0), 0);
    program.total_amount = program.mooe_total + program.co_total + program.ps_total;

    setCurrentBudget({ ...currentBudget, programs: updatedPrograms });
  };

  // Load data on component mount
  useEffect(() => {
    loadBudgets();
    loadABYIPData();
  }, [loadBudgets, loadABYIPData]);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">SK Annual Budget</h1>
        <p className="text-gray-600">Manage your annual budget according to COA guidelines</p>
        </div>

      {/* Budget Management Section */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-blue-800">Budget Management</h3>
          <button
            onClick={() => setShowManagement(!showManagement)}
            className="btn-secondary flex items-center"
          >
            <Eye className="h-4 w-4 mr-2" />
            {showManagement ? 'Hide' : 'Show'} Management
        </button>
      </div>

        {showManagement && (
          <>
            {/* Year Selection */}
            <div className="flex items-center space-x-4 mb-4">
              <label className="text-sm font-medium text-blue-900">Select Year:</label>
              <select
                value={selectedBudgetYear}
                onChange={(e) => {
                  const newYear = e.target.value;
                  setSelectedBudgetYear(newYear);
                  // Load budget for the new year
                  if (newYear) {
                    loadBudgetByYear(parseInt(newYear));
                  }
                }}
                className="px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a year</option>
                {generateYearOptions().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              
              {/* Initiate button removed from here (initiation handled in action bar) */}
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

            {/* Budget Status Overview - Show all budgets */}
            {budgets.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {budgets.map((budget) => (
                  <div key={budget.id} className="bg-white p-4 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900">Budget {budget.year}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(budget.status)}`}>
                        {budget.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Total: ₱{formatNumber(budget.total_budget.toString())}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadBudgetByYear(parseInt(budget.year))}
                        className="btn-secondary text-xs flex items-center"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </button>
                      {budget.status === 'open_for_editing' && (
                        <button
                          onClick={() => loadBudgetByYear(parseInt(budget.year))}
                          className="btn-primary text-xs flex items-center"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>


      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          Budget saved successfully!
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
                        onClick={() => {/* TODO: Export functionality */}}
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
          {/* Action Buttons - Moved to top of Budget Information */}
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
                  Preview
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

          {/* Informational Message - Similar to ABYIP */}
          {currentBudget && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">ℹ️</span>
                <span className="text-sm text-blue-800">
                  Budget for {currentBudget.year} is {currentBudget.status === 'open_for_editing' ? 'open for editing' : currentBudget.status}. 
                  {currentBudget.status === 'open_for_editing' ? ' All SK members can add and edit budget items.' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Budget Header Information */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Budget Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="text"
                  value={currentBudget?.year || ''}
                  onChange={(e) => updateBudgetField('year', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barangay Name</label>
                <input
                  type="text"
                  value={skProfile?.barangay || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">Fetched from SK Profile</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City/Municipality</label>
                <input
                  type="text"
                  value={skProfile?.city || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">Fetched from SK Profile</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                <input
                  type="text"
                  value={skProfile?.province || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">Fetched from SK Profile</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SK Resolution No.</label>
                <input
                  type="text"
                  value={currentBudget?.sk_resolution_no || ''}
                  onChange={(e) => updateBudgetField('sk_resolution_no', e.target.value)}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        value={handleNumberDisplay(receipt.mooe_amount.toString())}
                        onChange={(e) => {
                          handleNumberInput(e.target.value, (value) => 
                            updateReceipt(index, 'mooe_amount', parseFloat(value) || 0)
                          );
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
                        value={handleNumberDisplay(receipt.co_amount.toString())}
                        onChange={(e) => {
                          handleNumberInput(e.target.value, (value) => 
                            updateReceipt(index, 'co_amount', parseFloat(value) || 0)
                          );
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
                        value={handleNumberDisplay(receipt.total_amount.toString())}
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
                  <h3 className="text-lg font-semibold mb-4">{program.program_name}</h3>
                  
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Expenditure Class</label>
                            <select
                              value={item.expenditure_class}
                              onChange={(e) => updateProgramItem(programIndex, itemIndex, 'expenditure_class', e.target.value)}
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
                              value={handleNumberDisplay(item.amount.toString())}
                              onChange={(e) => {
                                handleNumberInput(e.target.value, (value) => 
                                  updateProgramItem(programIndex, itemIndex, 'amount', parseFloat(value) || 0)
                                );
                              }}
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
        </div>
      )}
    </div>
  );
};

export default Budget; 