import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createCBYDP, getCBYDP, updateCBYDP, deleteCBYDP, uploadFile } from '../services/firebaseService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { FileText, Plus, Trash2, Save, CheckCircle, RefreshCw, Download, AlertCircle, Eye } from 'lucide-react';
import { exportDocxFromTemplate, mapCBYDPToTemplate } from '../services/docxExport';

interface CBYDPRow {
  concern: string;
  objective: string;
  indicator: string;
  target1: string;
  target2: string;
  target3: string;
  ppas: string;
  programs: string[];
  projects: string[];
  actions: string[];
  expenses: CBYDPExpense[];
  responsible: string;
}


interface CBYDPExpense {
  description: string;
  cost: string;
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
  centers: CBYDCenter[];
  skMembers: SKMember[];
  showLogoInPrint: boolean;
  status: 'not_initiated' | 'open_for_editing' | 'pending_kk_approval' | 'approved' | 'rejected';
  isEditingOpen: boolean;
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

const defaultRow: CBYDPRow = {
  concern: '',
  objective: '',
  indicator: '',
  target1: '',
  target2: '',
  target3: '',
  ppas: '',
  programs: [''],
  projects: [''],
  actions: [''],
  expenses: [{ description: '', cost: '' }],
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
    centers: [{ ...defaultCenter }],
    skMembers: [],
    showLogoInPrint: true,
    status: 'not_initiated',
    isEditingOpen: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [existingCBYDPId, setExistingCBYDPId] = useState<string | null>(null);
  const [kkProofFile, setKkProofFile] = useState<File | null>(null);
  const [kkProofImage, setKkProofImage] = useState<string>('');
  const [kkApprovalDate, setKkApprovalDate] = useState<string>('');
  const [showKKApprovalModal, setShowKKApprovalModal] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
    
    // If user is typing and hasn't added a decimal point, don't auto-format yet
    // Only format when they finish typing (on blur or when they add decimal)
    if (cleaned && !cleaned.includes('.')) {
      // Store the raw number without formatting for now
      const rawNumber = cleaned.replace(/,/g, '');
      callback(rawNumber);
    } else {
      // Remove commas for parsing
      const parsed = parseNumber(cleaned);
      callback(parsed);
    }
  };

  const handleNumberDisplay = (value: string): string => {
    if (!value) return '';
    // Always format for display - this ensures 5000 shows as 5,000.00
    return formatNumber(value);
  };

  const loadExistingCBYDP = useCallback(async () => {
    try {
      console.log('Loading existing CBYDP for user:', user?.name, user?.role);
      const existingCBYDP = await getCBYDP();
      console.log('Existing CBYDP result:', existingCBYDP);
      
      if (existingCBYDP) {
        const { id, ...cbydpData } = existingCBYDP;
        
        // Migrate existing data to include new expenses structure
        const migratedData = {
          ...cbydpData,
          centers: ((cbydpData as any).centers || []).map((center: any) => ({
            ...center,
            projects: (center.projects || []).map((project: any) => ({
              ...project,
              // Combine program, project, action into ppas field
              ppas: project.ppas || `${project.program || ''} | ${project.project || ''} | ${project.action || ''}`.replace(/^\s*\|\s*|\s*\|\s*$/g, ''),
                             // Create separate arrays for programs, projects, and actions
               programs: project.programs || (project.ppas ? 
                 project.ppas.split('|').map((part: string) => part.trim()).filter((part: string) => part) : 
                 ['']
               ),
               projects: project.projects || [''],
               actions: project.actions || [''],
              expenses: project.expenses || [{ description: '', cost: '' }],
              // Keep all fields for backward compatibility
              budget: project.budget || ''
            }))
          }))
        };
        
        console.log('Setting CBYDP form data:', migratedData);
        setForm(migratedData as CBYDPForm);
        setExistingCBYDPId(id);
        setSaved(true);
      } else {
        console.log('No existing CBYDP found, starting with empty form');
      }
    } catch (error) {
      console.error('Error loading CBYDP:', error);
    }
  }, [user?.name, user?.role]);

  // Fetch existing CBYDP and SK members
  useEffect(() => {
    loadExistingCBYDP();
    loadSKMembers();
  }, [loadExistingCBYDP]);

  // Reload CBYDP when user changes (in case of switching accounts)
  useEffect(() => {
    if (user) {
      console.log('User changed, reloading CBYDP for:', user.name);
      loadExistingCBYDP();
    }
    }, [user, loadExistingCBYDP]);

