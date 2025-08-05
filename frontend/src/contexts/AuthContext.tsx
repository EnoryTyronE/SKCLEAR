import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  name: string;
  role: 'chairperson' | 'treasurer' | 'council_member' | 'admin';
  barangay?: string;
  municipality?: string;
  province?: string;
  skTermStart?: number;
  skTermEnd?: number;
  isFirstLogin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session on app load
  useEffect(() => {
    const savedUser = localStorage.getItem('sk_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('sk_user');
      }
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // TODO: Replace with actual API call
      // For now, using mock data
      const mockUsers = [
        {
          id: 1,
          username: 'chairperson',
          password: 'password123',
          name: 'Juan Dela Cruz',
          role: 'chairperson' as const,
          barangay: 'Barangay 123',
          municipality: 'Manila',
          province: 'Metro Manila',
          skTermStart: 2024,
          skTermEnd: 2026,
          isFirstLogin: false
        },
        {
          id: 2,
          username: 'treasurer',
          password: 'password123',
          name: 'Maria Santos',
          role: 'treasurer' as const,
          barangay: 'Barangay 123',
          municipality: 'Manila',
          province: 'Metro Manila',
          skTermStart: 2024,
          skTermEnd: 2026,
          isFirstLogin: false
        },
        {
          id: 3,
          username: 'council',
          password: 'password123',
          name: 'Pedro Reyes',
          role: 'council_member' as const,
          barangay: 'Barangay 123',
          municipality: 'Manila',
          province: 'Metro Manila',
          skTermStart: 2024,
          skTermEnd: 2026,
          isFirstLogin: false
        }
      ];

      const foundUser = mockUsers.find(u => u.username === username && u.password === password);
      
      if (foundUser) {
        const { password: _, ...userData } = foundUser;
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('sk_user', JSON.stringify(userData));
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('sk_user');
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('sk_user', JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    login,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 