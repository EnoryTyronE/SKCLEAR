import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Users, 
  FileText, 
  Calendar, 
  DollarSign, 
  Target, 
  Eye, 
  Menu, 
  X, 
  LogOut,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, logout, skProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'SK Setup', href: '/sk-setup', icon: Users, role: 'chairperson' },
    { name: 'CBYDP', href: '/cbydp', icon: FileText },
    { name: 'ABYIP', href: '/abyip', icon: Calendar, role: 'chairperson' },
    { name: 'Budget', href: '/budget', icon: DollarSign, role: 'treasurer' },
    { name: 'Projects', href: '/projects', icon: Target },
    { name: 'Transparency', href: '/transparency', icon: Eye },
  ];

  // Update browser tab title
  useEffect(() => {
    const barangayName = skProfile?.barangay || 'Setup';
    document.title = `SK Barangay ${barangayName}`;
  }, [skProfile?.barangay]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNavigation = navigation.filter(item => 
    !item.role || item.role === user?.role || user?.role === 'chairperson'
  );

  // Utility function to safely get image source
  const getSafeImageSource = async (logo: string | null): Promise<string | null> => {
    if (!logo) return null;
    
    if (logo.startsWith('local://')) {
      try {
        const { getFileFromLocalStorage } = await import('../services/firebaseService');
        return getFileFromLocalStorage(logo) || null;
      } catch (error) {
        console.error('Error importing firebaseService:', error);
        return null;
      }
    }
    
    if (logo.includes('drive.google.com')) {
      let fileId = '';
      if (logo.includes('/file/d/')) {
        const match = logo.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
        fileId = match ? match[1] : '';
      } else if (logo.includes('id=')) {
        const match = logo.match(/id=([^&]+)/);
        fileId = match ? match[1] : '';
      }
      
      if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w100`;
      }
    }
    
    return logo;
  };

  // Safe Image Component for header logo
  const SafeImage: React.FC<{ src: string | null; alt: string; className: string }> = ({ src, alt, className }) => {
    const [currentSrc, setCurrentSrc] = useState<string | null>(src);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      const loadImage = async () => {
        if (!src) {
          setCurrentSrc(null);
          setHasError(false);
          return;
        }

        try {
          if (src.includes('drive.google.com')) {
            const authenticatedSrc = await getSafeImageSource(src);
            setCurrentSrc(authenticatedSrc);
          } else {
            setCurrentSrc(src);
          }
          setHasError(false);
        } catch (error) {
          console.error('Error loading image source:', error);
          setCurrentSrc(src);
          setHasError(false);
        }
      };

      loadImage();
    }, [src]);

    if (hasError || !currentSrc) {
      return (
        <div className={`${className} bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center`}>
          <Users className="h-6 w-6 text-gray-400" />
        </div>
      );
    }

    return (
      <img 
        src={currentSrc} 
        alt={alt} 
        className={className}
        onError={() => setHasError(true)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            <h1 className="text-xl font-bold text-primary-600">SK Management</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

            {/* Main content */}
      <div className="lg:pl-0">
        {/* Top header */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8">
            {/* Left side - Menu button and sidebar toggle */}
            <div className="flex items-center gap-x-4">
              <button
                type="button"
                className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={24} />
              </button>

              {/* Desktop sidebar toggle */}
              <button
                type="button"
                className="hidden lg:block sidebar-toggle text-gray-700 hover:text-gray-900"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
              </button>

              {/* SK Header with Logo */}
              <div className="flex items-center gap-x-3">
                {skProfile?.logo && (
                  <SafeImage 
                    src={skProfile.logo} 
                    alt="Barangay Logo" 
                    className="h-8 w-8 object-cover rounded-lg border border-gray-200"
                  />
                )}
                <div>
                  <h1 className="text-lg font-bold text-primary-600">
                    Sangguniang Kabataan Barangay {skProfile?.barangay || 'Setup'}
                  </h1>
                  <p className="text-xs text-gray-500">
                    SKClear Portal
                  </p>
                </div>
              </div>
            </div>

            {/* Right side - User menu */}
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <div className="relative">
                <div className="flex items-center gap-x-3">
                  <div className="flex items-center gap-x-2">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                      {user?.name}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      ({user?.role?.replace('_', ' ')})
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-x-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content area with sidebar and main content */}
        <div className="flex">
          {/* Desktop sidebar - now below header */}
          <div className={`hidden lg:flex lg:flex-col transition-all duration-300 ${
            sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
          }`}>
            <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
              <nav className={`flex-1 space-y-1 py-4 ${sidebarCollapsed ? 'px-1' : 'px-2'}`}>
                {filteredNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`group flex items-center text-sm font-medium rounded-md transition-colors ${
                        sidebarCollapsed 
                          ? 'justify-center px-2 py-3' 
                          : 'px-2 py-2'
                      } ${
                        isActive
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      title={sidebarCollapsed ? item.name : ''}
                    >
                      <Icon className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                      {!sidebarCollapsed && item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout; 