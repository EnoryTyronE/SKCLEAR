import React, { useState } from 'react';
import { setupChairperson } from '../utils/setupChairperson';
import { Shield, UserPlus, CheckCircle, AlertCircle } from 'lucide-react';

const Setup: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSetupChairperson = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      await setupChairperson();
      setMessage('SK Chairperson account created successfully! You can now login with chairperson@skclear.com and password: chairperson123');
      setIsSuccess(true);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
      setIsSuccess(false);
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
            SK Management System Setup
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Create the initial SK Chairperson account
          </p>
        </div>

        {/* Setup Form */}
        <div className="card p-8">
          <div className="space-y-6">
            {message && (
              <div className={`p-4 rounded-lg flex items-center space-x-3 ${
                isSuccess 
                  ? 'bg-success-50 border border-success-200 text-success-700' 
                  : 'bg-danger-50 border border-danger-200 text-danger-700'
              }`}>
                {isSuccess ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <span className="text-sm">{message}</span>
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-700 mb-2">Account Details:</h4>
              <div className="space-y-1 text-xs text-blue-600">
                <div><strong>Email:</strong> chairperson@skclear.com</div>
                <div><strong>Password:</strong> chairperson123</div>
                <div><strong>Role:</strong> SK Chairperson</div>
              </div>
            </div>

            <button
              onClick={handleSetupChairperson}
              disabled={isLoading}
              className="btn-primary w-full flex justify-center items-center"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Account...
                </div>
              ) : (
                <div className="flex items-center">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create SK Chairperson Account
                </div>
              )}
            </button>

            <div className="text-center">
              <a href="/login" className="text-primary-700 hover:underline font-medium text-sm">
                Go to Login
              </a>
            </div>
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

export default Setup;
