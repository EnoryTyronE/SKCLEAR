import React from 'react';
import { FileText, Plus, Edit, Trash2 } from 'lucide-react';

const CBYDP: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CBYDP Management</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive Barangay Youth Development Plan
          </p>
        </div>
        <button className="btn-primary flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add New Project
        </button>
      </div>

      <div className="card p-6">
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            CBYDP Module Coming Soon
          </h3>
          <p className="text-gray-600">
            This module will allow you to create and manage your Comprehensive Barangay Youth Development Plan.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CBYDP; 