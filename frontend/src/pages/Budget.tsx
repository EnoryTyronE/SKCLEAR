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
import { DollarSign, Plus, Save, Trash2, Download, FileText, RefreshCw, Eye, CheckCircle } from 'lucide-react';

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
  approvedBy?: string;
  approvedAt?: Date;
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
        items: [
          { item_name: 'Travelling Expenses', item_description: '', expenditure_class: 'MOOE', amount: 0, duration: 'January - December (as needed)' },
          { item_name: 'Office Supplies Expenses', item_description: '', expenditure_class: 'MOOE', amount: 0, duration: 'January - December (as needed)' },
          { item_name: 'Water Expenses', item_description: '', expenditure_class: 'MOOE', amount: 0, duration: 'January - December (as needed)' },
          { item_name: 'Electricity Expenses', item_description: '', expenditure_class: 'MOOE', amount: 0, duration: 'January - December (as needed)' },
          { item_name: 'Advertising Expenses', item_description: '', expenditure_class: 'MOOE', amount: 0, duration: 'January - December (as needed)' },
          { item_name: 'Office Equipment', item_description: '', expenditure_class: 'CO', amount: 0, duration: 'January - December (as needed)' }
        ]
      },
      {
        program_name: 'SK Youth Development and Empowerment Program',
        program_type: 'youth_development',
        mooe_total: 0,
        co_total: 0,
        ps_total: 0,
        total_amount: 0,
        items: [
          { item_name: 'Skills training, summer employment, on-the-job training, and livelihood assistance', item_description: 'Livelihood projects for out-of-school youth', expenditure_class: 'MOOE', amount: 0, duration: 'March - June' },
          { item_name: 'Sports and wellness projects', item_description: 'Sports Activity/BIDA Initiatives', expenditure_class: 'MOOE', amount: 0, duration: 'April - May (as needed)' },
          { item_name: 'Capacity-building for grassroots organization and leadership', item_description: 'Seminar on the Handbook on the Financial Transaction of the Sangguniang Kabataan', expenditure_class: 'MOOE', amount: 0, duration: 'January - March' },
          { item_name: 'Health Programs', item_description: 'Youth Health Awareness Campaign', expenditure_class: 'MOOE', amount: 0, duration: 'January - December (as needed)' },
          { item_name: 'Education Support', item_description: 'School Supplies Distribution', expenditure_class: 'MOOE', amount: 0, duration: 'January - December (as needed)' },
          { item_name: 'Environmental Projects', item_description: 'Tree Planting Activity', expenditure_class: 'CO', amount: 0, duration: 'January - December (as needed)' }
        ]
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
        // Create new budget for the year with SK Profile data
        const newBudget = {
          ...defaultBudget,
          year: year.toString(),
          barangay_name: skProfile?.barangay || '',
          city_municipality: skProfile?.city || '',
          province: skProfile?.province || ''
        };
        setCurrentBudget(newBudget);
        setIsEditing(true);
        setIsCreating(true);
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
      const abyip = await getABYIP(user?.uid || '');
      setAbyipData(abyip);
    } catch (error) {
      console.error('Error loading ABYIP data:', error);
    }
  }, [user]);

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
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], [field]: value };
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
              
              {/* Create New Budget Button */}
              {selectedBudgetYear && !budgets.some(budget => budget.year === selectedBudgetYear) && (
                <button
                  onClick={async () => {
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
                  className="btn-primary flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Budget for {selectedBudgetYear}
                </button>
              )}
            </div>

            {/* Budget Status Overview */}
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

          {/* Status Management Buttons */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Budget Status</h2>
                <p className="text-gray-600">Current status: <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(currentBudget?.status || 'not_initiated')}`}>
                  {currentBudget?.status?.replace('_', ' ').toUpperCase() || 'NOT INITIATED'}
                </span></p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setImportModalOpen(true)}
                  className="btn-secondary flex items-center"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Import from ABYIP
                </button>
                <button 
                  onClick={saveBudget}
                  disabled={saving}
                  className="btn-primary flex items-center"
                >
                  <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
                  {saving ? 'Saving...' : 'Save Budget'}
                </button>
                {currentBudget?.status === 'open_for_editing' && (
                  <button 
                    onClick={submitBudgetForApproval}
                    disabled={saving}
                    className="btn-primary flex items-center bg-yellow-600 hover:bg-yellow-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit for Approval
                  </button>
                )}
                {currentBudget?.status === 'pending_approval' && user?.role === 'admin' && (
                  <button 
                    onClick={approveBudget}
                    disabled={saving}
                    className="btn-primary flex items-center bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Budget
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setIsCreating(false);
                    setCurrentBudget(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                      <input
                        type="text"
                        value={receipt.duration}
                        onChange={(e) => updateReceipt(index, 'duration', e.target.value)}
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
        </div>
      )}
    </div>
  );
};

export default Budget; 