  const loadSKMembers = async () => {
    try {
      console.log('Loading SK members from database...');
      const querySnapshot = await getDocs(collection(db, 'users'));
      console.log('Query snapshot size:', querySnapshot.size);
      
      const members: SKMember[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('User document:', doc.id, data);
        if (data.isActive !== false) {
          const member = {
            name: data.name || '',
            position: data.role === 'chairperson' ? 'SK Chairperson' :
                     data.role === 'secretary' ? 'SK Secretary' :
                     data.role === 'treasurer' ? 'SK Treasurer' : 'SK Member'
          };
          console.log('Adding member:', member);
          members.push(member);
        }
      });
      console.log('Final loaded SK members:', members);
      setForm(prev => {
        const updatedForm = { ...prev, skMembers: members };
        console.log('Updated form with SK members:', updatedForm);
        return updatedForm;
      });
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

  const addExpense = async (centerIdx: number, projectIdx: number) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) =>
                j === projectIdx
                  ? { ...project, expenses: [...project.expenses, { description: '', cost: '' }] }
                  : project
              ),
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
        console.error('Error auto-saving after adding expense:', error);
        setError('Failed to auto-save. Please click Save CBYDP manually.');
      }
    }
  };

  const handleExpenseChange = async (centerIdx: number, projectIdx: number, expenseIdx: number, field: keyof CBYDPExpense, value: string) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) =>
                j === projectIdx
                  ? {
                      ...project,
                      expenses: project.expenses.map((expense, k) =>
                        k === expenseIdx ? { ...expense, [field]: value } : expense
                      ),
                    }
                  : project
              ),
            }
          : center
      ),
    };
    setForm(updatedForm);
    
    // Auto-save if CBYDP already exists (with debouncing)
    if (existingCBYDPId) {
      // Clear any existing timeout
      if ((window as any).expenseChangeTimeout) {
        clearTimeout((window as any).expenseChangeTimeout);
      }
      
      // Set a new timeout for auto-save
              (window as any).expenseChangeTimeout = setTimeout(async () => {
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
          console.error('Error auto-saving expense changes:', error);
          setError('Failed to auto-save. Please click Save CBYDP manually.');
        }
      }, 2000); // Wait 2 seconds after user stops typing
    }
  };

  

  // Program functions
  const addProgram = async (centerIdx: number, projectIdx: number) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) =>
                j === projectIdx
                  ? {
                      ...project,
                      programs: [...(project.programs || []), ''],
                    }
                  : project
              ),
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
        console.error('Error auto-saving after adding program:', error);
        setError('Failed to auto-save. Please click Save CBYDP manually.');
      }
    }
  };

  const removeProgram = async (centerIdx: number, projectIdx: number, programIdx: number) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) =>
                j === projectIdx
                  ? {
                      ...project,
                      programs: (project.programs || []).filter((_, k) => k !== programIdx),
                    }
                  : project
              ),
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
        console.error('Error auto-saving after removing program:', error);
        setError('Failed to auto-save. Please click Save CBYDP manually.');
      }
    }
  };

  const handleProgramChange = async (centerIdx: number, projectIdx: number, programIdx: number, value: string) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) => {
                if (j === projectIdx) {
                  const updatedPrograms = (project.programs || []).map((program, k) =>
                        k === programIdx ? value : program
                  );
                  
                  // Update ppas field to combine all PPAs
                  const programs = updatedPrograms.filter(p => p.trim());
                  const projectItems = (project.projects || []).filter(p => p.trim());
                  const actions = (project.actions || []).filter(p => p.trim());
                  
                  const ppasArray = [];
                  if (programs.length > 0) ppasArray.push(`Programs: ${programs.join(', ')}`);
                  if (projectItems.length > 0) ppasArray.push(`Projects: ${projectItems.join(', ')}`);
                  if (actions.length > 0) ppasArray.push(`Actions: ${actions.join(', ')}`);
                  
                  return {
                    ...project,
                    programs: updatedPrograms,
                    ppas: ppasArray.join(' | '),
                  };
                }
                return project;
              }),
            }
          : center
      ),
    };
    setForm(updatedForm);
    
    // Auto-save if CBYDP already exists (with debouncing)
    if (existingCBYDPId) {
      // Clear any existing timeout
      if ((window as any).programChangeTimeout) {
        clearTimeout((window as any).programChangeTimeout);
      }
      
      // Set a new timeout for auto-save
      (window as any).programChangeTimeout = setTimeout(async () => {
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
          console.error('Error auto-saving program changes:', error);
          setError('Failed to auto-save. Please click Save CBYDP manually.');
        }
      }, 2000); // Wait 2 seconds after user stops typing
    }
  };

  // Project functions
  const addProjectItem = async (centerIdx: number, projectIdx: number) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) =>
                j === projectIdx
                  ? {
                      ...project,
                      projects: [...(project.projects || []), ''],
                    }
                  : project
              ),
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
        console.error('Error auto-saving after adding project item:', error);
        setError('Failed to auto-save. Please click Save CBYDP manually.');
      }
    }
  };

  const removeProjectItem = async (centerIdx: number, projectIdx: number, projectItemIdx: number) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) =>
                j === projectIdx
                  ? {
                      ...project,
                      projects: (project.projects || []).filter((_, k) => k !== projectItemIdx),
                    }
                  : project
              ),
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
        console.error('Error auto-saving after removing project item:', error);
        setError('Failed to auto-save. Please click Save CBYDP manually.');
      }
    }
  };

  const handleProjectItemChange = async (centerIdx: number, projectIdx: number, projectItemIdx: number, value: string) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) => {
                if (j === projectIdx) {
                  const updatedProjectItems = (project.projects || []).map((projectItem, k) =>
                        k === projectItemIdx ? value : projectItem
                  );
                  
                  // Update ppas field to combine all PPAs
                  const programs = (project.programs || []).filter(p => p.trim());
                  const projectItems = updatedProjectItems.filter(p => p.trim());
                  const actions = (project.actions || []).filter(p => p.trim());
                  
                  const ppasArray = [];
                  if (programs.length > 0) ppasArray.push(`Programs: ${programs.join(', ')}`);
                  if (projectItems.length > 0) ppasArray.push(`Projects: ${projectItems.join(', ')}`);
                  if (actions.length > 0) ppasArray.push(`Actions: ${actions.join(', ')}`);
                  
                  return {
                    ...project,
                    projects: updatedProjectItems,
                    ppas: ppasArray.join(' | '),
                  };
                }
                return project;
              }),
            }
          : center
      ),
    };
    setForm(updatedForm);
    
    // Auto-save if CBYDP already exists (with debouncing)
    if (existingCBYDPId) {
      // Clear any existing timeout
      if ((window as any).projectItemChangeTimeout) {
        clearTimeout((window as any).projectItemChangeTimeout);
      }
      
      // Set a new timeout for auto-save
      (window as any).projectItemChangeTimeout = setTimeout(async () => {
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
          console.error('Error auto-saving project item changes:', error);
          setError('Failed to auto-save. Please click Save CBYDP manually.');
        }
      }, 2000); // Wait 2 seconds after user stops typing
    }
  };

  // Action functions
  const addAction = async (centerIdx: number, projectIdx: number) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) =>
                j === projectIdx
                  ? {
                      ...project,
                      actions: [...(project.actions || []), ''],
                    }
                  : project
              ),
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
        console.error('Error auto-saving after adding action:', error);
        setError('Failed to auto-save. Please click Save CBYDP manually.');
      }
    }
  };

  const removeAction = async (centerIdx: number, projectIdx: number, actionIdx: number) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) =>
                j === projectIdx
                  ? {
                      ...project,
                      actions: (project.actions || []).filter((_, k) => k !== actionIdx),
                    }
                  : project
              ),
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
        console.error('Error auto-saving after removing action:', error);
        setError('Failed to auto-save. Please click Save CBYDP manually.');
      }
    }
  };

  const handleActionChange = async (centerIdx: number, projectIdx: number, actionIdx: number, value: string) => {
    const updatedForm = {
      ...form,
      centers: form.centers.map((center, i) =>
        i === centerIdx
          ? {
              ...center,
              projects: center.projects.map((project, j) => {
                if (j === projectIdx) {
                  const updatedActions = (project.actions || []).map((action, k) =>
                        k === actionIdx ? value : action
                  );
                  
                  // Update ppas field to combine all PPAs
                  const programs = (project.programs || []).filter(p => p.trim());
                  const projectItems = (project.projects || []).filter(p => p.trim());
                  const actions = updatedActions.filter(p => p.trim());
                  
                  const ppasArray = [];
                  if (programs.length > 0) ppasArray.push(`Programs: ${programs.join(', ')}`);
                  if (projectItems.length > 0) ppasArray.push(`Projects: ${projectItems.join(', ')}`);
                  if (actions.length > 0) ppasArray.push(`Actions: ${actions.join(', ')}`);
                  
                  return {
                    ...project,
                    actions: updatedActions,
                    ppas: ppasArray.join(' | '),
                  };
                }
                return project;
              }),
            }
          : center
      ),
    };
    setForm(updatedForm);
    
    // Auto-save if CBYDP already exists (with debouncing)
    if (existingCBYDPId) {
      // Clear any existing timeout
      if ((window as any).actionChangeTimeout) {
        clearTimeout((window as any).actionChangeTimeout);
      }
      
      // Set a new timeout for auto-save
      (window as any).actionChangeTimeout = setTimeout(async () => {
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
          console.error('Error auto-saving action changes:', error);
          setError('Failed to auto-save. Please click Save CBYDP manually.');
        }
      }, 2000); // Wait 2 seconds after user stops typing
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      // Ensure all required fields are present
      const cbydpData = {
        ...form,
        lastEditedBy: user?.name,
        lastEditedAt: new Date(),
        createdBy: user?.name,
        updatedAt: new Date(),
        // Ensure centers have the correct structure
        centers: form.centers.map(center => ({
          ...center,
                                             projects: center.projects.map(project => ({
               ...project,
               ppas: project.ppas || '',
               programs: project.programs || [''],
               projects: project.projects || [''],
               actions: project.actions || [''],
               expenses: project.expenses || [{ description: '', cost: '' }],
               concern: project.concern || '',
               objective: project.objective || '',
               indicator: project.indicator || '',
               target1: project.target1 || '',
               target2: project.target2 || '',
               target3: project.target3 || '',
               responsible: project.responsible || ''
             }))
        }))
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
      setError(`Failed to save CBYDP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };










  const handleRefresh = async () => {
    console.log('Manual refresh requested');
    await loadExistingCBYDP();
    await loadSKMembers();
  };

  // New workflow functions
  const handleInitiateCBYDP = async () => {
    setSaving(true);
    setError('');

    try {
      // If this is a re-initiation (status is rejected), delete the old CBYDP first
      if (form.status === 'rejected' && existingCBYDPId) {
        console.log('Deleting old rejected CBYDP:', existingCBYDPId);
        await deleteCBYDP(existingCBYDPId);
        setExistingCBYDPId(null);
      }

      // Create fresh CBYDP data
      const cbydpData = {
        centers: [{ ...defaultCenter }], // Start with fresh default center
        skMembers: form.skMembers, // Keep SK members
        showLogoInPrint: true,
        status: 'open_for_editing',
        isEditingOpen: true,
        initiatedBy: user?.name,
        initiatedAt: new Date(),
        createdBy: user?.name,
        updatedAt: new Date()
      };

      // Always create a new CBYDP (since we deleted the old one if it existed)
      const newId = await createCBYDP(cbydpData);
      setExistingCBYDPId(newId);

      setForm(cbydpData as CBYDPForm);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error initiating CBYDP:', error);
      setError('Failed to initiate CBYDP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseEditing = async () => {
    setSaving(true);
    setError('');

    try {
      const cbydpData = {
        ...form,
        status: 'pending_kk_approval',
        isEditingOpen: false,
        closedBy: user?.name,
        closedAt: new Date(),
        updatedAt: new Date()
      };

      await updateCBYDP(existingCBYDPId!, cbydpData);
      setForm(prev => ({ ...prev, ...cbydpData } as CBYDPForm));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error closing editing period:', error);
      setError('Failed to close editing period. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleKKApproval = async () => {
    if (!kkProofFile) {
      setError('Please select an image file first');
      return;
    }

    if (!kkApprovalDate) {
      setError('Please select the KK approval date');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Upload the proof image to Google Drive
      console.log('Uploading KK proof image to Google Drive...');
      const imageUrl = await uploadFile(kkProofFile, 'CBYDP_KK_Proof');
      console.log('Image uploaded successfully:', imageUrl);

      // Create a new approved CBYDP with the Google Drive image URL
      const approvedCBYDPData = {
        ...form,
        status: 'approved',
        kkApprovedBy: user?.name,
        kkApprovedAt: new Date(kkApprovalDate), // Use the selected approval date
        kkProofImage: imageUrl, // Store the Google Drive URL
        approvedBy: user?.name,
        approvedAt: new Date(),
        isEditingOpen: false, // Close editing for approved CBYDP
        createdBy: user?.name,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Create the new approved CBYDP
      const newApprovedId = await createCBYDP(approvedCBYDPData);
      
      // Delete the old pending CBYDP
      if (existingCBYDPId) {
        await deleteCBYDP(existingCBYDPId);
      }

      // Update the form state with the new approved CBYDP
      setForm(approvedCBYDPData as CBYDPForm);
      setExistingCBYDPId(newApprovedId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      
             // Close the modal and clear state
       setShowKKApprovalModal(false);
       setKkProofImage('');
       setKkProofFile(null);
       setKkApprovalDate('');
      
      console.log('CBYDP approved successfully with KK proof uploaded to Google Drive');
    } catch (error) {
      console.error('Error approving with KK:', error);
      setError('Failed to approve with KK. Please try again.');
    } finally {
      setSaving(false);
    }
  };

     const handleRejectKK = async (reason: string) => {
     setSaving(true);
     setError('');

     try {
       const cbydpData = {
         ...form,
         status: 'rejected',
         rejectionReason: reason,
         updatedAt: new Date()
       };

       await updateCBYDP(existingCBYDPId!, cbydpData);
       setForm(prev => ({ ...prev, ...cbydpData } as CBYDPForm));
       setSaved(true);
       setTimeout(() => setSaved(false), 3000);
     } catch (error) {
       console.error('Error rejecting KK approval:', error);
       setError('Failed to reject KK approval. Please try again.');
     } finally {
       setSaving(false);
     }
   };

   const handleResetCBYDP = async () => {
     setSaving(true);
     setError('');

     try {
       // Delete the current approved CBYDP
       if (existingCBYDPId) {
         await deleteCBYDP(existingCBYDPId);
         console.log('Current CBYDP deleted successfully');
       }

       // Reset form to initial state
       const resetForm: CBYDPForm = {
         centers: [{ ...defaultCenter }],
         skMembers: form.skMembers, // Keep SK members
         showLogoInPrint: true,
         status: 'not_initiated',
         isEditingOpen: false,
       };

       setForm(resetForm);
       setExistingCBYDPId(null);
       setSaved(true);
       setTimeout(() => setSaved(false), 3000);

       console.log('CBYDP reset successfully. You can now create a new one.');
     } catch (error) {
       console.error('Error resetting CBYDP:', error);
       setError('Failed to reset CBYDP. Please try again.');
     } finally {
       setSaving(false);
     }
   };

  return (
    <div className="p-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-area, .print-area * { visibility: visible; }
          .print-content { position: absolute; left: 0; top: 0; width: 13in; min-height: 8.5in; background: white; }
          @page { size: 13in 8.5in landscape; margin: 8mm; }
        }
      `}</style>
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
                  {form.closedBy && (
                    <span className="text-sm text-blue-700">
                      Closed by: {form.closedBy}
                    </span>
                  )}
                  {form.kkApprovedBy && (
                    <span className="text-sm text-green-700">
                      KK Approved by: {form.kkApprovedBy}
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
                  {form.status === 'approved' && form.kkProofImage && (
                    <div className="mt-2">
                      <span className="text-sm text-green-700">KK Proof Image:</span>
                      <div className="mt-1">
                        <img 
                          src={form.kkProofImage} 
                          alt="KK Approval Proof" 
                          className="w-24 h-24 object-cover rounded border"
                          style={{ maxWidth: '96px', maxHeight: '96px' }}
                        />
                      </div>
                    </div>
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
                         {/* Initiate CBYDP - Only for Chairperson when not initiated */}
             {user?.role === 'chairperson' && form.status === 'not_initiated' && (
               <button
                 onClick={handleInitiateCBYDP}
                 disabled={saving}
                 className="btn-primary flex items-center"
               >
                 {saving ? (
                   <>
                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                     Initiating...
                   </>
                 ) : (
                   <>
                     <FileText className="h-4 w-4 mr-2" />
                     Initiate CBYDP
                   </>
                 )}
               </button>
             )}

             {/* Re-initiate CBYDP - Only for Chairperson when rejected */}
             {user?.role === 'chairperson' && form.status === 'rejected' && (
               <button
                 onClick={handleInitiateCBYDP}
                 disabled={saving}
                 className="btn-primary flex items-center"
               >
                 {saving ? (
                   <>
                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                     Re-initiating...
                   </>
                 ) : (
                   <>
                     <FileText className="h-4 w-4 mr-2" />
                     Re-initiate CBYDP
                   </>
                 )}
               </button>
             )}

            {/* Save Button - Available to all members when editing is open */}
            {form.isEditingOpen && (
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
            )}

            {/* Close Editing Period - Only for Chairperson when open for editing */}
            {user?.role === 'chairperson' && form.status === 'open_for_editing' && (
             <button
                onClick={handleCloseEditing}
               disabled={saving}
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

             {/* Reset CBYDP Button - Only for Chairperson when approved */}
             {user?.role === 'chairperson' && form.status === 'approved' && (
               <button
                 onClick={() => {
                   if (window.confirm('Are you sure you want to reset this approved CBYDP? This will delete the current one and allow you to create a new one.')) {
                     handleResetCBYDP();
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
                     Reset CBYDP
                   </>
                 )}
               </button>
             )}
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
               <div className="flex space-x-3">
                 <button
                   onClick={async () => {
                     try {
                       console.log('Form data before export:', form);
                       console.log('SK Profile data:', skProfile);
                       console.log('Current user:', user);
                       
                       // Create comprehensive payload with multiple data sources
                       const payload = {
                         form,
                         skProfile,
                         user,
                         // Add any additional context that might help
                         timestamp: new Date().toISOString(),
                         exportType: 'CBYDP'
                       };
                       
                       const data = mapCBYDPToTemplate(payload);
                       console.log('Mapped data for export:', data);
                       await exportDocxFromTemplate({
                         templatePath: '/templates/cbydp_template.docx',
                         data,
                         outputFileName: `CBYDP_${skProfile?.barangay || 'Document'}`,
                       });
                     } catch (e) {
                       console.error('CBYDP template export failed', e);
                       alert('Failed to export Word document from template.');
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
                 <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                 <div className="text-sm">
                   <strong>Note:</strong> To print the CBYDP document, you must first export it using the "Export to Word" button above, 
                   then manually add your barangay logo to the downloaded Word document, and finally print from there due to system limitations.
                 </div>
               </div>
             </div>
             
             <div className="border rounded-lg overflow-hidden bg-white">
               <div ref={printRef} className="print-content" style={{ 
                 width: '100%', 
                 maxWidth: '100%',
                 height: '600px',
                 overflow: 'auto',
                 padding: '20px',
                 fontSize: '12px',
                 lineHeight: '1.4'
               }}>
                                                      
                                                           {/* New Multipage print structure */}
                                                                   {form.centers.map((center, ci) => {
                   // Calculate how many rows can fit per page (approximately 2 rows per page to ensure "Prepared by" fits and is permanent)
                   const rowsPerPage = 2;
                   const totalRows = center.projects.length;
                   const totalPages = Math.ceil(totalRows / rowsPerPage);
                   
                   return Array.from({ length: totalPages }, (_, pageNum) => {
                     const startRow = pageNum * rowsPerPage;
                     const endRow = Math.min(startRow + rowsPerPage, totalRows);
                     const pageRows = center.projects.slice(startRow, endRow);
                    
                    return (
                      <div key={`${ci}-${pageNum}`} style={{ pageBreakAfter: 'always' }}>
                        {/* Header - repeated on every page */}
                        <div className="mb-3" style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 0, right: 0 }}>
                            <div className="text-xs font-semibold border border-gray-700 px-2 py-1">Annex "A"</div>
                          </div>
 
                          {/* Barangay Logo */}
                          {form.showLogoInPrint && skProfile?.logo && (
                            <div className="w-full flex justify-center mb-2">
                              <img src={skProfile.logo} alt="Barangay Logo" style={{ width: '0.9in', height: '0.9in', objectFit: 'cover' }} />
                            </div>
                          )}
 
                          {/* Barangay + SK */}
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
                            <div className="text-sm font-semibold">COMPREHENSIVE BARANGAY YOUTH DEVELOPMENT PLAN (CBYDP)</div>
                          </div>
 
                          {/* Region / Province / City */}
                          <div className="text-xs mb-1" style={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ marginRight: '8px' }}>Region:</span>
                              <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '1.6in' }}>{skProfile?.region || '\u00A0'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', marginRight: '24px' }}>
                                <span style={{ marginRight: '8px' }}>Province:</span>
                                <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '1.9in' }}>{skProfile?.province || '\u00A0'}</span>
                              </div>
                              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <span style={{ marginRight: '8px' }}>City/Municipality:</span>
                                <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '2.2in' }}>{skProfile?.city || '\u00A0'}</span>
                              </div>
                            </div>
                          </div>
 
                          {/* CBYDP CY ______ - ______ */}
                          <div className="text-center text-xs my-2">
                            <span>COMPREHENSIVE BARANGAY YOUTH DEVELOPMENT PLAN (CBYDP) CY</span>
                            <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '0.6in', margin: '0 0.1in' }}>
                              {skProfile?.skTermStart || '\u00A0'}
                            </span>
                            <span>-</span>
                            <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '0.6in', marginLeft: '0.1in' }}>
                              {skProfile?.skTermEnd || '\u00A0'}
                            </span>
                          </div>
                        </div>
 
                        {/* Center of Participation and Agenda - show on every page for clarity */}
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
                         
                        {/* Page indicator for multi-page centers */}
                        {totalPages > 1 && (
                          <div className="text-xs text-right mt-2 mb-2">
                            Page {pageNum + 1} of {totalPages}
                          </div>
                        )}
 
                        {/* Table with proper page break handling - allow rows to break but keep "Prepared by" together */}
                        <div>
                          <table className="w-full border border-gray-700" style={{ borderCollapse: 'collapse', fontSize: '9pt' }}>
                           <thead>
                             <tr>
                               <th style={{ width: '1.2in' }} className="border border-gray-700 p-1 text-left">Youth Development Concern</th>
                               <th style={{ width: '1.4in' }} className="border border-gray-700 p-1 text-left">Objective</th>
                               <th style={{ width: '1.3in' }} className="border border-gray-700 p-1 text-left">Performance Indicator</th>
                               <th style={{ width: '0.9in' }} className="border border-gray-700 p-1 text-left">Target</th>
                               <th style={{ width: '0.9in' }} className="border border-gray-700 p-1 text-left">Target</th>
                               <th style={{ width: '0.9in' }} className="border border-gray-700 p-1 text-left">Target</th>
                               <th style={{ width: '3.0in' }} className="border border-gray-700 p-1 text-left">PPAs</th>
                               <th style={{ width: '1.2in' }} className="border border-gray-700 p-1 text-left">Expenses</th>
                               <th style={{ width: '1.1in' }} className="border border-gray-700 p-1 text-left">Person Responsible</th>
                             </tr>
                             <tr>
                               <th className="border border-gray-700 p-1"></th>
                               <th className="border border-gray-700 p-1"></th>
                               <th className="border border-gray-700 p-1"></th>
                               <th className="border border-gray-700 p-1 text-center">[Year 1]</th>
                               <th className="border border-gray-700 p-1 text-center">[Year 2]</th>
                               <th className="border border-gray-700 p-1 text-center">[Year 3]</th>
                               <th className="border border-gray-700 p-1"></th>
                               <th className="border border-gray-700 p-1"></th>
                               <th className="border border-gray-700 p-1"></th>
                             </tr>
                           </thead>
                           <tbody>
                             {pageRows.map((project, pi) => (
                               <tr key={`${ci}-${pageNum}-${pi}`}>
                                 <td className="border border-gray-700 p-1 align-top">{project.concern}</td>
                                 <td className="border border-gray-700 p-1 align-top">{project.objective}</td>
                                 <td className="border border-gray-700 p-1 align-top">{project.indicator}</td>
                                 <td className="border border-gray-700 p-1 align-top">{project.target1}</td>
                                 <td className="border border-gray-700 p-1 align-top">{project.target2}</td>
                                 <td className="border border-gray-700 p-1 align-top">{project.target3}</td>
                                                                  <td className="border border-gray-700 p-1 align-top">
                                    <div className="text-xs space-y-1">
                                                                              {/* Programs */}
                                       {(project.programs || []).filter(p => p.trim()).length > 0 && (
                                         <div className="border-b border-gray-300 pb-1">
                                           <div><span className="font-medium">Programs:</span></div>
                                           <ul className="list-disc list-inside ml-2 mt-1">
                                             {(project.programs || []).filter(p => p.trim()).map((program, idx) => (
                                               <li key={`prog-${idx}`} className="text-xs">{program}</li>
                                             ))}
                                           </ul>
                                         </div>
                                       )}
                                      
                                                                              {/* Projects */}
                                       {(project.projects || []).filter(p => p.trim()).length > 0 && (
                                         <div className="border-b border-gray-300 pb-1">
                                           <div><span className="font-medium">Projects:</span></div>
                                           <ul className="list-disc list-inside ml-2 mt-1">
                                             {(project.projects || []).filter(p => p.trim()).map((projectItem, idx) => (
                                               <li key={`proj-${idx}`} className="text-xs">{projectItem}</li>
                                             ))}
                                           </ul>
                                         </div>
                                       )}
                                      
                                                                              {/* Actions */}
                                       {(project.actions || []).filter(p => p.trim()).length > 0 && (
                                         <div className="border-b border-gray-300 pb-1">
                                           <div><span className="font-medium">Actions:</span></div>
                                           <ul className="list-disc list-inside ml-2 mt-1">
                                             {(project.actions || []).filter(p => p.trim()).map((action, idx) => (
                                               <li key={`act-${idx}`} className="text-xs">{action}</li>
                                             ))}
                                           </ul>
                                         </div>
                                       )}
                                      
                                      {/* Show empty state if no PPA items */}
                                      {(project.programs || []).filter(p => p.trim()).length === 0 &&
                                       (project.projects || []).filter(p => p.trim()).length === 0 &&
                                       (project.actions || []).filter(p => p.trim()).length === 0 && (
                                        '\u00A0'
                                      )}
                                    </div>
                                  </td>
                                 <td className="border border-gray-700 p-1 align-top">
                                   {(project.expenses || []).map((expense, idx) => (
                                     <div key={idx} className="text-xs">
                                       {expense.description}: ₱{formatNumber(expense.cost)}
                                     </div>
                                   ))}
                                 </td>
                                 <td className="border border-gray-700 p-1 align-top">{project.responsible}</td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
 
                        {/* "Prepared by" section that appears on every page */}
                        <div className="mt-3 prepared-by-section" style={{ pageBreakInside: 'avoid' }}>
                          <div className="text-center text-xs font-semibold mb-2">Prepared by:</div>
                          <div className="flex justify-around text-center">
                            <div style={{ width: '3in' }}>
                              <div style={{ borderBottom: '1px solid #000', height: '0.25in' }}>
                                <div className="text-xs">{form.skMembers.find(m => m.position === 'SK Secretary')?.name || ''}</div>
                              </div>
                              <div className="text-xs mt-1">SK Secretary</div>
                            </div>
                            <div style={{ width: '3in' }}>
                              <div style={{ borderBottom: '1px solid #000', height: '0.25in' }}>
                                <div className="text-xs">{form.skMembers.find(m => m.position === 'SK Chairperson')?.name || ''}</div>
                              </div>
                              <div className="text-xs mt-1">SK Chairperson</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                }).flat()}

              {/* Always-last page: Header + Prepared by + Members + SK Federation */}
              <div style={{ pageBreakBefore: 'always' }}>
                {/* Header */}
                <div className="mb-6" style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0 }}>
                    <div className="text-xs font-semibold border border-gray-700 px-2 py-1">Annex "A"</div>
                  </div>

                  {/* Barangay Logo */}
                  {form.showLogoInPrint && skProfile?.logo && (
                    <div className="w-full flex justify-center mb-2">
                      <img src={skProfile.logo} alt="Barangay Logo" style={{ width: '0.9in', height: '0.9in', objectFit: 'cover' }} />
                    </div>
                  )}

                  {/* Barangay + SK */}
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
                    <div className="text-sm font-semibold">COMPREHENSIVE BARANGAY YOUTH DEVELOPMENT PLAN (CBYDP)</div>
                  </div>

                  {/* Region / Province / City */}
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

                                     {/* CBYDP CY ______ - ______ */}
                   <div className="text-center text-xs my-2">
                     <span>COMPREHENSIVE BARANGAY YOUTH DEVELOPMENT PLAN (CBYDP) CY</span>
                     <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '0.6in', margin: '0 0.1in' }}>
                       {skProfile?.skTermStart || '\u00A0'}
                     </span>
                     <span>-</span>
                     <span style={{ display: 'inline-block', borderBottom: '1px solid #000', width: '0.6in', marginLeft: '0.1in' }}>
                       {skProfile?.skTermEnd || '\u00A0'}
                     </span>
                   </div>
                </div>

                {/* Prepared by (final signatures page) */}
                <div className="mt-6">
                  <div className="text-center text-xs font-semibold mb-2">Prepared by:</div>
                  {/* Secretary and Chairperson side-by-side */}
                  <div className="flex justify-around text-center mb-6">
                    <div style={{ width: '3in' }}>
                      <div style={{ borderBottom: '1px solid #000', height: '0.25in' }}>
                        <div className="text-xs">{form.skMembers.find(m => m.position === 'SK Secretary')?.name || ''}</div>
                      </div>
                      <div className="text-xs mt-1">SK Secretary</div>
                    </div>
                    <div style={{ width: '3in' }}>
                      <div style={{ borderBottom: '1px solid #000', height: '0.25in' }}>
                        <div className="text-xs">{form.skMembers.find(m => m.position === 'SK Chairperson')?.name || ''}</div>
                      </div>
                      <div className="text-xs mt-1">SK Chairperson</div>
                    </div>
                  </div>

                                      {/* SK Members list (two columns of signature lines) */}
                    <div className="text-xs font-semibold mb-2">SK Members:</div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {form.skMembers
                        .filter(m => m.position !== 'SK Secretary' && m.position !== 'SK Chairperson' && m.position !== 'SK Treasurer')
                        .map((m, idx) => (
                          <div key={idx} className="text-center">
                            <div style={{ borderBottom: '1px solid #000', height: '0.25in' }}>
                              <div className="text-xs">{m.name || ''}</div>
                            </div>
                            <div className="text-xs mt-1">{m.position || 'SK Member'}</div>
                          </div>
                        ))}
                    </div>

                  {/* SK Federation centered below members */}
                  <div className="text-center mt-6">
                    <div style={{ width: '3in', margin: '0 auto' }}>
                      <div style={{ borderBottom: '1px solid #000', height: '0.25in' }}>
                        <div className="text-xs">{skProfile?.federationPresident || form.skMembers.find(m => (m.position || '').toLowerCase().includes('federation'))?.name || ''}</div>
                      </div>
                      <div className="text-xs mt-1">SK Federation President</div>
                    </div>
                  </div>
                </div>
              </div>
              
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
           {/* Status Messages */}
           {form.status === 'not_initiated' && (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                CBYDP has not been initiated yet. The SK Chairperson must initiate the CBYDP to begin the process.
              </div>
            )}

            {form.status === 'open_for_editing' && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                CBYDP is open for editing. All SK members can add and edit centers and projects.
              </div>
            )}

            {form.status === 'pending_kk_approval' && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                CBYDP is pending Katipunan ng Kabataan approval. The SK Chairperson must upload proof of KK approval.
              </div>
            )}

           {form.status === 'approved' && (
             <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
               <CheckCircle className="h-5 w-5 mr-2" />
                This CBYDP has been approved by Katipunan ng Kabataan and is now read-only.
             </div>
           )}

           {form.status === 'rejected' && (
             <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
               <AlertCircle className="h-5 w-5 mr-2" />
                 This CBYDP was rejected. Reason: {form.rejectionReason}. The SK Chairperson can re-initiate the CBYDP to start the process again.
             </div>
           )}

         <div className="space-y-6">
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
                         disabled={!form.isEditingOpen || form.status === 'approved'}
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
                         disabled={!form.isEditingOpen || form.status === 'approved'}
                      />
                    </div>
                  </div>

                  {/* Projects Table */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-gray-900">Projects</h4>
                       {form.isEditingOpen && (
                      <button
                        type="button"
                        onClick={() => addProject(centerIdx)}
                        className="btn-secondary flex items-center"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Project
                      </button>
                       )}
                    </div>

                                         <div className="overflow-x-auto">
                       <table className="w-full border-collapse border border-gray-300" style={{ minWidth: '1400px' }}>
                                                  <thead>
                            <tr className="bg-gray-50">
                              <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '150px' }}>Concern</th>
                              <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '150px' }}>Objective</th>
                              <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '150px' }}>Indicator</th>
                              <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '100px' }}>Target 1</th>
                              <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '100px' }}>Target 2</th>
                              <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '100px' }}>Target 3</th>
                                                            <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '300px' }}>PPAs</th>
                              <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '200px' }}>Expenses</th>
                              <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '120px' }}>Responsible</th>
                              <th className="border border-gray-300 p-2 text-left text-sm" style={{ minWidth: '80px' }}>Action</th>
                            </tr>
                          </thead>
                         <tbody>
                           {center.projects.map((project, projectIdx) => (
                             <tr key={projectIdx}>
                                                               <td className="border border-gray-300 p-2">
                                  <textarea
                                    value={project.concern}
                                    onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'concern', e.target.value)}
                                    className="w-full border-none focus:ring-0 text-sm resize-none"
                                    rows={3}
                                    style={{ minHeight: '60px' }}
                                    placeholder="Enter concern details..."
                                    disabled={!form.isEditingOpen || form.status === 'approved'}
                                  />
                                </td>
                                                               <td className="border border-gray-300 p-2">
                                  <textarea
                                    value={project.objective}
                                    onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'objective', e.target.value)}
                                    className="w-full border-none focus:ring-0 text-sm resize-none"
                                    rows={3}
                                    style={{ minHeight: '60px' }}
                                    placeholder="Enter objective details..."
                                    disabled={!form.isEditingOpen || form.status === 'approved'}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <textarea
                                    value={project.indicator}
                                    onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'indicator', e.target.value)}
                                    className="w-full border-none focus:ring-0 text-sm resize-none"
                                    rows={3}
                                    style={{ minHeight: '60px' }}
                                    placeholder="Enter indicator details..."
                                    disabled={!form.isEditingOpen || form.status === 'approved'}
                                  />
                                </td>
                               <td className="border border-gray-300 p-2">
                                 <input
                                   type="text"
                                   value={project.target1}
                                   onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'target1', e.target.value)}
                                   className="w-full border-none focus:ring-0 text-sm"
                                    disabled={!form.isEditingOpen || form.status === 'approved'}
                                 />
                               </td>
                               <td className="border border-gray-300 p-2">
                                 <input
                                   type="text"
                                   value={project.target2}
                                   onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'target2', e.target.value)}
                                   className="w-full border-none focus:ring-0 text-sm"
                                    disabled={!form.isEditingOpen || form.status === 'approved'}
                                 />
                               </td>
                               <td className="border border-gray-300 p-2">
                                 <input
                                   type="text"
                                   value={project.target3}
                                   onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'target3', e.target.value)}
                                   className="w-full border-none focus:ring-0 text-sm"
                                    disabled={!form.isEditingOpen || form.status === 'approved'}
                                 />
                               </td>
                                                                                               <td className="border border-gray-300 p-2">
                                   <div className="space-y-2">
                                     {/* Programs */}
                                     <div className="space-y-2">
                                       <div className="text-xs font-medium text-gray-600">Programs:</div>
                                       {(project.programs || []).map((program, programIdx) => (
                                         <div key={programIdx} className="flex items-center space-x-2">
                                           <input
                                             type="text"
                                             value={program}
                                             onChange={(e) => handleProgramChange(centerIdx, projectIdx, programIdx, e.target.value)}
                                             className="flex-1 border-none focus:ring-0 text-sm p-1 bg-gray-50 rounded"
                                             placeholder="Enter Program..."
                                             disabled={!form.isEditingOpen || form.status === 'approved'}
                                           />
                                           {form.isEditingOpen && (
                                             <button
                                               type="button"
                                               onClick={() => removeProgram(centerIdx, projectIdx, programIdx)}
                                               className="text-xs text-red-600 hover:text-red-700"
                                             >
                                               <Trash2 className="h-3 w-3" />
                                             </button>
                                           )}
                                         </div>
                                       ))}
                                       {form.isEditingOpen && (
                                         <button
                                           type="button"
                                           onClick={() => addProgram(centerIdx, projectIdx)}
                                           className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                                         >
                                           + Add Program
                                         </button>
                                       )}
                                     </div>

                                     {/* Projects */}
                                     <div className="space-y-2">
                                       <div className="text-xs font-medium text-gray-600">Projects:</div>
                                       {(project.projects || []).map((projectItem, projectItemIdx) => (
                                         <div key={projectItemIdx} className="flex items-center space-x-2">
                                           <input
                                             type="text"
                                             value={projectItem}
                                             onChange={(e) => handleProjectItemChange(centerIdx, projectIdx, projectItemIdx, e.target.value)}
                                             className="flex-1 border-none focus:ring-0 text-sm p-1 bg-gray-50 rounded"
                                             placeholder="Enter Project..."
                                             disabled={!form.isEditingOpen || form.status === 'approved'}
                                           />
                                           {form.isEditingOpen && (
                                             <button
                                               type="button"
                                               onClick={() => removeProjectItem(centerIdx, projectIdx, projectItemIdx)}
                                               className="text-xs text-red-600 hover:text-red-700"
                                             >
                                               <Trash2 className="h-3 w-3" />
                                             </button>
                                           )}
                                         </div>
                                       ))}
                                       {form.isEditingOpen && (
                                         <button
                                           type="button"
                                           onClick={() => addProjectItem(centerIdx, projectIdx)}
                                           className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                                         >
                                           + Add Project
                                         </button>
                                       )}
                                     </div>

                                     {/* Actions */}
                                     <div className="space-y-2">
                                       <div className="text-xs font-medium text-gray-600">Actions:</div>
                                       {(project.actions || []).map((action, actionIdx) => (
                                         <div key={actionIdx} className="flex items-center space-x-2">
                                           <input
                                             type="text"
                                             value={action}
                                             onChange={(e) => handleActionChange(centerIdx, projectIdx, actionIdx, e.target.value)}
                                             className="flex-1 border-none focus:ring-0 text-sm p-1 bg-gray-50 rounded"
                                             placeholder="Enter Action..."
                                             disabled={!form.isEditingOpen || form.status === 'approved'}
                                           />
                                           {form.isEditingOpen && (
                                             <button
                                               type="button"
                                               onClick={() => removeAction(centerIdx, projectIdx, actionIdx)}
                                               className="text-xs text-red-600 hover:text-red-700"
                                             >
                                               <Trash2 className="h-3 w-3" />
                                             </button>
                                           )}
                                         </div>
                                       ))}
                                       {form.isEditingOpen && (
                                         <button
                                           type="button"
                                           onClick={() => addAction(centerIdx, projectIdx)}
                                           className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                                         >
                                           + Add Action
                                         </button>
                                       )}
                                     </div>

                                   </div>
                                 </td>
                                                                                                                               <td className="border border-gray-300 p-2">
                                   <div className="space-y-2">
                                     {(project.expenses || []).map((expense, expenseIdx) => (
                                       <div key={expenseIdx} className="space-y-1">
                                         <input
                                           type="text"
                                           value={expense.description}
                                           onChange={(e) => handleExpenseChange(centerIdx, projectIdx, expenseIdx, 'description', e.target.value)}
                                           className="w-full border-none focus:ring-0 text-xs p-1"
                                           placeholder="Description"
                                           style={{ minHeight: '24px' }}
                                           disabled={!form.isEditingOpen || form.status === 'approved'}
                                         />
                                         <input
                                           type="text"
                                           value={handleNumberDisplay(expense.cost)}
                                           onChange={(e) => {
                                             handleNumberInput(e.target.value, (value) => {
                                               handleExpenseChange(centerIdx, projectIdx, expenseIdx, 'cost', value);
                                             });
                                           }}
                                           className="w-full border-none focus:ring-0 text-xs p-1"
                                           placeholder="Cost"
                                           style={{ minHeight: '24px' }}
                                           disabled={!form.isEditingOpen || form.status === 'approved'}
                                         />
                                       </div>
                                     ))}
                                     {form.isEditingOpen && (
                                       <button
                                         type="button"
                                         onClick={() => addExpense(centerIdx, projectIdx)}
                                         className="text-xs text-blue-600 hover:text-blue-700 mt-2"
                                       >
                                         + Add Expense
                                       </button>
                                     )}
                                   </div>
                                 </td>
                               <td className="border border-gray-300 p-2">
                                 <input
                                   type="text"
                                   value={project.responsible}
                                   onChange={(e) => handleProjectChange(centerIdx, projectIdx, 'responsible', e.target.value)}
                                   className="w-full border-none focus:ring-0 text-sm"
                                   placeholder="Enter person responsible..."
                                    disabled={!form.isEditingOpen || form.status === 'approved'}
                                 />
                               </td>
                               <td className="border border-gray-300 p-2">
                                  {form.isEditingOpen && center.projects.length > 1 && (
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

                         {form.isEditingOpen && (
            <button
              type="button"
              onClick={addCenter}
              className="btn-secondary flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Center of Participation
            </button>
             )}
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
               Please upload proof of Katipunan ng Kabataan approval for this CBYDP.
             </p>
             
                           <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Proof Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Validate file size (max 5MB)
                      if (file.size > 5 * 1024 * 1024) {
                        setError('Image file size must be less than 5MB');
                        return;
                      }
                      
                      // Validate file type
                      if (!file.type.startsWith('image/')) {
                        setError('Please select a valid image file');
                        return;
                      }
                      
                      // Store the file object for upload
                      setKkProofFile(file);
                      
                      // Create preview for display
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        setKkProofImage(e.target?.result as string);
                        setError(''); // Clear any previous errors
                      };
                      reader.onerror = () => {
                        setError('Failed to read image file');
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  KK Approval Date
                </label>
                <input
                  type="date"
                  value={kkApprovalDate}
                  onChange={(e) => setKkApprovalDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Select the date when Katipunan ng Kabataan approved this CBYDP
                </p>
              </div>

             {kkProofImage && (
               <div className="mb-4">
                 <img 
                   src={kkProofImage} 
                   alt="KK Proof" 
                   className="w-full h-32 object-cover rounded border"
                 />
               </div>
             )}

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

export default CBYDP; 