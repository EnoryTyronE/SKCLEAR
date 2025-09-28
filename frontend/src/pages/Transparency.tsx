import React, { useState, useEffect } from 'react';
import { Eye, Upload, Download, History, Filter, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logTransparencyActivity, getAllActivities, Activity, formatTimeAgo } from '../services/activityService';

const Transparency: React.FC = () => {
  const { user } = useAuth();
  
  // Activity History state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    module: '',
    status: ''
  });
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);

  // Fetch activities
  const fetchActivities = async (reset = false) => {
    setLoading(true);
    try {
      // Create filter object with only non-empty values
      const filterObj = Object.values(filters).some(f => f) ? {
        ...(filters.type && { type: filters.type }),
        ...(filters.module && { module: filters.module }),
        ...(filters.status && { status: filters.status })
      } : undefined;

      console.log('Fetching activities with filters:', filterObj);
      
      const result = await getAllActivities(
        filterObj,
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
    if (hasMore && !loading) {
      fetchActivities(false);
    }
  };

  // Apply filters
  const applyFilters = () => {
    setLastDoc(null);
    fetchActivities(true);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({ type: '', module: '', status: '' });
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
  }, [filters.type, filters.module, filters.status]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transparency Portal</h1>
          <p className="text-gray-600 mt-2">
            Manage public reports and transparency documents
          </p>
        </div>
        <button 
          className="btn-primary flex items-center"
          onClick={handleUploadReport}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Report
        </button>
      </div>

      <div className="card p-6">
        <div className="text-center py-12">
          <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Transparency Module Coming Soon
          </h3>
          <p className="text-gray-600">
            This module will allow you to publish reports, manage transparency documents, and generate QR codes for public access.
          </p>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
                    <select
                      value={filters.module}
                      onChange={(e) => setFilters(prev => ({ ...prev, module: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Modules</option>
                      <option value="Budget">Budget</option>
                      <option value="ABYIP">ABYIP</option>
                      <option value="CBYDP">CBYDP</option>
                      <option value="SK Setup">SK Setup</option>
                      <option value="Transparency">Transparency</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={filters.type}
                      onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Types</option>
                      <option value="budget">Budget</option>
                      <option value="abyip">ABYIP</option>
                      <option value="cbydp">CBYDP</option>
                      <option value="setup">Setup</option>
                      <option value="transparency">Transparency</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Status</option>
                      <option value="completed">Completed</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div className="md:col-span-3 flex gap-2">
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
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                            activity.status === 'ongoing' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {activity.status}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">{activity.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <span>By: {activity.member.name} ({activity.member.role})</span>
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
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Loading...' : 'Load More'}
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
    </div>
  );
};

export default Transparency; 