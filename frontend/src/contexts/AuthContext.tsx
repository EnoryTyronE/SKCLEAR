import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface User {
  uid: string;
  email: string;
  name: string;
  role: 'chairperson' | 'treasurer' | 'council_member' | 'admin';
  barangay?: string;
  municipality?: string;
  province?: string;
  skTermStart?: number;
  skTermEnd?: number;
  isFirstLogin?: boolean;
}

interface SKProfile {
  logo: string | null;
  region: string;
  province: string;
  city: string;
  barangay: string;
  skTermStart: number;
  skTermEnd: number;
  federationPresident: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  skProfile: SKProfile | null;
  setSKProfile: (profile: SKProfile) => void;
  setIsCreatingUser: (creating: boolean) => void;
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
  const [skProfile, setSKProfileState] = useState<SKProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser);
      
      // If we're creating a user, ignore the auth state change
      if (isCreatingUser) {
        console.log('Ignoring auth state change while creating user');
        return;
      }
      
      if (firebaseUser) {
        try {
          console.log('Fetching user data for UID:', firebaseUser.uid);
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          console.log('User document exists:', userDoc.exists());
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('User data from Firestore:', userData);
            
            const userInfo: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: userData.name || firebaseUser.displayName || 'Unknown User',
              role: userData.role || 'council_member',
              barangay: userData.barangay,
              municipality: userData.municipality,
              province: userData.province,
              skTermStart: userData.skTermStart,
              skTermEnd: userData.skTermEnd,
              isFirstLogin: userData.isFirstLogin || false
            };
            
            console.log('Setting user info:', userInfo);
            setUser(userInfo);
            setIsAuthenticated(true);
            localStorage.setItem('sk_user', JSON.stringify(userInfo));
          } else {
            console.log('User document does not exist, creating basic user info');
            // If user document doesn't exist, create basic info
            const userInfo: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'Unknown User',
              role: 'council_member'
            };
            setUser(userInfo);
            setIsAuthenticated(true);
            localStorage.setItem('sk_user', JSON.stringify(userInfo));
            
            // Try to create a basic user document in Firestore
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                name: userInfo.name,
                email: userInfo.email,
                role: userInfo.role,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
              });
              console.log('Basic user document created in Firestore');
            } catch (createError) {
              console.error('Failed to create user document:', createError);
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Still set basic user info even if Firestore fails
          const userInfo: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'Unknown User',
            role: 'council_member'
          };
          setUser(userInfo);
          setIsAuthenticated(true);
          localStorage.setItem('sk_user', JSON.stringify(userInfo));
          
          // Log additional debugging info
          console.log('Firestore access failed, using basic user info:', userInfo);
          console.log('This might be due to Firestore rules or network issues');
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('sk_user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isCreatingUser]);

  // Load SK profile from localStorage
  useEffect(() => {
    const savedProfile = localStorage.getItem('sk_profile');
    if (savedProfile) {
      try {
        setSKProfileState(JSON.parse(savedProfile));
      } catch (error) {
        console.error('Error parsing saved SK profile data:', error);
        localStorage.removeItem('sk_profile');
      }
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // This will trigger the onAuthStateChanged listener above
      // The actual login is handled in the Login component
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setIsAuthenticated(false);
      // Do not clear skProfile on logout
      localStorage.removeItem('sk_user');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('sk_user', JSON.stringify(updatedUser));
    }
  };

  const setSKProfile = (profile: SKProfile) => {
    setSKProfileState(profile);
    localStorage.setItem('sk_profile', JSON.stringify(profile));
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    login,
    logout,
    updateUser,
    skProfile,
    setSKProfile,
    setIsCreatingUser,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 