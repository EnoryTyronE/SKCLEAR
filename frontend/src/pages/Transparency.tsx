import React, { useState, useEffect } from 'react';
import { Eye, Upload, Download, History, Filter, ChevronDown, ChevronRight, RefreshCw, Users, FileText, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logTransparencyActivity, getAllActivities, Activity, formatTimeAgo } from '../services/activityService';
import { getAllABYIPs, getAllSKAnnualBudgets, getAllCBYDP, getProjectsByYear, getSKMembers, getSKProfile } from '../services/firebaseService';

const Transparency: React.FC = () => {
  const { user } = useAuth();
  
  // Year + public data state
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [abyips, setAbyips] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [cbydps, setCbydps] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  // Activity History state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    module: '',
    dateFrom: '',
    dateTo: ''
  });
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Preview modals state
  const [showABYIPPreview, setShowABYIPPreview] = useState(false);
  const [showBudgetPreview, setShowBudgetPreview] = useState(false);
  const [showCBYDPPreview, setShowCBYDPPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'scanned' | 'proof'>('preview');

  // Load approved docs and members
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [aby, bud, cby, pro, mem, prof] = await Promise.all([
          getAllABYIPs(),
          getAllSKAnnualBudgets(),
          getAllCBYDP(),
          getProjectsByYear(selectedYear),
          getSKMembers(),
          getSKProfile()
        ]);
        setAbyips(aby);
        setBudgets(bud);
        setCbydps(cby);
        setProjects(pro);
        setMembers(mem);
        setProfile(prof);
      } catch (err) {
        console.error('Transparency data load failed:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedYear]);

  // Fetch activities
  const fetchActivities = async (reset = false) => {
    setLoading(true);
    try {
      // Build filter object (module + date range)
      const filterObj = {
        ...(filters.module ? { module: filters.module } : {}),
        ...(filters.dateFrom ? { dateFrom: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { dateTo: new Date(filters.dateTo) } : {})
      } as any;

      console.log('Fetching activities with filters:', filterObj);
      
      const result = await getAllActivities(
        Object.keys(filterObj).length ? filterObj : undefined,
        20,
        reset ? undefined : lastDoc
      );
      
      
      if (reset) {
        setActivities(result.activities);
      } else {
        setActivities(prev => [...prev, ...result.activities]);
      }
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load more activities
  const loadMoreActivities = () => {
    if (hasMore && !loading && !isLoadingMore && lastDoc) {
      console.log('Loading more activities, lastDoc:', lastDoc.id);
      setIsLoadingMore(true);
      fetchActivities(false).finally(() => {
        setIsLoadingMore(false);
      });
    } else if (!lastDoc) {
      console.log('No lastDoc available, cannot load more');
    }
  };

  // Apply filters
  const applyFilters = () => {
    setLastDoc(null);
    fetchActivities(true);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({ module: '', dateFrom: '', dateTo: '' });
    setLastDoc(null);
    fetchActivities(true);
  };

  // Load activities when component mounts
  useEffect(() => {
    if (showActivityHistory) {
      fetchActivities(true);
    }
  }, [showActivityHistory]);

  // Auto-apply filters when they change (with debounce)
  useEffect(() => {
    if (showActivityHistory) {
      const timeoutId = setTimeout(() => {
        setLastDoc(null);
        fetchActivities(true);
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [filters.module, filters.dateFrom, filters.dateTo]);

  const handleUploadReport = async () => {
    // For now, just log the activity when upload button is clicked
    try {
      await logTransparencyActivity(
        'Report Upload Attempted',
        'User attempted to upload a transparency report',
        { name: user?.name || 'Unknown', role: user?.role || 'member', id: user?.uid || '' },
        'pending'
      );
      alert('Upload functionality will be implemented soon!');
    } catch (error) {
      console.error('Error logging transparency activity:', error);
    }
  };

  const openPreview = (document: any, type: 'abyip' | 'budget' | 'cbydp') => {
    setPreviewDocument(document);
    setActiveTab('preview');
    if (type === 'abyip') setShowABYIPPreview(true);
    else if (type === 'budget') setShowBudgetPreview(true);
    else if (type === 'cbydp') setShowCBYDPPreview(true);
  };

  const closePreview = () => {
    setShowABYIPPreview(false);
    setShowBudgetPreview(false);
    setShowCBYDPPreview(false);
    setPreviewDocument(null);
    setActiveTab('preview');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transparency Portal</h1>
          <p className="text-gray-600 mt-2">
            Public view of approved plans, budgets, projects, and officials
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-gray-500">View Year</div>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-sm"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return <option key={y} value={y.toString()}>{y}</option>;
                })}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <button 
            className="btn-primary flex items-center"
            onClick={handleUploadReport}
          >
          <Upload className="h-4 w-4 mr-2" />
          Upload Report
        </button>
      </div>
      </div>

      {/* Document Archive Layout */}
      <div className="max-w-4xl mx-auto space-y-8">
        {/* CBYDP Section */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">CBYDP</h2>
          <div className="w-full max-w-2xl mx-auto">
            {cbydps.filter((c: any) => c.status === 'approved').length > 0 ? (
              cbydps
                .filter((c: any) => c.status === 'approved')
                .sort((a: any, b: any) => (b.year || '').localeCompare(a.year || ''))
                .slice(0, 1)
                .map((c: any) => (
                  <div 
                    key={c.id} 
                    onClick={() => openPreview(c, 'cbydp')}
                    className="card p-8 cursor-pointer hover:shadow-lg transition-shadow duration-200"
                  >
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 mb-2">CBYDP {c.year}</div>
                      <div className="text-sm text-gray-600">
                        Approved: {new Date(c.kkApprovedAt || c.updatedAt || Date.now()).toLocaleDateString()}
                      </div>
                      <div className="mt-4 text-blue-600 text-sm font-medium">
                        Click to view details
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div className="card p-8">
                <div className="text-gray-500 text-lg text-center">No approved CBYDP available</div>
              </div>
            )}
          </div>
        </div>

        {/* ABYIP Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-left">ABYIP</h2>
          <div className="grid grid-cols-3 gap-4">
            {['2023', '2024', '2025'].map((year) => {
              const abyip = abyips.find((a: any) => a.year === year && a.status === 'approved');
              return (
                <div 
                  key={year} 
                  onClick={() => abyip && openPreview(abyip, 'abyip')}
                  className={`card p-6 text-center transition-all duration-200 ${
                    abyip ? 'cursor-pointer hover:shadow-lg hover:scale-105' : 'opacity-50'
                  }`}
                >
                  <div className="text-xl font-bold text-gray-900 mb-2">{year}</div>
                  {abyip ? (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">
                        Approved: {new Date(abyip.kkApprovedAt || abyip.approvedAt || abyip.updatedAt || Date.now()).toLocaleDateString()}
                      </div>
                      <div className="text-blue-600 text-sm font-medium">
                        Click to view details
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Not available</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* BUDGET Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-left">BUDGET</h2>
          <div className="grid grid-cols-3 gap-4">
            {['2023', '2024', '2025'].map((year) => {
              const budget = budgets.find((b: any) => b.year === year && b.status === 'approved');
              return (
                <div 
                  key={year} 
                  onClick={() => budget && openPreview(budget, 'budget')}
                  className={`card p-6 text-center transition-all duration-200 ${
                    budget ? 'cursor-pointer hover:shadow-lg hover:scale-105' : 'opacity-50'
                  }`}
                >
                  <div className="text-xl font-bold text-gray-900 mb-2">{year}</div>
                  {budget ? (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">
                        Approved: {new Date(budget.approvedAt || budget.updatedAt || Date.now()).toLocaleDateString()}
                      </div>
                      <div className="text-blue-600 text-sm font-medium">
                        Click to view details
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Not available</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Projects Section */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-orange-600" />
              <h2 className="text-xl font-semibold">Projects {selectedYear}</h2>
            </div>
            <a href="/projects" className="text-blue-600 text-sm hover:underline">View All Projects</a>
          </div>
          {projects.length === 0 ? (
            <div className="text-gray-500">No projects found for {selectedYear}.</div>
          ) : (
            <div className="space-y-3">
              {projects.map((p: any) => (
                <div key={p.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{p.title}</div>
                      <div className="text-sm text-gray-600">
                        {p.centerName || 'General'} • {p.period || 'N/A'} • Amount: ₱{p.amount?.toLocaleString() || '0'}
                      </div>
                      {p.startDate && (
                        <div className="text-xs text-gray-500">
                          Started: {new Date(p.startDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        p.status === 'finished' ? 'bg-green-100 text-green-800' : 
                        p.status === 'ongoing' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {p.status}
                      </span>
                      <a href="/projects" className="btn-secondary text-sm">View Details</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

        {/* SK Members Directory */}
      <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">SK Officials Directory</h2>
          </div>
          <div className="mb-4 text-sm text-gray-600">
            {profile?.barangay || ''} {profile?.city ? `• ${profile.city}` : ''}
          </div>
          {members.length === 0 ? (
            <div className="text-gray-500">No SK members found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {members.map((m: any) => (
                <div key={m.id} className="border border-gray-200 rounded-lg p-4 text-center">
                  <div className="font-medium text-gray-900 mb-1">{m.name}</div>
                  <div className="text-sm text-gray-600 capitalize">{m.position?.replace('_', ' ') || 'Member'}</div>
                  {m.contact && (
                    <div className="text-xs text-gray-500 mt-1">{m.contact}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity History Section */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <History className="h-5 w-5 text-blue-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Activity History</h2>
            </div>
            <button
              onClick={() => setShowActivityHistory(!showActivityHistory)}
              className="flex items-center text-blue-600 hover:text-blue-700"
            >
              {showActivityHistory ? (
                <ChevronDown className="h-4 w-4 mr-1" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-1" />
              )}
              {showActivityHistory ? 'Hide' : 'Show'} History
            </button>
          </div>
        </div>

        {showActivityHistory && (
          <div className="p-6">
            {/* Filters */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filters
                  {showFilters ? (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronRight className="h-4 w-4 ml-1" />
                  )}
                </button>
                <button
                  onClick={() => fetchActivities(true)}
                  disabled={loading}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
                    <select
                      value={filters.module}
                      onChange={(e) => setFilters(prev => ({ ...prev, module: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Modules</option>
                      <option value="ABYIP">ABYIP</option>
                      <option value="CBYDP">CBYDP</option>
                      <option value="Financial">Financial</option>
                      <option value="Projects">Projects</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <button
                      onClick={applyFilters}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Apply Filters
                    </button>
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Clear Filters
                    </button>
                    {/* Debug button removed */}
                    <div className="text-sm text-gray-500 flex items-center">
                      <span className="text-xs">Filters apply automatically</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Activities List */}
            <div className="space-y-3">
              {activities.length === 0 && !loading ? (
                <div className="text-center py-8 text-gray-500">
                  No activities found. Try adjusting your filters or check back later.
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                            {activity.module}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">{activity.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <span>By: {activity.member?.name || 'Unknown'} ({activity.member?.role || 'Unknown'})</span>
                          <span className="mx-2">•</span>
                          <span>{formatTimeAgo(activity.timestamp)}</span>
                        </div>
        </div>
      </div>
                  </div>
                ))
              )}

              {/* Load More Button */}
              {hasMore && (
                <div className="text-center pt-4">
                  <button
                    onClick={loadMoreActivities}
                    disabled={loading || isLoadingMore}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading || isLoadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}

              {loading && activities.length === 0 && (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500">Loading activities...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview Modals */}
      {showABYIPPreview && previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">ABYIP {previewDocument.year}</h3>
                <button onClick={closePreview} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'preview'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Print Preview
                </button>
                <button
                  onClick={() => setActiveTab('scanned')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'scanned'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Scanned Documents
                </button>
                <button
                  onClick={() => setActiveTab('proof')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'proof'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Proof & Evidence
                </button>
              </nav>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {activeTab === 'preview' && (
                <div className="bg-gray-50 p-8 rounded-lg">
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">ANNUAL BARANGAY YOUTH INVESTMENT PROGRAM (ABYIP)</h1>
                    <p className="text-lg text-gray-700">Calendar Year {previewDocument.year}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      {profile?.barangay || ''} {profile?.city ? `• ${profile.city}` : ''}
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    {previewDocument.centers?.map((center: any, index: number) => (
                      <div key={index} className="border border-gray-300 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">{center.center_name}</h3>
                        <div className="space-y-3">
                          {center.projects?.map((project: any, pIndex: number) => (
                            <div key={pIndex} className="bg-white p-3 rounded border">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Reference Code:</span>
                                  <p>{project.referenceCode || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="font-medium">PPAs:</span>
                                  <p>{project.ppas || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Description:</span>
                                  <p>{project.description || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Amount:</span>
                                  <p>₱{project.amount?.toLocaleString() || '0'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 text-right">
                          <span className="font-semibold">Center Subtotal: ₱{center.centerSubtotal?.toLocaleString() || '0'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8 text-right">
                    <div className="text-lg font-bold">
                      Total ABYIP Amount: ₱{previewDocument.centers?.reduce((sum: number, center: any) => sum + (center.centerSubtotal || 0), 0)?.toLocaleString() || '0'}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'scanned' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Scanned Documents</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {previewDocument.kkApprovedAbyipUrl && (
                      <div className="card p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">Approved ABYIP PDF</h5>
                            <p className="text-sm text-gray-600">Scanned approved document</p>
                          </div>
                          <a 
                            href={previewDocument.kkApprovedAbyipUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-primary text-sm"
                          >
                            <Download className="h-4 w-4 mr-1" /> Download
                          </a>
                        </div>
                      </div>
                    )}
                    {previewDocument.kkMinutesUrl && (
                      <div className="card p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">Minutes of Meeting</h5>
                            <p className="text-sm text-gray-600">Meeting minutes document</p>
                          </div>
                          <a 
                            href={previewDocument.kkMinutesUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-primary text-sm"
                          >
                            <Download className="h-4 w-4 mr-1" /> Download
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  {!previewDocument.kkApprovedAbyipUrl && !previewDocument.kkMinutesUrl && (
                    <div className="text-center text-gray-500 py-8">No scanned documents available</div>
                  )}
                </div>
              )}

              {activeTab === 'proof' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Proof & Evidence</h4>
                  <div className="space-y-4">
                    {previewDocument.kkProofImage && (
                      <div className="card p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">Approval Proof</h5>
                            <p className="text-sm text-gray-600">Evidence of approval</p>
                          </div>
                          <a 
                            href={previewDocument.kkProofImage} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-primary text-sm"
                          >
                            <Download className="h-4 w-4 mr-1" /> View
                          </a>
                        </div>
                      </div>
                    )}
                    <div className="card p-4">
                      <h5 className="font-medium text-gray-900 mb-2">Approval Information</h5>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Approved By:</span> {previewDocument.kkApprovedBy || 'N/A'}</div>
                        <div><span className="font-medium">Approved At:</span> {new Date(previewDocument.kkApprovedAt || previewDocument.approvedAt || previewDocument.updatedAt || Date.now()).toLocaleString()}</div>
                        <div><span className="font-medium">Status:</span> <span className="text-green-600 font-medium">Approved</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showBudgetPreview && previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Annual Budget {previewDocument.year}</h3>
                <button onClick={closePreview} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'preview'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Print Preview
                </button>
                <button
                  onClick={() => setActiveTab('scanned')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'scanned'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Scanned Documents
                </button>
                <button
                  onClick={() => setActiveTab('proof')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'proof'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Proof & Evidence
                </button>
              </nav>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {activeTab === 'preview' && (
                <div className="bg-gray-50 p-8 rounded-lg">
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">SANGUNIANG KABATAAN ANNUAL BUDGET</h1>
                    <p className="text-lg text-gray-700">Calendar Year {previewDocument.year}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      {profile?.barangay || ''} {profile?.city ? `• ${profile.city}` : ''}
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="bg-white p-4 rounded border">
                      <h3 className="text-lg font-semibold mb-3">Overall Budget Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Total Budget Amount:</span>
                          <p>₱{previewDocument.overallBudgetAmount?.toLocaleString() || '0'}</p>
                        </div>
                        <div>
                          <span className="font-medium">SK Resolution No.:</span>
                          <p>{previewDocument.skResolutionNo || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded border">
                      <h3 className="text-lg font-semibold mb-3">Youth Development Programs</h3>
                      <div className="space-y-3">
                        {previewDocument.youthPrograms?.map((program: any, index: number) => (
                          <div key={index} className="border border-gray-200 rounded p-3">
                            <h4 className="font-medium mb-2">{program.program_name}</h4>
                            <div className="space-y-2">
                              {program.centers?.map((center: any, cIndex: number) => (
                                <div key={cIndex} className="bg-gray-50 p-2 rounded">
                                  <div className="font-medium">{center.center_name}</div>
                                  <div className="text-sm text-gray-600">
                                    Total: ₱{center.total_amount?.toLocaleString() || '0'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'scanned' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Scanned Documents</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {previewDocument.approvalEvidence?.budgetPdfUrl && (
                      <div className="card p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">Approved Budget PDF</h5>
                            <p className="text-sm text-gray-600">Scanned approved budget document</p>
                          </div>
                          <a 
                            href={previewDocument.approvalEvidence.budgetPdfUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-primary text-sm"
                          >
                            <Download className="h-4 w-4 mr-1" /> Download
                          </a>
                        </div>
                      </div>
                    )}
                    {previewDocument.approvalEvidence?.minutesUrl && (
                      <div className="card p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">Minutes of Meeting</h5>
                            <p className="text-sm text-gray-600">Council meeting minutes</p>
                          </div>
                          <a 
                            href={previewDocument.approvalEvidence.minutesUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-primary text-sm"
                          >
                            <Download className="h-4 w-4 mr-1" /> Download
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  {!previewDocument.approvalEvidence?.budgetPdfUrl && !previewDocument.approvalEvidence?.minutesUrl && (
                    <div className="text-center text-gray-500 py-8">No scanned documents available</div>
                  )}
                </div>
              )}

              {activeTab === 'proof' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Proof & Evidence</h4>
                  <div className="space-y-4">
                    {previewDocument.approvalEvidence?.meetingPhotos && previewDocument.approvalEvidence.meetingPhotos.length > 0 && (
                      <div className="card p-4">
                        <h5 className="font-medium text-gray-900 mb-3">Meeting Photos</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {previewDocument.approvalEvidence.meetingPhotos.map((photo: string, index: number) => (
                            <div key={index} className="relative">
                              <img 
                                src={photo} 
                                alt={`Meeting photo ${index + 1}`}
                                className="w-full h-32 object-cover rounded border"
                              />
                              <a 
                                href={photo} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="absolute top-2 right-2 bg-white bg-opacity-80 rounded-full p-1 hover:bg-opacity-100"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="card p-4">
                      <h5 className="font-medium text-gray-900 mb-2">Approval Information</h5>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Approved By:</span> {previewDocument.approvedBy || 'N/A'}</div>
                        <div><span className="font-medium">Approved At:</span> {new Date(previewDocument.approvedAt || previewDocument.updatedAt || Date.now()).toLocaleString()}</div>
                        <div><span className="font-medium">Status:</span> <span className="text-green-600 font-medium">Approved</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCBYDPPreview && previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">CBYDP {previewDocument.year}</h3>
                <button onClick={closePreview} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'preview'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Print Preview
                </button>
                <button
                  onClick={() => setActiveTab('scanned')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'scanned'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Scanned Documents
                </button>
                <button
                  onClick={() => setActiveTab('proof')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'proof'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Proof & Evidence
                </button>
              </nav>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {activeTab === 'preview' && (
                <div className="bg-gray-50 p-8 rounded-lg">
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">COMPREHENSIVE BARANGAY YOUTH DEVELOPMENT PLAN (CBYDP)</h1>
                    <p className="text-lg text-gray-700">Calendar Year {previewDocument.year}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      {profile?.barangay || ''} {profile?.city ? `• ${profile.city}` : ''}
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    {previewDocument.centers?.map((center: any, index: number) => (
                      <div key={index} className="border border-gray-300 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{center.name}</h3>
                        <p className="text-sm text-gray-600 mb-4">{center.agenda}</p>
                        
                        <div className="space-y-3">
                          {center.projects?.map((project: any, pIndex: number) => (
                            <div key={pIndex} className="bg-white p-3 rounded border">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Concern:</span>
                                  <p>{project.concern || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Objective:</span>
                                  <p>{project.objective || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Indicator:</span>
                                  <p>{project.indicator || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Responsible:</span>
                                  <p>{project.responsible || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'scanned' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Scanned Documents</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {previewDocument.kkApprovedPdfUrl && (
                      <div className="card p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">Approved CBYDP PDF</h5>
                            <p className="text-sm text-gray-600">Scanned approved CBYDP document</p>
                          </div>
                          <a 
                            href={previewDocument.kkApprovedPdfUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-primary text-sm"
                          >
                            <Download className="h-4 w-4 mr-1" /> Download
                          </a>
                        </div>
                      </div>
                    )}
                    {previewDocument.kkMinutesUrl && (
                      <div className="card p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">Minutes of Meeting</h5>
                            <p className="text-sm text-gray-600">Meeting minutes document</p>
                          </div>
                          <a 
                            href={previewDocument.kkMinutesUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-primary text-sm"
                          >
                            <Download className="h-4 w-4 mr-1" /> Download
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  {!previewDocument.kkApprovedPdfUrl && !previewDocument.kkMinutesUrl && (
                    <div className="text-center text-gray-500 py-8">No scanned documents available</div>
                  )}
                </div>
              )}

              {activeTab === 'proof' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Proof & Evidence</h4>
                  <div className="space-y-4">
                    {previewDocument.kkProofImage && (
                      <div className="card p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">Approval Proof</h5>
                            <p className="text-sm text-gray-600">Evidence of approval</p>
                          </div>
                          <a 
                            href={previewDocument.kkProofImage} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-primary text-sm"
                          >
                            <Download className="h-4 w-4 mr-1" /> View
                          </a>
                        </div>
                      </div>
                    )}
                    <div className="card p-4">
                      <h5 className="font-medium text-gray-900 mb-2">Approval Information</h5>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Approved By:</span> {previewDocument.kkApprovedBy || 'N/A'}</div>
                        <div><span className="font-medium">Approved At:</span> {new Date(previewDocument.kkApprovedAt || previewDocument.updatedAt || Date.now()).toLocaleString()}</div>
                        <div><span className="font-medium">Status:</span> <span className="text-green-600 font-medium">Approved</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transparency; 