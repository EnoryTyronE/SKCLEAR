import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Shield, 
  FileText, 
  Calendar, 
  DollarSign, 
  Target, 
  Users, 
  TrendingUp,
  CheckCircle,
  Clock,
  Eye,
  Download,
  ExternalLink
} from 'lucide-react';


interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  budget: number;
  startDate: string;
  endDate: string;
  category: string;
}

interface BudgetItem {
  id: string;
  title: string;
  amount: number;
  status: string;
  date: string;
  type: 'income' | 'expense';
}

interface SKMember {
  name: string;
  role: string;
  isActive: boolean;
}

const YouthTransparency: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [skMembers, setSKMembers] = useState<SKMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');


  // Mock data for demonstration - replace with actual Firebase data
  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setProjects([
        {
          id: '1',
          title: 'Youth Sports Tournament',
          description: 'Annual basketball and volleyball tournament for barangay youth',
          status: 'ongoing',
          budget: 25000,
          startDate: '2024-01-15',
          endDate: '2024-03-15',
          category: 'Sports'
        },
        {
          id: '2',
          title: 'Environmental Clean-up Drive',
          description: 'Community clean-up initiative to maintain barangay cleanliness',
          status: 'completed',
          budget: 15000,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          category: 'Environment'
        },
        {
          id: '3',
          title: 'Youth Leadership Training',
          description: 'Leadership skills development program for young leaders',
          status: 'planned',
          budget: 30000,
          startDate: '2024-04-01',
          endDate: '2024-06-30',
          category: 'Education'
        }
      ]);

      setBudgetItems([
        {
          id: '1',
          title: 'SK Fund Allocation',
          amount: 100000,
          status: 'received',
          date: '2024-01-01',
          type: 'income'
        },
        {
          id: '2',
          title: 'Sports Equipment Purchase',
          amount: 25000,
          status: 'completed',
          date: '2024-01-15',
          type: 'expense'
        },
        {
          id: '3',
          title: 'Clean-up Materials',
          amount: 15000,
          status: 'completed',
          date: '2024-01-10',
          type: 'expense'
        },
        {
          id: '4',
          title: 'Training Venue Rental',
          amount: 20000,
          status: 'pending',
          date: '2024-03-15',
          type: 'expense'
        }
      ]);

      setSKMembers([
        { name: 'Juan Dela Cruz', role: 'SK Chairperson', isActive: true },
        { name: 'Maria Santos', role: 'SK Vice Chairperson', isActive: true },
        { name: 'Pedro Reyes', role: 'SK Secretary', isActive: true },
        { name: 'Ana Garcia', role: 'SK Treasurer', isActive: true },
        { name: 'Luis Martinez', role: 'SK Auditor', isActive: true },
        { name: 'Carmen Lopez', role: 'SK Public Information Officer', isActive: true },
        { name: 'Roberto Torres', role: 'SK Member', isActive: true }
      ]);

      setIsLoading(false);
    }, 1000);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ongoing':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'planned':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'ongoing':
        return 'bg-blue-100 text-blue-800';
      case 'planned':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalBudget = budgetItems.reduce((sum, item) => 
    item.type === 'income' ? sum + item.amount : sum - item.amount, 0
  );

  const totalIncome = budgetItems
    .filter(item => item.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);

  const totalExpenses = budgetItems
    .filter(item => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading transparency information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-primary-600 p-2 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SK Transparency Portal</h1>
                <p className="text-sm text-gray-600">Barangay Youth Council Information</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="text-sm font-medium text-gray-900">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: Eye },
              { id: 'projects', name: 'Projects', icon: Target },
              { id: 'budget', name: 'Budget', icon: DollarSign },
              { id: 'members', name: 'SK Members', icon: Users },
              { id: 'reports', name: 'Reports', icon: FileText }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-soft p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-500 rounded-lg">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Projects</p>
                    <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-soft p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-500 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Projects</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {projects.filter(p => p.status === 'ongoing').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-soft p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-yellow-500 rounded-lg">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Budget</p>
                    <p className="text-2xl font-bold text-gray-900">₱{totalBudget.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-soft p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-500 rounded-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">SK Members</p>
                    <p className="text-2xl font-bold text-gray-900">{skMembers.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Projects */}
            <div className="bg-white rounded-lg shadow-soft p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Projects</h3>
              <div className="space-y-4">
                {projects.slice(0, 3).map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(project.status)}
                      <div>
                        <h4 className="font-medium text-gray-900">{project.title}</h4>
                        <p className="text-sm text-gray-600">{project.description}</p>
                        <p className="text-xs text-gray-500">Budget: ₱{project.budget.toLocaleString()}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="bg-white rounded-lg shadow-soft p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">All Projects</h3>
            <div className="space-y-4">
              {projects.map((project) => (
                <div key={project.id} className="border rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{project.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">{project.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-500">Category:</span>
                          <span className="ml-2 text-gray-900">{project.category}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Budget:</span>
                          <span className="ml-2 text-gray-900">₱{project.budget.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Duration:</span>
                          <span className="ml-2 text-gray-900">
                            {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-6">
            {/* Budget Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-soft p-6">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Total Income</h4>
                <p className="text-2xl font-bold text-green-600">₱{totalIncome.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow-soft p-6">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Total Expenses</h4>
                <p className="text-2xl font-bold text-red-600">₱{totalExpenses.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow-soft p-6">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Remaining Budget</h4>
                <p className="text-2xl font-bold text-gray-900">₱{totalBudget.toLocaleString()}</p>
              </div>
            </div>

            {/* Budget Details */}
            <div className="bg-white rounded-lg shadow-soft p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Details</h3>
              <div className="space-y-3">
                {budgetItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{item.title}</h4>
                      <p className="text-sm text-gray-600">{new Date(item.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {item.type === 'income' ? '+' : '-'}₱{item.amount.toLocaleString()}
                      </p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="bg-white rounded-lg shadow-soft p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">SK Council Members</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skMembers.map((member, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary-100 p-2 rounded-full">
                      <Users className="h-4 w-4 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{member.name}</h4>
                      <p className="text-sm text-gray-600 capitalize">{member.role.replace('_', ' ')}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      member.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow-soft p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reports & Documents</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <h4 className="font-medium text-gray-900">CBYDP 2024</h4>
                    <p className="text-sm text-gray-600">Comprehensive Barangay Youth Development Plan</p>
                  </div>
                </div>
                <button className="flex items-center space-x-2 text-primary-600 hover:text-primary-700">
                  <Download className="h-4 w-4" />
                  <span className="text-sm font-medium">Download</span>
                </button>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <h4 className="font-medium text-gray-900">ABYIP 2024</h4>
                    <p className="text-sm text-gray-600">Annual Barangay Youth Investment Program</p>
                  </div>
                </div>
                <button className="flex items-center space-x-2 text-primary-600 hover:text-primary-700">
                  <Download className="h-4 w-4" />
                  <span className="text-sm font-medium">Download</span>
                </button>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  <div>
                    <h4 className="font-medium text-gray-900">Financial Report Q1 2024</h4>
                    <p className="text-sm text-gray-600">Quarterly financial transparency report</p>
                  </div>
                </div>
                <button className="flex items-center space-x-2 text-primary-600 hover:text-primary-700">
                  <Download className="h-4 w-4" />
                  <span className="text-sm font-medium">Download</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <p className="text-sm text-gray-500">
              © 2024 SK Transparency Portal. This portal provides public access to SK Council information and activities.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              For questions or concerns, please contact your SK Council directly.
            </p>
          </div>
        </div>
      </div>


    </div>
  );
};

export default YouthTransparency;
