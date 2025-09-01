import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, Users } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import googleDriveService from '../services/googleDriveService';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Test Firebase connection
  useEffect(() => {
    console.log('=== FIREBASE CONNECTION TEST ===');
    console.log('Firebase auth object:', auth);
    console.log('Firebase db object:', db);
    console.log('Auth current user:', auth.currentUser);
    console.log('Auth app:', auth.app);
    console.log('=== END TEST ===');
  }, []);

  // Check Google Drive connection
  useEffect(() => {
    const checkDriveConnection = async () => {
      try {
        console.log('Checking Google Drive connection...');
        
        // Wait for auto-connection to complete
        const isConnected = await googleDriveService.waitForConnection();
        setIsDriveConnected(isConnected);
        
        if (isConnected) {
          console.log('Google Drive is connected and ready');
        } else {
          console.log('Google Drive connection failed');
        }
      } catch (error) {
        console.error('Error checking Google Drive connection:', error);
        setIsDriveConnected(false);
      }
    };

    checkDriveConnection();
  }, []);

  // Handle manual Google Drive sign-in (if needed)
  const handleGoogleDriveSignIn = async () => {
    try {
      console.log('Manual Google Drive sign-in requested...');
      const success = await googleDriveService.manualSignIn();
      setIsDriveConnected(success);
      
      if (success) {
        console.log('Manual Google Drive sign-in successful');
      } else {
        console.log('Manual Google Drive sign-in failed');
      }
    } catch (error) {
      console.error('Error during manual Google Drive sign-in:', error);
      setIsDriveConnected(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      console.log('Attempting to sign in with:', email);
      
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Sign in successful:', user);

      // Create test user data in Firestore if it doesn't exist
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          // Create a test user document
          const testUserData = {
            name: 'SK Chairperson',
            role: 'chairperson',
            barangay: 'Barangay 123',
            municipality: 'Manila',
            province: 'Metro Manila',
            skTermStart: 2024,
            skTermEnd: 2026,
            isFirstLogin: false,
            createdAt: new Date()
          };
          
          // Note: We'll need to implement this later with proper Firestore write permissions
          console.log('Would create user data:', testUserData);
        }
      } catch (firestoreError) {
        console.log('Firestore not available yet, continuing without user data');
      }

      // The AuthContext will automatically handle the authentication state change
      // and redirect to dashboard
      
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(`Login failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Welcome to SK Management System
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please sign in to access your account
          </p>
        </div>

        {/* Login Form */}
        <div className="card p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="input-field pl-10"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pl-10 pr-10"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full flex justify-center items-center"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>

          {/* Google Drive Connection */}
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <h4 className="text-sm font-medium text-green-700 mb-2">File Storage:</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-green-600">
                  {isDriveConnected ? '✅ Google Drive Connected' : '⏳ Connecting to Google Drive...'}
                </span>
                {!isDriveConnected && (
                  <button
                    type="button"
                    onClick={handleGoogleDriveSignIn}
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    Connect Google Drive
                  </button>
                )}
              </div>
              {isDriveConnected && (
                <div className="text-xs text-green-600 mt-1">
                  Connection will persist across sessions
                </div>
              )}
              <div className="text-xs text-green-600">
                {isDriveConnected 
                  ? 'Files will be automatically saved to Google Drive' 
                  : 'Click "Connect Google Drive" to enable file uploads (popup may be blocked)'
                }
              </div>
            </div>
          </div>

          {/* Info for Chairperson */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-700 mb-2">Note:</h4>
            <div className="space-y-1 text-xs text-blue-600">
              <div>
                <strong>Only the SK Chairperson can create accounts for other members.</strong>
              </div>
              <div>
                Please contact your SK Chairperson if you need an account.
              </div>
            </div>
          </div>

          {/* Public Transparency Link */}
          <div className="mt-6 text-center">
            <a href="/transparency-public" className="text-primary-700 hover:underline font-medium">
              View Public Transparency Portal
            </a>
          </div>

          {/* Setup Link */}
          <div className="mt-4 text-center">
            <a href="/setup" className="text-secondary-700 hover:underline font-medium text-sm">
              First time? Setup SK Chairperson Account
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2024 SK Management System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 