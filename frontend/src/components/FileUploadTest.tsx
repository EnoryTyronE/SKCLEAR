import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import googleDriveService from '../services/googleDriveService';

const FileUploadTest: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');
    setUploadedFile(null);

    try {
      console.log('Uploading file:', file.name);
      
      // The service will automatically connect to Google Drive if needed
      const result = await googleDriveService.uploadFile(file);
      
      setUploadedFile(result);
      setUploadStatus('success');
      console.log('File uploaded successfully:', result);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">File Upload Test</h2>
      
      <div className="space-y-4">
        {/* File Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-600">
              {isUploading ? 'Uploading...' : 'Click to upload a file'}
            </span>
            <span className="text-xs text-gray-500 mt-1">
              File will be automatically saved to Google Drive
            </span>
          </label>
        </div>

        {/* Upload Status */}
        {isUploading && (
          <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-sm text-blue-600">Uploading to Google Drive...</span>
          </div>
        )}

        {/* Success Status */}
        {uploadStatus === 'success' && uploadedFile && (
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center mb-2">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-sm font-medium text-green-800">Upload Successful!</span>
            </div>
            <div className="text-xs text-green-700 space-y-1">
              <div><strong>File:</strong> {uploadedFile.name}</div>
              <div><strong>Size:</strong> {(uploadedFile.size / 1024).toFixed(1)} KB</div>
              <div><strong>Type:</strong> {uploadedFile.mimeType}</div>
              <div className="mt-2">
                <a
                  href={uploadedFile.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  View in Google Drive →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Error Status */}
        {uploadStatus === 'error' && (
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="flex items-center mb-2">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-sm font-medium text-red-800">Upload Failed</span>
            </div>
            <div className="text-xs text-red-700">
              {errorMessage || 'An error occurred during upload'}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
          <div className="font-medium mb-1">How it works:</div>
          <ul className="space-y-1">
            <li>• Google Drive connects automatically when you access this page</li>
            <li>• Select any file to upload</li>
            <li>• File is saved to "SK Management System" folder in Google Drive</li>
            <li>• You can view the file directly in Google Drive</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FileUploadTest;
