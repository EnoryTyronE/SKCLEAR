import React, { useEffect, useMemo, useState } from 'react';
import { Target, Plus, Calendar, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { getAllABYIPs, getAllSKAnnualBudgets, getProjectsByYear, upsertProject, updateProjectStatus, addProjectAttachment, deleteProjectsByYear, getProjectUpdates, addProjectUpdate, addProjectUpdateAttachment, removeProjectUpdateAttachment, clearProjectUpdateAttachments, updateProjectUpdate, updateProjectFields, ProjectDoc, ProjectUpdateDoc } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { logProjectActivity } from '../services/activityService';
import { formatTimeAgo, convertToDate } from '../services/activityService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

type AbyipDoc = any;
type BudgetDoc = any;

const Projects: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [allAbyips, setAllAbyips] = useState<AbyipDoc[]>([]);
  const [allBudgets, setAllBudgets] = useState<BudgetDoc[]>([]);
  const [year, setYear] = useState<string>('');
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [activeProject, setActiveProject] = useState<ProjectDoc | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdateDoc[]>([]);
  const [addingUpdate, setAddingUpdate] = useState(false);
  const [newUpdate, setNewUpdate] = useState<{ date: string; status: ProjectDoc['status']; description: string }>({ date: '', status: 'ongoing', description: '' });
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<{ date: string; status: ProjectDoc['status']; description: string }>({ date: '', status: 'ongoing', description: '' });
  const [notice, setNotice] = useState<string>('');
  const [showStartForm, setShowStartForm] = useState<boolean>(false);
  const [startDraft, setStartDraft] = useState<string>('');
  const [startingProject, setStartingProject] = useState<boolean>(false);
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [fileUploadName, setFileUploadName] = useState('');
  const [fileUploadDescription, setFileUploadDescription] = useState('');
  const [uploadingToUpdate, setUploadingToUpdate] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  };

  const handleFileSelect = (file: File, updateId?: string) => {
    setUploadingFile(file);
    setFileUploadName(file.name);
    setFileUploadDescription('');
    setUploadingToUpdate(updateId || null);
    setShowFileUploadModal(true);
  };

  const handleFileUpload = async () => {
    if (!uploadingFile || !fileUploadName.trim() || !activeProject || uploading) return;

    setUploading(true);
    try {
      if (uploadingToUpdate) {
        // Upload to specific update
        await addProjectUpdateAttachment(activeProject.id!, uploadingToUpdate, uploadingFile, {
          name: fileUploadName.trim(),
          description: fileUploadDescription.trim()
        });
        const list = await getProjectUpdates(activeProject.id!);
        setUpdates(list);
        
        // Log activity
        try {
          await logProjectActivity(
            'File Added',
            `Added file "${fileUploadName.trim()}" to project update`,
            { name: user?.name || 'Unknown', role: user?.role || 'member', id: user?.uid || '' },
            'completed'
          );
        } catch (activityError) {
          console.error('Error logging file upload activity:', activityError);
        }
      } else {
        // Upload to project files
        await addProjectAttachment(activeProject.id!, uploadingFile, {
          name: fileUploadName.trim(),
          description: fileUploadDescription.trim()
        });
        // Refresh project data
        const updatedProject = await getProjectsByYear(activeProject.year);
        const currentProject = updatedProject.find(p => p.id === activeProject.id);
        if (currentProject) {
          setActiveProject(currentProject);
        }
        
        // Log activity
        try {
          await logProjectActivity(
            'File Added',
            `Added file "${fileUploadName.trim()}" to project files`,
            { name: user?.name || 'Unknown', role: user?.role || 'member', id: user?.uid || '' },
            'completed'
          );
        } catch (activityError) {
          console.error('Error logging file upload activity:', activityError);
        }
        
        showNotice('Project file uploaded');
      }
      
      setShowFileUploadModal(false);
      setUploadingFile(null);
      setFileUploadName('');
      setFileUploadDescription('');
      setUploadingToUpdate(null);
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProjectFile = async (fileIndex: number) => {
    if (!activeProject || !window.confirm('Are you sure you want to delete this file?')) return;

    try {
      const updatedAttachments = (activeProject.attachments || []).filter((_, index) => index !== fileIndex);
      await updateDoc(doc(db, 'projects', activeProject.id!), {
        attachments: updatedAttachments,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setActiveProject(prev => prev ? { ...prev, attachments: updatedAttachments } : prev);
      
      // Log activity
      try {
        await logProjectActivity(
          'File Deleted',
          `Deleted file from project files`,
          { name: user?.name || 'Unknown', role: user?.role || 'member', id: user?.uid || '' },
          'completed'
        );
      } catch (activityError) {
        console.error('Error logging file delete activity:', activityError);
      }
      
      showNotice('File deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      setError('Failed to delete file. Please try again.');
    }
  };

  const handleDeleteUpdateFile = async (updateId: string, fileIndex: number) => {
    if (!activeProject || !window.confirm('Are you sure you want to delete this file?')) return;

    try {
      await removeProjectUpdateAttachment(activeProject.id!, updateId, fileIndex);
      const list = await getProjectUpdates(activeProject.id!);
      setUpdates(list);
      
      // Log activity
      try {
        await logProjectActivity(
          'File Deleted',
          `Deleted file from project update`,
          { name: user?.name || 'Unknown', role: user?.role || 'member', id: user?.uid || '' },
          'completed'
        );
      } catch (activityError) {
        console.error('Error logging file delete activity:', activityError);
      }
      
      showNotice('File deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      setError('Failed to delete file. Please try again.');
    }
  };

  // Load all approved sources
  const loadData = async () => {
    setLoading(true);
    try {
      const [abyips, budgets] = await Promise.all([
        getAllABYIPs(),
        getAllSKAnnualBudgets()
      ]);
      setAllAbyips(abyips || []);
      setAllBudgets(budgets || []);

      // Initialize year to most recent available
      const years = new Set<string>();
      (abyips || []).forEach((a: any) => a.year && years.add(a.year));
      (budgets || []).forEach((b: any) => b.year && years.add(b.year));
      const sorted = Array.from(years).sort((a, b) => parseInt(b || '0') - parseInt(a || '0'));
      if (!year && sorted.length > 0) setYear(sorted[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load persisted projects when year changes
  useEffect(() => {
    const run = async () => {
      if (!year) return;
      const list = await getProjectsByYear(year);
      setProjects(list);
    };
    run();
  }, [year]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allAbyips.forEach((a: any) => a.year && years.add(a.year));
    allBudgets.forEach((b: any) => b.year && years.add(b.year));
    return Array.from(years).sort((a, b) => parseInt(b || '0') - parseInt(a || '0'));
  }, [allAbyips, allBudgets]);

  const approvedAbyipForYear = useMemo(() => {
    return allAbyips.find((a: any) => a.year === year && a.status === 'approved');
  }, [allAbyips, year]);

  const approvedBudgetForYear = useMemo(() => {
    return allBudgets.find((b: any) => b.year === year && (b.status === 'approved' || b.status === 'approved_by_kk' || b.status === 'approved_by_lce'));
  }, [allBudgets, year]);

  const approvedAbyipCount = useMemo(() => {
    if (!approvedAbyipForYear?.centers) return 0;
    return approvedAbyipForYear.centers.reduce((sum: number, c: any) => sum + (Array.isArray(c.projects) ? c.projects.length : 0), 0);
  }, [approvedAbyipForYear]);

  const approvedBudgetProgramsCount = useMemo(() => {
    if (!approvedBudgetForYear?.programs) return 0;
    return approvedBudgetForYear.programs.reduce((sum: number, p: any) => sum + 1, 0);
  }, [approvedBudgetForYear]);

  const parseAmount = (value: any): number => {
    if (value === null || value === undefined) return 0;
    const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // Group projects by Center of Participation (centerName)
  const projectsByCenter = useMemo(() => {
    const buckets: Record<string, ProjectDoc[]> = {};
    projects.forEach((p) => {
      const key = (p.centerName || 'Uncategorized').trim();
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(p);
    });
    // Sort projects in each center by title
    Object.values(buckets).forEach(list => list.sort((a, b) => (a.title || '').localeCompare(b.title || '')));
    // Sort centers alphabetically; place Uncategorized at end
    const entries = Object.entries(buckets).sort((a, b) => {
      if (a[0] === 'Uncategorized') return 1;
      if (b[0] === 'Uncategorized') return -1;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [projects]);

  // Derive projects from approved ABYIP as candidates (not persisted yet)
  const derivedProjects = useMemo<ProjectDoc[]>(() => {
    if (!approvedAbyipForYear?.centers) return [];
    const rows: ProjectDoc[] = [];
    approvedAbyipForYear.centers.forEach((center: any) => {
      (center.projects || []).forEach((row: any) => {
        // Prefer explicit total if provided at root or under budget
        const totalRaw = (row.total ?? row.budget?.total ?? 0);
        let amount = parseAmount(totalRaw);
        if (!amount) {
          // Fallback: compute from components if total is missing/zero
          amount = parseAmount(row?.budget?.mooe) + parseAmount(row?.budget?.co) + parseAmount(row?.budget?.ps);
        }
        rows.push({
          year: year || '',
          source: 'abyip',
          referenceCode: row.referenceCode,
          title: row.ppas || row.description || 'Untitled Project',
          description: row.description || '',
          centerName: center.name,
          personResponsible: row.personResponsible || '',
          status: 'not_started',
          amount,
          period: row.periodOfImplementation || row.period || '',
          attachments: []
        });
      });
    });
    return rows;
  }, [approvedAbyipForYear, year]);

  const ensureProject = async (candidate: ProjectDoc) => {
    // If the project (by referenceCode + year) already exists, skip create
    const exists = projects.find(p => p.referenceCode && p.referenceCode === candidate.referenceCode && p.year === candidate.year);
    if (exists) return exists.id as string;
    const id = await upsertProject(candidate);
    setProjects(prev => [{ id, ...candidate }, ...prev]);
    return id;
  };

  const handleStatusChange = async (projectId: string, status: ProjectDoc['status']) => {
    setSaving(projectId);
    try {
      await updateProjectStatus(projectId, status);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status } : p));
    } finally {
      setSaving(null);
    }
  };

  const handleAttachment = async (projectId: string, file: File) => {
    setSaving(projectId);
    try {
      const url = await addProjectAttachment(projectId, file);
      setProjects(prev => prev.map(p => p.id === projectId ? {
        ...p,
        attachments: [...(p.attachments || []), { name: file.name, url, uploadedAt: new Date() }]
      } : p));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Monitoring</h1>
          <p className="text-gray-600 mt-2">
            Track and manage project progress and status
          </p>
        </div>
        <button className="btn-primary flex items-center" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Year Selector */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-sm font-medium text-gray-900">Select Year</div>
              <div className="text-xs text-gray-500">Choose the year to view projects</div>
            </div>
          </div>
          <div className="min-w-0 relative">
            <select
              className="px-4 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium appearance-none"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {availableYears.length === 0 && <option value="">No years available</option>}
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">ABYIP (Approved)</h3>
            {approvedAbyipForYear ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <div className="mt-2 text-gray-700">
            {approvedAbyipForYear ? (
              <>
                <div className="text-2xl font-bold">{approvedAbyipCount} projects</div>
                <div className="text-sm text-gray-500">
                  Approved {formatTimeAgo(convertToDate(approvedAbyipForYear.approvedAt) || convertToDate(approvedAbyipForYear.updatedAt) || convertToDate(approvedAbyipForYear.createdAt) || null)}
                </div>
              </>
            ) : (
              <div className="text-gray-500">No approved ABYIP for {year || 'selected year'}.</div>
            )}
          </div>
      </div>

      <div className="card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Annual Budget (Approved)</h3>
            {approvedBudgetForYear ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <div className="mt-2 text-gray-700">
            {approvedBudgetForYear ? (
              <>
                <div className="text-2xl font-bold">{approvedBudgetProgramsCount} programs</div>
                <div className="text-sm text-gray-500">
                  Approved {formatTimeAgo(convertToDate(approvedBudgetForYear.approvedAt) || convertToDate(approvedBudgetForYear.updatedAt) || convertToDate(approvedBudgetForYear.createdAt) || null)}
                </div>
              </>
            ) : (
              <div className="text-gray-500">No approved Annual Budget for {year || 'selected year'}.</div>
            )}
          </div>
        </div>
      </div>

      {/* Placeholder for next chunk: detailed lists */}
      <div className="card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Projects for {year || '...'}</h3>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={async () => {
              // Bulk ensure all derived projects exist without duplicates
              // Build a set of existing keys for fast de-duplication
                try {
                  setError('');
                  const existingKeys = new Set(
                    projects.map(p => (p.referenceCode && p.referenceCode.trim()) ? `ref:${p.referenceCode.trim()}|${p.year}` : `ttl:${(p.title || '').trim()}|ctr:${(p.centerName || '').trim()}|${p.year}`)
                  );

                  for (const candidate of derivedProjects) {
                    const key = (candidate.referenceCode && candidate.referenceCode.trim())
                      ? `ref:${candidate.referenceCode.trim()}|${candidate.year}`
                      : `ttl:${(candidate.title || '').trim()}|ctr:${(candidate.centerName || '').trim()}|${candidate.year}`;

                    if (existingKeys.has(key)) continue; // skip duplicates
                    const id = await ensureProject(candidate);
                    existingKeys.add(key);
                  }
                  const list = await getProjectsByYear(year);
                  setProjects(list);
                } catch (e: any) {
                  console.error('Initialize from ABYIP failed:', e);
                  setError(e?.message || 'Failed to initialize from ABYIP');
                }
              }}
              disabled={!year || loading}
            >
              Initialize from ABYIP
            </button>
            <button
              className="btn-danger text-sm"
              onClick={async () => {
                if (!year) return;
                if (!window.confirm(`This will remove all projects for ${year} and re-import from ABYIP. Continue?`)) return;
                setLoading(true);
                setError('');
                try {
                  await deleteProjectsByYear(year);
                  for (const candidate of derivedProjects) {
                    await ensureProject(candidate);
                  }
                  const list = await getProjectsByYear(year);
                  setProjects(list);
                } catch (e: any) {
                  console.error('Reinitialize (Replace) failed:', e);
                  setError(e?.message || 'Failed to reinitialize from ABYIP');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={!year || loading}
            >
              Reinitialize (Replace)
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}
        {notice && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded">
            {notice}
          </div>
        )}

        {/* Tip */}
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded text-sm">
          Tip: Click any project card to open its tracking timeline, add updates, and upload files.
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No projects yet. Click "Initialize from ABYIP" to import approved ABYIP projects for this year.</div>
        ) : (
          <div className="space-y-8">
            {projectsByCenter.map(([center, list]) => (
              <div key={center}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-semibold text-gray-900">{center}</h4>
                  <span className="text-xs text-gray-500">{list.length} project{list.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {list.map((p) => (
              <div key={p.id} className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer" onClick={async () => {
                setActiveProject(p);
                const list = await getProjectUpdates(p.id!);
                setUpdates(list);
              }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-xs text-gray-500">{p.centerName || p.source?.toUpperCase()}</div>
                    <div className="font-semibold text-gray-900">{p.title}</div>
                    {p.referenceCode && (
                      <div className="text-xs text-gray-500 mt-0.5">Ref: {p.referenceCode}</div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-line mb-3">{p.description || 'No description provided.'}</div>

                {/* Amount */}
                {typeof p.amount === 'number' && (
                  <div className="mb-2 text-sm text-gray-800">
                    Amount: <span className="font-medium">₱{(p.amount || 0).toLocaleString()}</span>
                  </div>
                )}
                {p.period && (
                  <div className="mb-2 text-xs text-gray-600">Period: {p.period}</div>
                )}

                {/* Dot stepper */}
                <div className="mb-3">
                  <div className="flex items-center gap-4">
                    {['not_started','ongoing','finished'].map((s, idx) => {
                      const active = p.status === s;
                      const completed = (p.status === 'ongoing' && idx <= 1) || (p.status === 'finished' && idx <= 2);
                      const color = completed ? 'bg-green-500' : active ? 'bg-blue-500' : 'bg-gray-300';
                      const label = s === 'not_started' ? 'Not started' : s === 'ongoing' ? 'Ongoing' : 'Finished';
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                          <span className={`text-[11px] ${completed || active ? 'text-gray-900' : 'text-gray-500'}`}>{label}</span>
                          {idx < 2 && <div className="w-10 h-0.5 bg-gray-200" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>
                    {(() => {
                      const dt = (p.updatedAt?.toDate?.() ? p.updatedAt.toDate() : (p.updatedAt ? new Date(p.updatedAt) : null));
                      return dt ? `Updated ${dt.toLocaleString()}` : '';
                    })()}
                  </span>
                  <span className="text-blue-600">Click to view timeline →</span>
                </div>
                {/* Removed inline status and attachments to focus on modal */}
              </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Overlay for Project Tracking */}
      {activeProject && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setActiveProject(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="min-w-0 pr-4">
                <div className="text-xs text-gray-500 truncate">{activeProject.centerName || activeProject.source?.toUpperCase()}</div>
                <div className="text-lg font-semibold text-gray-900 truncate">{activeProject.title}</div>
                <div className="text-xs text-gray-600 truncate">{activeProject.description || ''}</div>
                {activeProject.referenceCode && <div className="text-xs text-gray-400 mt-0.5 truncate">Ref: {activeProject.referenceCode}</div>}
              </div>
              {/* Header dot stepper */}
              <div className="hidden md:flex items-center gap-4 mx-4">
                {['not_started','ongoing','finished'].map((s, idx) => {
                  const active = activeProject.status === s;
                  const completed = (activeProject.status === 'ongoing' && idx <= 1) || (activeProject.status === 'finished' && idx <= 2);
                  const color = completed ? 'bg-green-500' : active ? 'bg-blue-500' : 'bg-gray-300';
                  const label = s === 'not_started' ? 'Not started' : s === 'ongoing' ? 'Ongoing' : 'Finished';
                  return (
                    <div key={s} className="flex items-center gap-2 whitespace-nowrap">
                      <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                      <span className={`text-xs ${completed || active ? 'text-gray-900' : 'text-gray-500'}`}>{label}</span>
                      {idx < 2 && <div className="w-10 h-0.5 bg-gray-200" />}
                    </div>
                  );
                })}
              </div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setActiveProject(null)}>✕</button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-auto">
              <div className="md:col-span-2">
                {/* Description moved to header; removed duplicate progress bar */}
                <div className="text-sm font-medium text-gray-900 mb-2">Timeline</div>
                <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                  {updates.length === 0 && (
                    <div className="text-sm text-gray-500">No updates yet.</div>
                  )}
                  {updates.map((u) => (
                    <div key={u.id} className="border rounded-md p-3">
                      {/* Header: date + status + edit controls */}
                      {editingUpdateId === u.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="date"
                              className="text-sm text-gray-700 border border-gray-300 rounded px-2 py-1"
                              value={editBuffer.date}
                              onChange={(e) => setEditBuffer(v => ({ ...v, date: e.target.value }))}
                            />
                            {/* Status editing removed; updates don't carry status */}
                            <div className="text-xs text-gray-500 whitespace-nowrap">
                              {(() => {
                                const dt = (u.updatedAt?.toDate?.() ? u.updatedAt.toDate() : (u.updatedAt ? new Date(u.updatedAt) : null));
                                return dt ? `Edited: ${dt.toLocaleString()}` : '';
                              })()}
                            </div>
                          </div>
                          <textarea
                            className="w-full text-sm text-gray-800 whitespace-pre-line border border-gray-300 rounded px-2 py-1"
                            rows={4}
                            value={editBuffer.description}
                            onChange={(e) => setEditBuffer(v => ({ ...v, description: e.target.value }))}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              className="btn-primary btn-sm"
                              onClick={async () => {
                                try {
                                  await updateProjectUpdate(
                                    activeProject.id!,
                                    u.id!,
                                    {
                                      date: new Date(editBuffer.date),
                                      description: editBuffer.description
                                    }
                                  );
                                  const list = await getProjectUpdates(activeProject.id!);
                                  setUpdates(list);
                                  setEditingUpdateId(null);
                                  showNotice('Update saved successfully');
                                } catch (err) {
                                  console.error('Save update failed:', err);
                                  setError('Failed to save update.');
                                }
                              }}
                            >
                              Save
                            </button>
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => setEditingUpdateId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600 flex items-center gap-2">
                              <span>{(u.date?.toDate?.() ? u.date.toDate() : new Date(u.date)).toLocaleDateString()}</span>
                              {(() => {
                                const edited = (u.updatedAt?.toDate?.() ? u.updatedAt.toDate() : (u.updatedAt ? new Date(u.updatedAt) : null));
                                const created = (u.createdAt?.toDate?.() ? u.createdAt.toDate() : (u.createdAt ? new Date(u.createdAt) : null));
                                const show = !!(edited && created && (edited.getTime() - created.getTime() > 1000));
                                return show ? <span className="text-xs text-gray-500">{`(edited: ${edited.toLocaleString()})`}</span> : null;
                              })()}
                            </div>
                          <div className="flex items-center gap-2">
                              <button
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() => {
                                  const d = (u.date?.toDate?.() ? u.date.toDate() : new Date(u.date));
                                  setEditBuffer({
                                    date: d.toISOString().slice(0, 10),
                                    status: 'ongoing',
                                    description: u.description || ''
                                  });
                                  setEditingUpdateId(u.id!);
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                          <div className="text-sm text-gray-800 whitespace-pre-line mt-2">{u.description}</div>
                        </div>
                      )}
                      {(u.files || []).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {(u.files || []).map((f, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-2 border border-gray-200 rounded">
                              <span className="text-sm text-gray-500 flex-shrink-0">File {idx + 1}.</span>
                              <div className="flex-1 min-w-0">
                                <a href={f.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline block truncate">{f.name}</a>
                                {f.description && (
                                  <div className="text-xs text-gray-500 mt-1">{f.description}</div>
                                )}
                              </div>
                              <button
                                className="text-xs text-red-600 hover:underline flex-shrink-0 px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                                onClick={() => handleDeleteUpdateFile(u.id!, idx)}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                          <div>
                            <button
                              className="text-xs text-red-600 hover:underline"
                              onClick={async () => {
                                try {
                                  await clearProjectUpdateAttachments(activeProject.id!, u.id!);
                                  const list = await getProjectUpdates(activeProject.id!);
                                  setUpdates(list);
                                } catch (err) {
                                  console.error('Clear files failed:', err);
                                  setError('Failed to clear files.');
                                }
                              }}
                            >
                              Remove all files
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="mt-2">
                        <label className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm cursor-pointer hover:bg-gray-50">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileSelect(file, u.id!);
                              }
                              e.currentTarget.value = '';
                            }}
                          />
                          Add File
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-1">
                {/* Edit project fields */}
                <div className="card p-3 mb-4 border border-gray-200 rounded">
                  <div className="text-sm font-medium text-gray-900 mb-2">Project Details</div>
                  <div className="space-y-2">
                    <label className="block text-xs text-gray-600">Title</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-md" value={activeProject.title}
                      onChange={(e) => setActiveProject(prev => prev ? ({ ...prev, title: e.target.value }) : prev)}
                      onBlur={async (e) => { try { await updateProjectFields(activeProject.id!, { title: e.target.value }); showNotice('Project title updated'); } catch {}
                      }}
                    />
                    <label className="block text-xs text-gray-600">Description</label>
                    <textarea className="w-full px-3 py-2 border border-gray-300 rounded-md" rows={4} value={activeProject.description || ''}
                      onChange={(e) => setActiveProject(prev => prev ? ({ ...prev, description: e.target.value }) : prev)}
                      onBlur={async (e) => { try { await updateProjectFields(activeProject.id!, { description: e.target.value }); showNotice('Project description updated'); } catch {}
                      }}
                    />
                    {/* Start Project flow */}
                    {!activeProject.startDate && (
                      <div className="mt-2">
                        {!showStartForm ? (
                          <button className="btn-primary w-full" onClick={() => setShowStartForm(true)}>Start Project</button>
                        ) : (
                          <div className="space-y-2">
                            <label className="block text-xs text-gray-600">Select start date</label>
                            <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md" value={startDraft}
                              onChange={(e) => setStartDraft(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                className="btn-primary flex-1"
                                disabled={!startDraft || startingProject}
                                onClick={async () => {
                                  if (startingProject) return; // Prevent double-clicks
                                  try {
                                    setStartingProject(true);
                                    const d = new Date(startDraft);
                                    await updateProjectFields(activeProject.id!, { startDate: d });
                                    // initial timeline entry
                                    await addProjectUpdate(activeProject.id!, { date: d, status: 'ongoing', description: 'Project started', files: [] });
                                    // move to ongoing
                                    await updateProjectStatus(activeProject.id!, 'ongoing');
                                    try {
                                      await logProjectActivity('Started', `${activeProject.title} (Ref: ${activeProject.referenceCode || 'N/A'}) started on ${d.toLocaleDateString()}`, { name: user?.name || 'Unknown', role: user?.role || 'member', id: user?.uid || '' }, 'completed');
                                    } catch {}
                                    setActiveProject(prev => prev ? ({ ...prev, startDate: d, status: 'ongoing' }) : prev);
                                    // update projects list so cards reflect started status
                                    setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, startDate: d, status: 'ongoing' } : p));
                                    const list = await getProjectUpdates(activeProject.id!);
                                    setUpdates(list);
                                    setShowStartForm(false);
                                    setStartDraft('');
                                    showNotice('Project started');
                                  } catch (err) {
                                    console.error(err);
                                  } finally {
                                    setStartingProject(false);
                                  }
                                }}
                              >
                                {startingProject ? 'Starting...' : 'Confirm Start'}
                              </button>
                              <button className="btn-secondary flex-1" onClick={() => { setShowStartForm(false); setStartDraft(''); setStartingProject(false); }}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* After start: show action button to finish (no dropdown) */}
                    {activeProject.startDate && (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs text-gray-600">Current Status: <span className="font-medium text-gray-900">{activeProject.status === 'finished' ? 'Finished' : 'Ongoing'}</span></div>
                        {activeProject.status !== 'finished' && (
                          <button
                            className="btn-primary w-full"
                            onClick={async () => {
                              try {
                                const hasProof = (updates.some(u => (u.files || []).length > 0)) || (activeProject.attachments || []).length > 0;
                                if (!hasProof) {
                                  alert('Please upload at least one proof document/photo before marking as Finished.');
                                  return;
                                }
                              await updateProjectStatus(activeProject.id!, 'finished');
                                setActiveProject(prev => prev ? ({ ...prev, status: 'finished' }) : prev);
                              try {
                                await logProjectActivity('Finished', `${activeProject.title} marked as finished`, { name: user?.name || 'Unknown', role: user?.role || 'member', id: user?.uid || '' }, 'completed');
                              } catch {}
                                showNotice('Project marked as Finished');
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                          >
                            Mark as Finished
                          </button>
                        )}
                      </div>
                    )}
                    <div className="mt-2">
                      <div className="text-sm font-medium text-gray-900 mb-1">Project Files</div>
                      <label className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm cursor-pointer hover:bg-gray-50">
                        <input type="file" className="hidden" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileSelect(file);
                            }
                            e.currentTarget.value = '';
                          }}
                        />
                        Add File
                      </label>
                      {(activeProject.attachments || []).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {(activeProject.attachments || []).map((f, idx) => (
                            <div key={idx} className="text-sm text-gray-700 flex items-start gap-3 p-2 border border-gray-200 rounded">
                              <span className="text-gray-500 flex-shrink-0">File {idx + 1}.</span>
                              <div className="flex-1 min-w-0">
                                <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline block truncate">{f.name}</a>
                                {f.description ? (
                                  <div className="text-xs text-gray-500 mt-1">{f.description}</div>
                                ) : null}
                              </div>
                              <button
                                className="text-xs text-red-600 hover:underline flex-shrink-0 px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                                onClick={() => handleDeleteProjectFile(idx)}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-sm font-medium text-gray-900 mb-2">Add Update</div>
                <div className="space-y-2">
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={newUpdate.date}
                    onChange={(e) => setNewUpdate(v => ({ ...v, date: e.target.value }))}
                  />
                  {/* Status removed: updates are always ongoing entries */}
                  <textarea className="w-full px-3 py-2 border border-gray-300 rounded-md" rows={5} placeholder="What happened?"
                    value={newUpdate.description}
                    onChange={(e) => setNewUpdate(v => ({ ...v, description: e.target.value }))}
                  />
                  <button
                    className="btn-primary w-full"
                    disabled={addingUpdate || !newUpdate.date || !newUpdate.description}
                    onClick={async () => {
                      try {
                        setAddingUpdate(true);
                        await addProjectUpdate(activeProject.id!, {
                          date: new Date(newUpdate.date),
                          status: 'ongoing',
                          description: newUpdate.description,
                          files: []
                        });
                        try {
                          await logProjectActivity('Updated', `${activeProject.title}: ${newUpdate.description}`, { name: user?.name || 'Unknown', role: user?.role || 'member', id: user?.uid || '' }, 'completed');
                        } catch {}
                        const list = await getProjectUpdates(activeProject.id!);
                        setUpdates(list);
                        setNewUpdate({ date: '', status: 'ongoing', description: '' });
                        showNotice('New update added');
                      } finally {
                        setAddingUpdate(false);
                      }
                    }}
                  >
                    {addingUpdate ? 'Adding...' : 'Add Update'}
                  </button>
                </div>
              </div>
        </div>
      </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showFileUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowFileUploadModal(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Upload File</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">File Name</label>
                <input
                  type="text"
                  value={fileUploadName}
                  onChange={(e) => setFileUploadName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter file name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  value={fileUploadDescription}
                  onChange={(e) => setFileUploadDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter file description"
                />
              </div>
              {uploadingFile && (
                <div className="text-sm text-gray-600">
                  Selected file: <span className="font-medium">{uploadingFile.name}</span> ({(uploadingFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleFileUpload}
                disabled={!fileUploadName.trim() || uploading}
                className="btn-primary flex-1"
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
              <button
                onClick={() => {
                  setShowFileUploadModal(false);
                  setUploadingFile(null);
                  setFileUploadName('');
                  setFileUploadDescription('');
                  setUploadingToUpdate(null);
                }}
                disabled={uploading}
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

export default Projects; 