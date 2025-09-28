import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createABYIP, getABYIP, updateABYIP, deleteABYIP, uploadFile, getCBYDP, getAllABYIPs, clearAllABYIPs } from '../services/firebaseService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { FileText, Plus, Trash2, Save, Eye, CheckCircle, AlertCircle, RefreshCw, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { exportDocxFromTemplate, mapABYIPToTemplate } from '../services/docxExport';
import { logABYIPActivity } from '../services/activityService';

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
  status: 'not_initiated' | 'open_for_editing' | 'pending_kk_approval' | 'approved' | 'rejected';
  isEditingOpen: boolean;
  year: string;
  yearlyBudget: string; // Total budget for the year
  initiatedBy?: string;
  initiatedAt?: Date;
  closedBy?: string;
  closedAt?: Date;
  kkApprovedBy?: string;
  kkApprovedAt?: Date;
  kkProofImage?: string;
  lastEditedBy?: string;
  lastEditedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
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
    centers: [],
    skMembers: [],
    showLogoInPrint: true,
    status: 'not_initiated',
    isEditingOpen: false,
    year: new Date().getFullYear().toString(),
    yearlyBudget: '',
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
  const [projectSelectionModalOpen, setProjectSelectionModalOpen] = useState(false);
  const [selectedCenterForProject, setSelectedCenterForProject] = useState<number | null>(null);
  const [cbydpProjects, setCbydpProjects] = useState<any[]>([]);
  const [cbydpCentersForProjects, setCbydpCentersForProjects] = useState<any[]>([]);
  const [selectedCbydpProjects, setSelectedCbydpProjects] = useState<number[]>([]);
  const [expandedCenters, setExpandedCenters] = useState<{[key: number]: boolean}>({});
  
  // Toggle center expansion
  const toggleCenter = (centerIndex: number) => {
    setExpandedCenters(prev => ({
      ...prev,
      [centerIndex]: !prev[centerIndex]
    }));
  };

  // Initialize expanded state for all centers (default to expanded)
  useEffect(() => {
    const initialExpandedState: {[key: number]: boolean} = {};
    form.centers.forEach((_, index) => {
      initialExpandedState[index] = true;
    });
    setExpandedCenters(initialExpandedState);
  }, [form.centers.length]);
  
  const [kkProofFile, setKkProofFile] = useState<File | null>(null);
  const [kkProofImage, setKkProofImage] = useState<string>('');
  const [kkApprovalDate, setKkApprovalDate] = useState<string>('');
  const [showKKApprovalModal, setShowKKApprovalModal] = useState(false);
  const [showManagement, setShowManagement] = useState(false);

  // Helper functions to create mandatory centers
  const createAdministrativeServiceCenter = (): ABYIPCenter => ({
    name: 'Administrative Service',
    agenda: 'Administrative and operational expenses for SK operations',
    projects: [
      {
        referenceCode: 'ADM001',
        ppas: 'Honoraria',
        description: 'Monthly honoraria for SK officials',
        expectedResult: 'Proper compensation for SK officials',
        performanceIndicator: 'Number of officials receiving honoraria',
        periodOfImplementation: 'January - December',
        budget: { mooe: '', co: '', ps: '', total: '' },
        personResponsible: 'SK Treasurer',
      },
      {
        referenceCode: 'ADM002',
        ppas: 'Membership Dues and Contribution',
        description: 'Annual membership dues and contributions to SK Federation',
        expectedResult: 'Active membership in SK Federation',
        performanceIndicator: 'Payment of membership dues',
        periodOfImplementation: 'January - December',
        budget: { mooe: '', co: '', ps: '', total: '' },
        personResponsible: 'SK Treasurer',
      },
      {
        referenceCode: 'ADM003',
        ppas: 'Fidelity Bond Premiums',
        description: 'Annual fidelity bond premiums for SK officials',
        expectedResult: 'Protected SK funds and assets',
        performanceIndicator: 'Valid fidelity bond coverage',
        periodOfImplementation: 'January - December',
        budget: { mooe: '', co: '', ps: '', total: '' },
        personResponsible: 'SK Treasurer',
      },
    ],
  });

  const createGovernanceCenter = (): ABYIPCenter => ({
    name: 'Governance / Active Citizenship',
    agenda: 'Youth governance and active citizenship programs',
    projects: [
      {
        referenceCode: 'GOV001',
        ppas: 'Linggo ng Kabataan',
        description: 'Annual celebration of Linggo ng Kabataan',
        expectedResult: 'Successful celebration of youth week',
        performanceIndicator: 'Number of participants and activities',
        periodOfImplementation: 'March - April',
        budget: { mooe: '', co: '', ps: '', total: '' },
        personResponsible: 'SK Chairperson',
      },
      {
        referenceCode: 'GOV002',
        ppas: 'PYO COA Training',
        description: 'Training on Commission on Audit requirements for PYO',
        expectedResult: 'Compliant financial management',
        performanceIndicator: 'Number of officials trained',
        periodOfImplementation: 'January - December',
        budget: { mooe: '', co: '', ps: '', total: '' },
        personResponsible: 'SK Treasurer',
      },
      {
        referenceCode: 'GOV003',
        ppas: 'Leadership Development Workshops',
        description: 'Capacity building workshops for SK officials and youth leaders',
        expectedResult: 'Enhanced leadership skills of youth',
        performanceIndicator: 'Number of participants trained',
        periodOfImplementation: 'January - December',
        budget: { mooe: '', co: '', ps: '', total: '' },
        personResponsible: 'SK Chairperson',
      },
    ],
  });

  const initializeMandatoryCenters = () => {
    if (form.centers.length === 0) {
      setForm(prev => ({
        ...prev,
        centers: [
          createAdministrativeServiceCenter(),
          createGovernanceCenter(),
        ],
      }));
    }
  };

  // Load CBYDP projects for selection
  const loadCbydpProjects = useCallback(async () => {
    try {
      console.log('Loading CBYDP projects for ABYIP...');
      const cbydp = await getCBYDP();
      console.log('CBYDP data received:', cbydp);
      
      if (cbydp && (cbydp as any).centers) {
        console.log('CBYDP centers found:', (cbydp as any).centers);
        
        // Store centers with their projects
        const centersWithProjects = (cbydp as any).centers.map((center: any) => ({
          ...center,
          projects: (center.projects || []).map((project: any) => ({
            ...project,
            sourceCenter: center.name,
            type: 'project'
          }))
        }));
        
        // Flatten all projects for selection tracking
        const allProjects = centersWithProjects.flatMap((center: any) => center.projects);
        
        console.log('CBYDP centers with projects:', centersWithProjects);
        console.log('Flattened CBYDP projects:', allProjects);
        
        setCbydpCentersForProjects(centersWithProjects);
        setCbydpProjects(allProjects);
      } else {
        console.log('No CBYDP centers found or CBYDP is null');
        setCbydpCentersForProjects([]);
        setCbydpProjects([]);
      }
    } catch (error) {
      console.error('Error loading CBYDP projects:', error);
      setCbydpCentersForProjects([]);
      setCbydpProjects([]);
    }
  }, []);

  // Handle project selection from CBYDP
  const handleProjectSelection = () => {
    if (selectedCenterForProject === null || selectedCbydpProjects.length === 0) return;

    const selectedProjects = selectedCbydpProjects.map(idx => cbydpProjects[idx]);
    console.log('Selected CBYDP projects for conversion:', selectedProjects);
    
    const convertedProjects = selectedProjects.map((project: any) => {
      // Calculate total expense from CBYDP expenses
      const totalExpense = (project.expenses || []).reduce((sum: number, expense: any) => {
        const cost = parseFloat(expense.cost?.replace(/,/g, '') || '0');
        return sum + cost;
      }, 0);

      // Extract the first program, project, and action from the arrays
      const firstProgram = (project.programs && project.programs.length > 0) ? project.programs[0] : '';
      const firstProject = (project.projects && project.projects.length > 0) ? project.projects[0] : '';
      const firstAction = (project.actions && project.actions.length > 0) ? project.actions[0] : '';

      return {
        referenceCode: project.referenceCode || '',
        ppas: firstProgram || project.ppas || '', // Map to first program from CBYDP programs array
        description: firstAction || project.concern || '', // Map to first action from CBYDP actions array
        expectedResult: project.objective || '', // Map to objective from CBYDP
        performanceIndicator: project.indicator || '', // Map to indicator from CBYDP
        periodOfImplementation: 'January - December', // Default period
        budget: {
          mooe: totalExpense.toString(),
          co: '',
          ps: '',
          total: totalExpense.toString(),
        },
        personResponsible: project.responsible || '',
      };
    });
    
    console.log('Converted projects for ABYIP:', convertedProjects);

    const updatedCenters = form.centers.map((c, i) =>
      i === selectedCenterForProject 
        ? { ...c, projects: [...c.projects, ...convertedProjects] }
        : c
    );
    setForm(prev => ({ ...prev, centers: updatedCenters }));

    // Close modal and reset state
    setProjectSelectionModalOpen(false);
    setSelectedCenterForProject(null);
    setSelectedCbydpProjects([]);
  };

  // Open project selection modal
  const openProjectSelection = (centerIdx: number) => {
    setSelectedCenterForProject(centerIdx);
    setProjectSelectionModalOpen(true);
    loadCbydpProjects();
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

  // Generate year options based on SK setup
  const generateYearOptions = () => {
    if (!skProfile?.skTermStart || !skProfile?.skTermEnd) {
      // Fallback to current year + 2 years if SK setup is not available
      return Array.from({ length: 3 }, (_, i) => {
        const year = new Date().getFullYear() + i;
        return year.toString();
      });
    }
    
    // Use SK Profile's term start and end years
    const years = [];
    for (let year = skProfile.skTermStart; year <= skProfile.skTermEnd; year++) {
      years.push(year.toString());
    }
    return years;
  };

  // Budget calculation helper functions
  const calculateProjectTotal = (budget: { mooe: string; co: string; ps: string; total: string }) => {
    // Handle both raw values (during typing) and formatted values (after blur)
    const mooe = parseFloat(budget.mooe?.replace(/,/g, '') || '0') || 0;
    const co = parseFloat(budget.co?.replace(/,/g, '') || '0') || 0;
    const ps = parseFloat(budget.ps?.replace(/,/g, '') || '0') || 0;
    return mooe + co + ps;
  };

  const calculateCenterSubtotal = (center: ABYIPCenter) => {
    return center.projects.reduce((total, project) => {
      return total + calculateProjectTotal(project.budget);
    }, 0);
  };

  const calculateCenterSubtotalMOOE = (center: ABYIPCenter) => {
    return center.projects.reduce((total, project) => {
      return total + (parseFloat(project.budget.mooe?.replace(/,/g, '') || '0'));
    }, 0);
  };

  const calculateCenterSubtotalCO = (center: ABYIPCenter) => {
    return center.projects.reduce((total, project) => {
      return total + (parseFloat(project.budget.co?.replace(/,/g, '') || '0'));
    }, 0);
  };

  const calculateCenterSubtotalPS = (center: ABYIPCenter) => {
    return center.projects.reduce((total, project) => {
      return total + (parseFloat(project.budget.ps?.replace(/,/g, '') || '0'));
    }, 0);
  };

  const calculateGrandTotal = () => {
    return form.centers.reduce((total, center) => {
      return total + calculateCenterSubtotal(center);
    }, 0);
  };

  const calculateGrandTotalMOOE = () => {
    return form.centers.reduce((total, center) => {
      return total + calculateCenterSubtotalMOOE(center);
    }, 0);
  };

  const calculateGrandTotalCO = () => {
    return form.centers.reduce((total, center) => {
      return total + calculateCenterSubtotalCO(center);
    }, 0);
  };

  const calculateGrandTotalPS = () => {
    return form.centers.reduce((total, center) => {
      return total + calculateCenterSubtotalPS(center);
    }, 0);
  };

  const isBudgetBalanced = () => {
    const yearlyBudget = parseFloat(form.yearlyBudget?.replace(/,/g, '') || '0') || 0;
    const grandTotal = calculateGrandTotal();
    return Math.abs(yearlyBudget - grandTotal) < 0.01; // Allow for small rounding differences
  };

  // Close ABYIP for editing (similar to CBYDP)
  const handleCloseEditing = async () => {
    if (!existingABYIPId) {
      setError('No ABYIP to close. Please save first.');
      return;
    }

    if (!isBudgetBalanced()) {
      setError('Cannot close ABYIP: Budget is not balanced. Total allocated must equal yearly budget.');
      return;
    }

    try {
      setSaving(true);
      const updatedForm = {
        ...form,
        isEditingOpen: false,
        status: 'pending_kk_approval' as const,
        closedBy: user?.name,
        closedAt: new Date(),
        lastEditedBy: user?.name,
        lastEditedAt: new Date(),
        updatedAt: new Date()
      };

      await updateABYIP(existingABYIPId, updatedForm as any);
      setForm(updatedForm);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setError('');
    } catch (error) {
      console.error('Error closing ABYIP:', error);
      setError('Failed to close ABYIP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Open ABYIP for editing (similar to CBYDP)
  const handleOpenABYIP = async () => {
    if (!existingABYIPId) {
      setError('No ABYIP to open.');
      return;
    }

    try {
      setSaving(true);
      const updatedForm = {
        ...form,
        isEditingOpen: true,
        status: 'open_for_editing' as const,
        lastEditedBy: user?.name,
        lastEditedAt: new Date(),
        updatedAt: new Date()
      };

      await updateABYIP(existingABYIPId, updatedForm as any);
      setForm(updatedForm);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setError('');
    } catch (error) {
      console.error('Error opening ABYIP:', error);
      setError('Failed to open ABYIP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle KK Approval (similar to CBYDP)
  const handleKKApproval = async () => {
    if (!kkProofFile || !kkApprovalDate) {
      setError('Please upload proof image and select approval date.');
      return;
    }

    if (!existingABYIPId) {
      setError('No ABYIP to approve. Please save the ABYIP first.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      console.log('Starting KK approval process...');

      // Upload the proof image
      console.log('Uploading proof image...');
      const imageUrl = await uploadFile(kkProofFile, `abyip-kk-proof/${existingABYIPId}`);
      console.log('Image uploaded successfully:', imageUrl);

      // Update the existing ABYIP with approval data instead of creating a new one
      const approvedABYIPData = {
        ...form,
        status: 'approved',
        kkApprovedBy: user?.name,
        kkApprovedAt: new Date(kkApprovalDate),
        kkProofImage: imageUrl,
        approvedBy: user?.name,
        approvedAt: new Date(),
        isEditingOpen: false,
        lastEditedBy: user?.name,
        lastEditedAt: new Date(),
        updatedAt: new Date()
      };

      console.log('Updating ABYIP with approval data...');
      // Update the existing ABYIP instead of creating a new one
      await updateABYIP(existingABYIPId, approvedABYIPData as any);

      // Update the form state
      setForm(approvedABYIPData as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      
      // Close the modal and clear state
      setShowKKApprovalModal(false);
      setKkProofFile(null);
      setKkProofImage('');
      setKkApprovalDate('');
      
      console.log('ABYIP approved successfully!');
    } catch (error) {
      console.error('Error approving ABYIP with KK:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to approve ABYIP: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle KK Rejection
  const handleRejectKK = async (reason: string) => {
    if (!existingABYIPId) {
      setError('No ABYIP to reject.');
      return;
    }

    try {
      setSaving(true);
      const updatedForm = {
        ...form,
        status: 'rejected' as const,
        rejectionReason: reason,
        lastEditedBy: user?.name,
        lastEditedAt: new Date(),
        updatedAt: new Date()
      };

      await updateABYIP(existingABYIPId, updatedForm as any);
      setForm(updatedForm);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setError('');
    } catch (error) {
      console.error('Error rejecting ABYIP:', error);
      setError('Failed to reject ABYIP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Reset approved ABYIP (similar to CBYDP)
  const handleResetABYIP = async () => {
    if (!existingABYIPId) {
      setError('No ABYIP to reset.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // Delete the current approved ABYIP
      if (existingABYIPId) {
        await deleteABYIP(existingABYIPId);
      }

      // Reset form to initial state
      const resetForm: ABYIPForm = {
        centers: [],
        skMembers: form.skMembers, // Keep SK members
        showLogoInPrint: true,
        status: 'not_initiated',
        isEditingOpen: false,
        year: new Date().getFullYear().toString(),
        yearlyBudget: '',
      };

      setForm(resetForm);
      setExistingABYIPId(null);
      setSelectedABYIPYear('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error resetting ABYIP:', error);
      setError('Failed to reset ABYIP. Please try again.');
    } finally {
      setSaving(false);
    }
  };


  // Initialize mandatory centers when form is first loaded
  useEffect(() => {
    if (form.centers.length === 0 && form.status === 'not_initiated') {
      initializeMandatoryCenters();
    }
  }, [form.centers.length, form.status]);

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
          centers: [],
          skMembers: prev.skMembers,
          showLogoInPrint: true,
          status: 'not_initiated',
          isEditingOpen: false,
          year: year,
          yearlyBudget: '',
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
        
        // Log activity
        try {
          await logABYIPActivity(
            'Updated',
            `ABYIP for ${form.year} has been updated with ${form.centers.length} centers`,
            { name: user?.name || 'Unknown', role: user?.role || 'member', id: user?.uid || '' },
            'completed'
          );
          console.log('ABYIP activity logged successfully');
        } catch (activityError) {
          console.error('Error logging ABYIP activity:', activityError);
          // Don't fail the save operation if activity logging fails
        }
      } else {
        console.log('Creating new ABYIP...');
        const id = await createABYIP(payload as any);
        setExistingABYIPId(id);
        console.log('ABYIP created successfully with ID:', id);
        
        // Log activity
        try {
          await logABYIPActivity(
            'Created',
            `ABYIP for ${form.year} has been created with ${form.centers.length} centers`,
            { name: user?.name || 'Unknown', role: user?.role || 'member', id: user?.uid || '' },
            'completed'
          );
          console.log('ABYIP activity logged successfully');
        } catch (activityError) {
          console.error('Error logging ABYIP activity:', activityError);
          // Don't fail the save operation if activity logging fails
        }
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

      {/* Unified ABYIP Management Section */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-blue-800">ABYIP Management</h3>
        </div>

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
            {generateYearOptions().map((year) => {
              const hasABYIP = allABYIPs.some(abyip => abyip.year === year);
              return (
                <option key={year} value={year}>
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


        {/* Combined ABYIP Status - Always Visible */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h5 className="text-md font-semibold text-blue-800 mb-3">ABYIP Status for {form.year}</h5>
          
          {/* Status Badge and Basic Info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                 form.status === 'not_initiated' ? 'bg-gray-100 text-gray-800' :
                 form.status === 'open_for_editing' ? 'bg-blue-100 text-blue-800' :
                 form.status === 'pending_kk_approval' ? 'bg-yellow-100 text-yellow-800' :
                form.status === 'approved' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                 {form.status === 'not_initiated' ? 'Not Initiated' :
                  form.status === 'open_for_editing' ? 'Open for Editing' :
                  form.status === 'pending_kk_approval' ? 'Pending KK Approval' :
                 form.status === 'approved' ? 'Approved' : 'Rejected'}
              </span>
              {form.initiatedBy && (
                <span className="text-sm text-blue-700">
                  Initiated by: {form.initiatedBy}
                </span>
              )}
            </div>
          </div>

          {/* Detailed Information Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-700">Year:</span>
              <div className="text-gray-600">{form.year}</div>
            </div>
            <div>
              <span className="font-medium text-blue-700">ABYIP ID:</span>
              <div className="text-gray-600">{existingABYIPId ? existingABYIPId.substring(0, 8) + '...' : 'None'}</div>
            </div>
            <div>
              <span className="font-medium text-blue-700">Centers:</span>
              <div className="text-gray-600">{form.centers?.length || 0}</div>
            </div>
            <div>
              <span className="font-medium text-blue-700">Created:</span>
              <div className="text-gray-600">{form.initiatedAt ? new Date(form.initiatedAt).toLocaleDateString() : 'N/A'}</div>
            </div>
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


      {/* Action Buttons - Show when editing is open OR when there's an existing ABYIP */}
      {(form.isEditingOpen || existingABYIPId) && (
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

          {/* Re-initiate ABYIP - Only for Chairperson when rejected */}
          {user?.role === 'chairperson' && form.status === 'rejected' && (
            <button
              onClick={async () => {
                const updatedForm = {
                  ...form,
                  status: 'open_for_editing' as const,
                  isEditingOpen: true,
                  initiatedBy: user?.name,
                  initiatedAt: new Date()
                };
                // Remove rejectionReason field entirely
                delete updatedForm.rejectionReason;
                setForm(updatedForm);
                
                // Update the existing ABYIP
                try {
                  setSaving(true);
                  if (existingABYIPId) {
                    await updateABYIP(existingABYIPId, updatedForm as any);
                  }
                  setSaved(true);
                  setTimeout(() => setSaved(false), 3000);
                } catch (e: any) {
                  setError(e?.message || 'Failed to re-initiate ABYIP');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="btn-primary flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-initiate ABYIP
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

          {/* Close Editing Period - Only for Chairperson when open for editing */}
          {user?.role === 'chairperson' && form.status === 'open_for_editing' && (
            <button
              onClick={handleCloseEditing}
              disabled={saving || !isBudgetBalanced()}
              className="btn-secondary flex items-center"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Closing...
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Close Editing Period
                </>
              )}
            </button>
          )}

          {/* KK Approval Actions - Only for Chairperson when pending KK approval */}
          {user?.role === 'chairperson' && form.status === 'pending_kk_approval' && (
            <>
              <button
                onClick={() => setShowKKApprovalModal(true)}
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
                    Approve with KK
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Please provide a reason for rejection:');
                  if (reason) {
                    handleRejectKK(reason);
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

          {/* Reset ABYIP Button - Only for Chairperson when approved */}
          {user?.role === 'chairperson' && form.status === 'approved' && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to reset this approved ABYIP? This will delete the current one and allow you to create a new one.')) {
                  handleResetABYIP();
                }
              }}
              disabled={saving}
              className="btn-danger flex items-center"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset ABYIP
                </>
              )}
            </button>
          )}


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
                  centers: [],
                  skMembers: [],
                  showLogoInPrint: true,
                  status: 'not_initiated',
                  isEditingOpen: false,
                  year: new Date().getFullYear().toString(),
                  yearlyBudget: '',
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

          {/* Back to List Button - Show when there's an existing ABYIP */}
          {existingABYIPId && (
            <button
              onClick={() => {
                setForm(prev => ({ ...prev, isEditingOpen: false }));
                setPreview(false);
                setExistingABYIPId(null);
                setSelectedABYIPYear('');
              }}
              className="btn-secondary flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Back to List
            </button>
          )}

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
      )}

      {preview ? (
        <div className="space-y-6">
          {/* Print Preview */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Print Preview</h3>
              <div className="flex space-x-3">
                <button
                  onClick={async () => {
                    try {
                      console.log('=== ABYIP EXPORT STARTED ===');
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
                      
                      // Verify template path exists
                      const templatePath = '/templates/abyip_template.docx';
                      console.log('Using template path:', templatePath);
                      
                      const outputFileName = `ABYIP_${skProfile?.barangay || 'Document'}_${form.year || '2024'}`;
                      console.log('Output filename:', outputFileName);
                      
                      await exportDocxFromTemplate({
                        templatePath,
                        data,
                        outputFileName,
                      });
                      
                      console.log('=== ABYIP EXPORT COMPLETED SUCCESSFULLY ===');
                      alert('ABYIP document exported successfully!');
                    } catch (e) {
                      console.error('ABYIP template export failed', e);
                      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                      alert(`Failed to export ABYIP Word document: ${errorMessage}`);
                    }
                  }}
                  className="btn-secondary flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
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
                    To print the ABYIP, you must first export it to Word, then manually add the logo to the downloaded document, and then print from there.
                  </p>
                </div>
              </div>
            </div>
            
            <div ref={printRef} className="print-content bg-white p-8" style={{ 
              width: '100%', 
              maxWidth: '100%',
              height: '600px',
              overflow: 'auto',
              display: 'block', 
              visibility: 'visible', 
              fontFamily: "'Times New Roman', serif" 
            }}>
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
                   <div key={`${ci}-${pageNum}`}>
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

                     </div>
                     

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
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.budget.mooe && `₱${formatNumber(project.budget.mooe)}`}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.budget.co && `₱${formatNumber(project.budget.co)}`}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>{project.budget.ps && `₱${formatNumber(project.budget.ps)}`}</td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', textAlign: 'right' }}>₱{formatNumber(calculateProjectTotal(project.budget).toString())}</td>
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
                         
                         {/* Subtotal Row for this center */}
                         <tr>
                           <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', backgroundColor: '#f3f4f6' }} colSpan={6}>
                             SUBTOTAL
                           </td>
                           <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#f3f4f6' }}>
                             ₱{formatNumber(calculateCenterSubtotalMOOE(center).toString())}
                           </td>
                           <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#f3f4f6' }}>
                             ₱{formatNumber(calculateCenterSubtotalCO(center).toString())}
                           </td>
                           <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#f3f4f6' }}>
                             ₱{formatNumber(calculateCenterSubtotalPS(center).toString())}
                           </td>
                           <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#f3f4f6' }}>
                             ₱{formatNumber(calculateCenterSubtotal(center).toString())}
                           </td>
                           <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', backgroundColor: '#f3f4f6' }}></td>
                         </tr>
                         
                         {/* Grand Total Row - only on the last center */}
                         {ci === form.centers.length - 1 && (
                           <tr>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', backgroundColor: '#dbeafe' }} colSpan={6}>
                               GRAND TOTAL
                             </td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#dbeafe' }}>
                               ₱{formatNumber(calculateGrandTotalMOOE().toString())}
                             </td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#dbeafe' }}>
                               ₱{formatNumber(calculateGrandTotalCO().toString())}
                             </td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#dbeafe' }}>
                               ₱{formatNumber(calculateGrandTotalPS().toString())}
                             </td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#dbeafe' }}>
                               ₱{formatNumber(calculateGrandTotal().toString())}
                             </td>
                             <td style={{ border: '1px solid #000', padding: '4px', verticalAlign: 'top', backgroundColor: '#dbeafe' }}></td>
                           </tr>
                         )}
                       </tbody>
                     </table>

                     {/* Prepared by - ABYIP format with Secretary */}
                     <div style={{ marginTop: '12px' }}>
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
          {/* Workflow Status Notices - Show when editing is open OR when there's an existing ABYIP */}
          {(form.isEditingOpen || existingABYIPId) && form.status === 'not_initiated' && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              ABYIP for {form.year} has not been initiated yet. The SK Chairperson must initiate the ABYIP to begin the process.
            </div>
          )}

            {(form.isEditingOpen || existingABYIPId) && form.status === 'open_for_editing' && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                ABYIP for {form.year} is open for editing. All SK members can add and edit projects.
              </div>
            )}

            {(form.isEditingOpen || existingABYIPId) && form.status === 'pending_kk_approval' && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                {form.isEditingOpen ? 
                  'ABYIP is pending Katipunan ng Kabataan approval. The SK Chairperson must upload proof of KK approval.' :
                  'ABYIP editing period has been closed. The ABYIP is now pending Katipunan ng Kabataan approval. The SK Chairperson must upload proof of KK approval.'
                }
              </div>
            )}


          {(form.isEditingOpen || existingABYIPId) && form.status === 'approved' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              ABYIP for {form.year} has been approved and is now read-only.
            </div>
          )}

          {(form.isEditingOpen || existingABYIPId) && form.status === 'rejected' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              ABYIP for {form.year} was rejected. Reason: {form.rejectionReason}. The SK Chairperson can re-initiate the ABYIP to start the process again.
            </div>
          )}

          {/* Main Form Content - Show when editing is open OR when there's an existing ABYIP */}
          {(form.isEditingOpen || existingABYIPId) && (
            <div>
            {/* Yearly Budget */}
            <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Budget Information</h3>
            </div>
            <div className="card-body">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Yearly Budget (₱) *
                </label>
               <input
                 type="text"
                 value={form.yearlyBudget}
                 onChange={(e) => {
                   handleNumberInput(e.target.value, (value) => {
                     setForm(prev => ({ ...prev, yearlyBudget: value }));
                   });
                 }}
                 onBlur={(e) => {
                   // Format the number when user finishes typing
                   const formatted = handleNumberDisplay(e.target.value);
                   setForm(prev => ({ ...prev, yearlyBudget: formatted }));
                 }}
                 disabled={!form.isEditingOpen || form.status === 'approved'}
                 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                 placeholder="Enter total yearly budget (e.g., 1,000,000.00)"
               />
              </div>

              {/* Budget Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h5 className="font-semibold text-gray-800 mb-2">Budget Summary</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                 <div>
                   <span className="text-gray-600">Yearly Budget:</span>
                   <span className="ml-2 font-semibold">₱{formatNumber(form.yearlyBudget || '0')}</span>
                 </div>
                 <div>
                   <span className="text-gray-600">Total Allocated:</span>
                   <span className={`ml-2 font-semibold ${isBudgetBalanced() ? 'text-green-600' : 'text-red-600'}`}>
                     ₱{formatNumber(calculateGrandTotal().toString())}
                   </span>
                 </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Remaining:</span>
                   <span className={`font-semibold ${isBudgetBalanced() ? 'text-green-600' : 'text-red-600'}`}>
                     ₱{formatNumber((parseFloat(form.yearlyBudget?.replace(/,/g, '') || '0') - calculateGrandTotal()).toString())}
                   </span>
                  </div>
                  {!isBudgetBalanced() && (
                    <div className="mt-2 text-sm text-red-600">
                      ⚠️ Budget is not balanced. Total allocated must equal yearly budget.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Centers of Participation */}
          <div className="space-y-4 mt-6">
            {form.centers.map((center, centerIdx) => (
              <div key={centerIdx} className="card">
                <div className="card-header">
                  <div className="flex justify-between items-center">
                    <div 
                      className="flex items-center cursor-pointer flex-1"
                      onClick={() => toggleCenter(centerIdx)}
                    >
                      <h3 className="text-lg font-semibold text-gray-900 mr-2">
                        {center.name || `Center of Participation ${centerIdx + 1}`}
                      </h3>
                      {expandedCenters[centerIdx] ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
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
                  {expandedCenters[centerIdx] && (
                    <>
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
                  </div>

                  {/* Projects Table */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-gray-900">Projects</h4>
                      {form.status !== 'not_initiated' && form.isEditingOpen && (
                        <div className="flex gap-2">
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
                            New Project
                          </button>
                          <button
                            type="button"
                            onClick={() => openProjectSelection(centerIdx)}
                            className="btn-primary flex items-center"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            From CBYDP
                          </button>
                        </div>
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
                                    handleNumberInput(e.target.value, async (value) => {
                                      const updatedCenters = form.centers.map((c, i) =>
                                        i === centerIdx ? {
                                          ...c,
                                          projects: c.projects.map((p, j) =>
                                            j === projectIdx ? { ...p, budget: { ...p.budget, mooe: value } } : p
                                          )
                                        } : c
                                      );
                                      const updatedForm = { ...form, centers: updatedCenters };
                                      setForm(updatedForm);
                                      await autoSaveProjectChange(updatedForm);
                                    });
                                  }}
                                  onBlur={async (e) => {
                                    // Format the number when user finishes typing
                                    const formatted = handleNumberDisplay(e.target.value);
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, budget: { ...p.budget, mooe: formatted } } : p
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
                                    handleNumberInput(e.target.value, async (value) => {
                                      const updatedCenters = form.centers.map((c, i) =>
                                        i === centerIdx ? {
                                          ...c,
                                          projects: c.projects.map((p, j) =>
                                            j === projectIdx ? { ...p, budget: { ...p.budget, co: value } } : p
                                          )
                                        } : c
                                      );
                                      const updatedForm = { ...form, centers: updatedCenters };
                                      setForm(updatedForm);
                                      await autoSaveProjectChange(updatedForm);
                                    });
                                  }}
                                  onBlur={async (e) => {
                                    // Format the number when user finishes typing
                                    const formatted = handleNumberDisplay(e.target.value);
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, budget: { ...p.budget, co: formatted } } : p
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
                                    handleNumberInput(e.target.value, async (value) => {
                                      const updatedCenters = form.centers.map((c, i) =>
                                        i === centerIdx ? {
                                          ...c,
                                          projects: c.projects.map((p, j) =>
                                            j === projectIdx ? { ...p, budget: { ...p.budget, ps: value } } : p
                                          )
                                        } : c
                                      );
                                      const updatedForm = { ...form, centers: updatedCenters };
                                      setForm(updatedForm);
                                      await autoSaveProjectChange(updatedForm);
                                    });
                                  }}
                                  onBlur={async (e) => {
                                    // Format the number when user finishes typing
                                    const formatted = handleNumberDisplay(e.target.value);
                                    const updatedCenters = form.centers.map((c, i) =>
                                      i === centerIdx ? {
                                        ...c,
                                        projects: c.projects.map((p, j) =>
                                          j === projectIdx ? { ...p, budget: { ...p.budget, ps: formatted } } : p
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
                                <div className="w-full text-xs font-semibold text-right bg-gray-50 py-1 px-2">
                                  ₱{formatNumber(calculateProjectTotal(project.budget).toString())}
                                </div>
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
                          
                          {/* Subtotal Row for this center */}
                          <tr className="bg-gray-100">
                            <td className="border border-gray-300 p-2 font-semibold text-sm" colSpan={6}>
                              SUBTOTAL
                            </td>
                            <td className="border border-gray-300 p-2 font-semibold text-sm text-right">
                              ₱{formatNumber(calculateCenterSubtotalMOOE(center).toString())}
                            </td>
                            <td className="border border-gray-300 p-2 font-semibold text-sm text-right">
                              ₱{formatNumber(calculateCenterSubtotalCO(center).toString())}
                            </td>
                            <td className="border border-gray-300 p-2 font-semibold text-sm text-right">
                              ₱{formatNumber(calculateCenterSubtotalPS(center).toString())}
                            </td>
                            <td className="border border-gray-300 p-2 font-semibold text-sm text-right">
                              ₱{formatNumber(calculateCenterSubtotal(center).toString())}
                            </td>
                            <td className="border border-gray-300 p-2"></td>
                          </tr>
                          
                          {/* Grand Total Row - only on the last center */}
                          {centerIdx === form.centers.length - 1 && (
                            <tr className="bg-blue-100">
                              <td className="border border-gray-300 p-2 font-bold text-sm" colSpan={6}>
                                GRAND TOTAL
                              </td>
                              <td className="border border-gray-300 p-2 font-bold text-sm text-right">
                                ₱{formatNumber(calculateGrandTotalMOOE().toString())}
                              </td>
                              <td className="border border-gray-300 p-2 font-bold text-sm text-right">
                                ₱{formatNumber(calculateGrandTotalCO().toString())}
                              </td>
                              <td className="border border-gray-300 p-2 font-bold text-sm text-right">
                                ₱{formatNumber(calculateGrandTotalPS().toString())}
                              </td>
                              <td className="border border-gray-300 p-2 font-bold text-sm text-right">
                                ₱{formatNumber(calculateGrandTotal().toString())}
                              </td>
                              <td className="border border-gray-300 p-2"></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                    </>
                  )}
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
          )}</div>
          
          )}

      {/* Existing ABYIPs Panel - Only show when no ABYIP is being viewed */}
      {!form.isEditingOpen && !existingABYIPId && (
        <div className="card p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Existing ABYIPs</h2>
          {allABYIPs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No ABYIPs Created Yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first Annual Barangay Youth Investment Program to get started.
              </p>
              <div className="flex gap-2 justify-center">
                <button 
                  onClick={async () => {
                    try {
                      const yearToUse = selectedABYIPYear || new Date().getFullYear().toString();
                      const updatedForm = {
                        ...form,
                        year: yearToUse,
                        status: 'not_initiated' as const,
                        isEditingOpen: true,
                        centers: [],
                        skMembers: [],
                        showLogoInPrint: true
                      };
                      setForm(updatedForm);
                      setSelectedABYIPYear(yearToUse);
                      
                      // Create the new ABYIP
                      setSaving(true);
                      const id = await createABYIP(updatedForm as any);
                      setExistingABYIPId(id);
                      setSaved(true);
                      setTimeout(() => setSaved(false), 3000);
                      
                      // Reload all ABYIPs to update the list
                      await loadAllABYIPs();
                    } catch (e: any) {
                      setError(e?.message || 'Failed to create ABYIP');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : `Create ABYIP for ${selectedABYIPYear || new Date().getFullYear()}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {allABYIPs.map((abyip) => (
                <div key={abyip.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">ABYIP {abyip.year}</h3>
                      <p className="text-gray-600">
                        Centers: {abyip.centers?.length || 0} | Projects: {abyip.centers?.reduce((total: number, center: any) => total + (center.projects?.length || 0), 0) || 0}
                      </p>
                      <p className="text-sm text-gray-500">
                        Total Budget: ₱{formatNumber(abyip.yearlyBudget || '0')} | Status: {abyip.status?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedABYIPYear(abyip.year);
                          setForm(prev => ({ ...prev, year: abyip.year, isEditingOpen: true }));
                          loadExistingABYIP(abyip.year);
                        }}
                        className="btn-secondary flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View/Edit
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            // Set the form data for export
                            const tempForm = { ...abyip };
                            console.log('=== ABYIP EXPORT STARTED ===');
                            console.log('ABYIP Form data before export:', tempForm);
                            console.log('ABYIP SK Profile data:', skProfile);
                            console.log('ABYIP Current user:', user);
                            
                            // Create comprehensive payload with multiple data sources
                            const payload = {
                              form: tempForm,
                              skProfile: skProfile,
                              user: user,
                              centers: tempForm.centers || [],
                              skMembers: tempForm.skMembers || [],
                              showLogoInPrint: tempForm.showLogoInPrint !== false
                            };
                            
                            console.log('Final export payload:', payload);
                            
                            // Use the mapABYIPToTemplate function to format data
                            const templateData = mapABYIPToTemplate(payload);
                            console.log('Template data after mapping:', templateData);
                            
                            // Verify template path exists
                            const templatePath = '/templates/abyip_template.docx';
                            console.log('Using template path:', templatePath);
                            
                            const outputFileName = `ABYIP_${skProfile?.barangay || 'Document'}_${tempForm.year || '2024'}`;
                            console.log('Output filename:', outputFileName);
                            
                            await exportDocxFromTemplate({
                              templatePath,
                              data: templateData,
                              outputFileName,
                            });
                            
                            console.log('=== ABYIP EXPORT COMPLETED SUCCESSFULLY ===');
                            alert('ABYIP document exported successfully!');
                          } catch (e) {
                            console.error('ABYIP template export failed', e);
                            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                            alert(`Failed to export ABYIP Word document: ${errorMessage}`);
                          }
                        }}
                        className="btn-secondary flex items-center"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export to Word
                      </button>
                      <button 
                        onClick={async () => {
                          if (abyip.id && window.confirm('Are you sure you want to delete this ABYIP?')) {
                            try {
                              await deleteABYIP(abyip.id);
                              loadAllABYIPs();
                            } catch (error) {
                              setError('Failed to delete ABYIP');
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
      )}

      {/* Project Selection Modal */}
      {projectSelectionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Select Projects from CBYDP</h3>
              <button
                onClick={() => {
                  setProjectSelectionModalOpen(false);
                  setSelectedCenterForProject(null);
                  setSelectedCbydpProjects([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Select projects from your approved CBYDP to add to this center. You can edit them after adding.
              </p>
              {cbydpProjects.length === 0 && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    <strong>Note:</strong> No CBYDP projects found. Please ensure you have an approved CBYDP with projects before importing.
                  </p>
                </div>
              )}
              {selectedCbydpProjects.length > 0 && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Selected:</strong> {selectedCbydpProjects.length} project(s) from CBYDP
                  </p>
                </div>
              )}
            </div>

            {cbydpCentersForProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No CBYDP projects found. Please ensure you have an approved CBYDP.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {cbydpCentersForProjects.map((center, centerIdx) => (
                  <div key={centerIdx} className="border border-gray-200 rounded-lg">
                    {/* Center Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h4 className="font-semibold text-gray-800 text-sm">
                        {center.name}
                      </h4>
                    </div>
                    
                    {/* Projects in this center */}
                    <div className="p-3 space-y-2">
                      {center.projects.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No projects in this center</p>
                      ) : (
                        center.projects.map((project: any, projectIdx: number) => {
                          // Calculate the global index for this project
                          const globalIndex = cbydpProjects.findIndex(p => 
                            p.ppas === project.ppas && p.sourceCenter === project.sourceCenter
                          );
                          
                          return (
                            <div
                              key={projectIdx}
                              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedCbydpProjects.includes(globalIndex)
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              onClick={() => {
                                setSelectedCbydpProjects(prev =>
                                  prev.includes(globalIndex)
                                    ? prev.filter(i => i !== globalIndex)
                                    : [...prev, globalIndex]
                                );
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <input
                                      type="checkbox"
                                      checked={selectedCbydpProjects.includes(globalIndex)}
                                      onChange={() => {}}
                                      className="rounded"
                                    />
                                    <span className="font-medium text-sm">
                                      {project.ppas || 'Untitled Project'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 ml-6">
                                    {project.objective || project.concern || 'No description available'}
                                  </p>
                                  {project.referenceCode && (
                                    <p className="text-xs text-gray-500 ml-6">
                                      Ref: {project.referenceCode}
                                    </p>
                                  )}
                                  {(project.expenses && project.expenses.length > 0) && (
                                    <p className="text-xs text-gray-500 ml-6">
                                      Budget: ₱{formatNumber(project.expenses.reduce((sum: number, expense: any) => 
                                        sum + (parseFloat(expense.cost?.replace(/,/g, '') || '0')), 0
                                      ).toString())}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setProjectSelectionModalOpen(false);
                  setSelectedCenterForProject(null);
                  setSelectedCbydpProjects([]);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleProjectSelection}
                disabled={selectedCbydpProjects.length === 0}
                className="btn-primary"
              >
                Add Selected Projects ({selectedCbydpProjects.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KK Approval Modal */}
      {showKKApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Katipunan ng Kabataan Approval</h3>
            <p className="text-gray-600 mb-4">
              Upload proof of KK approval for this ABYIP. This will finalize the approval process.
            </p>
            
            {/* Debug Information */}
            <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
              <strong>Debug Info:</strong><br/>
              ABYIP ID: {existingABYIPId || 'None'}<br/>
              Current Status: {form.status}<br/>
              User Role: {user?.role}<br/>
              File Selected: {kkProofFile ? 'Yes' : 'No'}<br/>
              Date Selected: {kkApprovalDate || 'No'}<br/>
              Can Approve: {user?.role === 'chairperson' && form.status === 'pending_kk_approval' ? 'Yes' : 'No'}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                KK Approval Proof Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    console.log('File selected:', file.name, file.size, file.type);
                    setKkProofFile(file);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      setKkProofImage(e.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {kkProofFile && (
                <div className="mt-2 text-sm text-green-600">
                  ✓ File selected: {kkProofFile.name} ({(kkProofFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
              {kkProofImage && (
                <div className="mt-2">
                  <img
                    src={kkProofImage}
                    alt="KK Proof Preview"
                    className="w-32 h-32 object-cover rounded border"
                  />
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                KK Approval Date
              </label>
              <input
                type="date"
                value={kkApprovalDate}
                onChange={(e) => setKkApprovalDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleKKApproval}
                disabled={!kkProofFile || !kkApprovalDate || saving}
                className="btn-primary flex-1"
              >
                {saving ? 'Approving...' : 'Approve with KK'}
              </button>
              <button
                onClick={() => {
                  setShowKKApprovalModal(false);
                  setKkProofImage('');
                  setKkProofFile(null);
                  setKkApprovalDate('');
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ABYIP; 
