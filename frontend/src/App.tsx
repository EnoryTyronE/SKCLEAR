import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SKSetup from './pages/SKSetup';
import CBYDP from './pages/CBYDP';
import ABYIP from './pages/ABYIP';
import Budget from './pages/Budget';
import Projects from './pages/Projects';
import Transparency from './pages/Transparency';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PublicTransparency from './pages/PublicTransparency';
import Setup from './pages/Setup';
import YouthTransparency from './pages/YouthTransparency';
import FileUploadTest from './components/FileUploadTest';
import googleDriveService from './services/googleDriveService';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route Component (redirects to dashboard if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

function App() {
  // Google Drive auto-connects when the service is created
  // No manual initialization needed

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="/setup" element={<Setup />} />
            <Route path="/transparency-public" element={<PublicTransparency />} />
            <Route path="/youth-transparency" element={<YouthTransparency />} />
            
            {/* Protected Routes */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/sk-setup" element={
              <ProtectedRoute>
                <Layout>
                  <SKSetup />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/cbydp" element={
              <ProtectedRoute>
                <Layout>
                  <CBYDP />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/abyip" element={
              <ProtectedRoute>
                <Layout>
                  <ABYIP />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/budget" element={
              <ProtectedRoute>
                <Layout>
                  <Budget />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/projects" element={
              <ProtectedRoute>
                <Layout>
                  <Projects />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/transparency" element={
              <ProtectedRoute>
                <Layout>
                  <Transparency />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* File Upload Test Route */}
            <Route path="/file-upload-test" element={
              <ProtectedRoute>
                <Layout>
                  <FileUploadTest />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
