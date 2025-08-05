import React from 'react';
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
  Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // Mock data - replace with actual API calls
  const stats = [
    {
      name: 'Total Projects',
      value: '12',
      change: '+2',
      changeType: 'positive',
      icon: Target,
      color: 'bg-blue-500',
      href: '/projects'
    },
    {
      name: 'Active Projects',
      value: '8',
      change: '+1',
      changeType: 'positive',
      icon: TrendingUp,
      color: 'bg-green-500',
      href: '/projects'
    },
    {
      name: 'Budget Used',
      value: '₱75,000',
      change: '₱15,000',
      changeType: 'neutral',
      icon: DollarSign,
      color: 'bg-yellow-500',
      href: '/budget'
    },
    {
      name: 'Pending Approvals',
      value: '3',
      change: '-1',
      changeType: 'negative',
      icon: AlertCircle,
      color: 'bg-red-500',
      href: '/budget'
    }
  ];

  const recentActivities = [
    {
      id: 1,
      type: 'project',
      title: 'Youth Sports Tournament',
      description: 'Project status updated to "In Progress"',
      time: '2 hours ago',
      status: 'ongoing'
    },
    {
      id: 2,
      type: 'budget',
      title: 'Purchase Request Approved',
      description: 'Sports equipment purchase approved by Chairperson',
      time: '1 day ago',
      status: 'completed'
    },
    {
      id: 3,
      type: 'project',
      title: 'Environmental Clean-up Drive',
      description: 'New project created in CBYDP',
      time: '2 days ago',
      status: 'pending'
    },
    {
      id: 4,
      type: 'transparency',
      title: 'Monthly Report Published',
      description: 'Transparency report uploaded to public portal',
      time: '3 days ago',
      status: 'completed'
    }
  ];

  const quickActions = [
    {
      name: 'Add New Project',
      description: 'Create a new project in CBYDP',
      icon: Target,
      href: '/cbydp',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      name: 'Create ABYIP',
      description: 'Generate Annual Barangay Youth Investment Program',
      icon: Calendar,
      href: '/abyip',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      name: 'Budget Allocation',
      description: 'Manage budget and purchase requests',
      icon: DollarSign,
      href: '/budget',
      color: 'bg-yellow-500 hover:bg-yellow-600'
    },
    {
      name: 'View Reports',
      description: 'Access transparency and project reports',
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
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className={`text-sm font-medium ${
                  stat.changeType === 'positive' ? 'text-green-600' :
                  stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {stat.change}
                </span>
                <span className="text-sm text-gray-500 ml-1">from last month</span>
              </div>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activities</h3>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(activity.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-500">{activity.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link
              to="/projects"
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