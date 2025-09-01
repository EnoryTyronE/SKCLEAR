import React, { useEffect, useState } from 'react';
import { Eye, FileText, DollarSign, Calendar, Users } from 'lucide-react';
import axios from 'axios';

interface TransparencyData {
  officials: Array<{ name: string; position: string }>;
  cbydp: Array<{ title: string; category: string; year: number }>;
  abyip: Array<{ title: string; year: number; budget: number }>;
  budget: { total: number; used: number; remaining: number };
  reports: Array<{ name: string; url: string }>;
}

const PublicTransparency: React.FC = () => {
  const [data, setData] = useState<TransparencyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call (replace with real API call later)
    setTimeout(() => {
      setData({
        officials: [
          { name: 'Juan Dela Cruz', position: 'Chairperson' },
          { name: 'Maria Santos', position: 'Treasurer' },
          { name: 'Pedro Reyes', position: 'Council Member' },
        ],
        cbydp: [
          { title: 'Youth Sports Tournament', category: 'Sports', year: 2024 },
          { title: 'Clean-up Drive', category: 'Environment', year: 2025 },
        ],
        abyip: [
          { title: 'Basketball League', year: 2024, budget: 25000 },
          { title: 'Tree Planting', year: 2025, budget: 15000 },
        ],
        budget: { total: 100000, used: 75000, remaining: 25000 },
        reports: [
          { name: '2024 Transparency Report', url: '#' },
          { name: '2024 Budget Report', url: '#' },
        ],
      });
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <Eye className="mx-auto h-12 w-12 text-primary-600 mb-2" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SK Transparency Portal</h1>
          <p className="text-gray-600">Public access to SK officials, projects, budgets, and reports</p>
          
          {/* Youth Portal Link */}
          <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg border border-primary-200">
            <h3 className="text-lg font-semibold text-primary-700 mb-2">For Youth Members</h3>
            <p className="text-gray-600 mb-3">Access detailed project information, budget breakdowns, and SK member profiles</p>
            <a 
              href="/youth-transparency" 
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Eye className="h-4 w-4 mr-2" />
              View Youth Transparency Portal
            </a>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading transparency data...</div>
        ) : data ? (
          <div className="space-y-8">
            {/* Officials */}
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-primary-700 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" /> SK Officials
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.officials.map((o, i) => (
                  <li key={i} className="border-b border-gray-100 pb-2">
                    <span className="font-medium text-gray-900">{o.name}</span> <span className="text-gray-500">({o.position})</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CBYDP */}
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-primary-700 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" /> CBYDP Projects
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.cbydp.map((p, i) => (
                  <li key={i} className="border-b border-gray-100 pb-2">
                    <span className="font-medium text-gray-900">{p.title}</span> <span className="text-gray-500">({p.category}, {p.year})</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ABYIP */}
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-primary-700 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" /> ABYIP Projects
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.abyip.map((a, i) => (
                  <li key={i} className="border-b border-gray-100 pb-2">
                    <span className="font-medium text-gray-900">{a.title}</span> <span className="text-gray-500">({a.year})</span> <span className="text-success-700 font-semibold ml-2">₱{a.budget.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Budget */}
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-primary-700 mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" /> Budget Overview
              </h2>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="text-gray-500">Total Budget</div>
                  <div className="text-2xl font-bold text-gray-900">₱{data.budget.total.toLocaleString()}</div>
                </div>
                <div className="flex-1">
                  <div className="text-gray-500">Used</div>
                  <div className="text-2xl font-bold text-warning-700">₱{data.budget.used.toLocaleString()}</div>
                </div>
                <div className="flex-1">
                  <div className="text-gray-500">Remaining</div>
                  <div className="text-2xl font-bold text-success-700">₱{data.budget.remaining.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Reports */}
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-primary-700 mb-4 flex items-center gap-2">
                <Eye className="h-5 w-5" /> Public Reports
              </h2>
              <ul className="space-y-2">
                {data.reports.map((r, i) => (
                  <li key={i}>
                    <a href={r.url} className="text-primary-700 hover:underline font-medium" target="_blank" rel="noopener noreferrer">
                      {r.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-danger-500">Failed to load transparency data.</div>
        )}
      </div>
    </div>
  );
};

export default PublicTransparency;