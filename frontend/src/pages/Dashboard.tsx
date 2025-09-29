import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  Calendar, 
  DollarSign, 
  Target, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Settings,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getRecentActivities, formatTimeAgo, Activity } from '../services/activityService';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch recent activities
  const fetchActivities = async () => {
    try {
      setLoading(true);
      const recentActivities = await getRecentActivities(6);
      setActivities(recentActivities);
      console.log('Fetched activities:', recentActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      // Fallback to empty array if there's an error
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Refresh activities when the page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, refreshing activities...');
        fetchActivities();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Vital KPIs (placeholder values; hook up to real queries later)
  const stats = [
    {
      name: 'Active Projects',
      value: '—',
      sub: 'Ongoing this year',
      icon: TrendingUp,
      color: 'bg-green-500',
      href: '/projects'
    },
    {
      name: 'Budget Committed',
      value: '—',
      sub: 'Sum of ABYIP totals',
      icon: DollarSign,
      color: 'bg-yellow-500',
      href: '/budget'
    },
    {
      name: 'Budget Used',
      value: '—',
      sub: 'From finished projects',
      icon: DollarSign,
      color: 'bg-indigo-500',
      href: '/projects'
    },
    {
      name: 'Pending Approvals',
      value: '—',
      sub: 'Awaiting KK/LCE',
      icon: AlertCircle,
      color: 'bg-red-500',
      href: '/budget'
    }
  ];


  const quickActions = [
    {
      name: 'SK Setup',
      description: 'Configure SK profile and member information',
      icon: Settings,
      href: '/sk-setup',
      color: 'bg-indigo-500 hover:bg-indigo-600'
    },
    {
      name: 'CBYDP',
      description: 'Comprehensive Barangay Youth Development Plan',
      icon: Target,
      href: '/cbydp',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      name: 'ABYIP',
      description: 'Annual Barangay Youth Investment Program',
      icon: Calendar,
      href: '/abyip',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      name: 'Budget',
      description: 'Manage SK annual budget and allocations',
      icon: DollarSign,
      href: '/budget',
      color: 'bg-yellow-500 hover:bg-yellow-600'
    },
    {
      name: 'Transparency',
      description: 'View public transparency reports and documents',
      icon: Eye,
      href: '/transparency',
      color: 'bg-purple-500 hover:bg-purple-600'
    }
  ];


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ongoing':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'budget':
        return <DollarSign className="h-4 w-4 text-yellow-500" />;
      case 'abyip':
        return <Calendar className="h-4 w-4 text-green-500" />;
      case 'cbydp':
        return <Target className="h-4 w-4 text-blue-500" />;
      case 'setup':
        return <Settings className="h-4 w-4 text-indigo-500" />;
      case 'transparency':
        return <Eye className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-xl shadow-soft p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-gray-600 mt-1">
              Here's what's happening with your SK Management System today.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Current Role</p>
            <p className="text-lg font-semibold text-primary-600 capitalize">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.name}
              to={stat.href}
              className="card p-6 hover:shadow-medium transition-shadow"
            >
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  {stat.sub && <p className="text-xs text-gray-500 mt-0.5">{stat.sub}</p>}
                </div>
              </div>
              {/* Optional trend slot reserved for future */}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.name}
                  to={action.href}
                  className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${action.color} text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">{action.name}</p>
                    <p className="text-xs text-gray-500">{action.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
            <button
              onClick={fetchActivities}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start space-x-3 animate-pulse">
                  <div className="w-4 h-4 bg-gray-200 rounded mt-1"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(activity.status)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">{formatTimeAgo(activity.timestamp)}</p>
                      <p className="text-xs text-gray-500 font-medium">
                        {activity.member.name} ({activity.member.role})
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <FileText className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-500 text-sm">No recent activities found</p>
              <p className="text-gray-400 text-xs mt-1">Activities will appear here as you use the system</p>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link
              to="/transparency"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all activities →
            </Link>
          </div>
        </div>
      </div>

      {/* SK Information */}
      {user?.barangay && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">SK Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Barangay</p>
              <p className="text-lg font-semibold text-gray-900">{user.barangay}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Location</p>
              <p className="text-lg font-semibold text-gray-900">
                {user.municipality}, {user.province}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">SK Term</p>
              <p className="text-lg font-semibold text-gray-900">
                {user.skTermStart} - {user.skTermEnd}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 