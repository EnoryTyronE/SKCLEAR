import React from 'react';
import { Target, Plus } from 'lucide-react';

const Projects: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Monitoring</h1>
          <p className="text-gray-600 mt-2">
            Track and manage project progress and status
          </p>
        </div>
        <button className="btn-primary flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Project Update
        </button>
      </div>

      <div className="card p-6">
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Project Monitoring Module Coming Soon
          </h3>
          <p className="text-gray-600">
            This module will allow you to monitor project progress, update status, and generate reports.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Projects; 