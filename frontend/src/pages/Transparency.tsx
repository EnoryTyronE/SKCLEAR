import React from 'react';
import { Eye, Upload, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logTransparencyActivity } from '../services/activityService';

const Transparency: React.FC = () => {
  const { user } = useAuth();

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
    </div>
  );
};

export default Transparency; 