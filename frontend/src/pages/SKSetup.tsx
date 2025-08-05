import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, MapPin, Calendar, UserPlus, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SKOfficial {
  name: string;
  position: string;
  contact: string;
}

const SKSetup: React.FC = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    barangayName: '',
    municipality: '',
    province: '',
    skTermStart: new Date().getFullYear(),
    skTermEnd: new Date().getFullYear() + 2,
    officials: [
      { name: '', position: 'Chairperson', contact: '' },
      { name: '', position: 'Treasurer', contact: '' },
      { name: '', position: 'Secretary', contact: '' },
      { name: '', position: 'Council Member', contact: '' },
      { name: '', position: 'Council Member', contact: '' },
      { name: '', position: 'Council Member', contact: '' },
      { name: '', position: 'Council Member', contact: '' }
    ]
  });

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOfficialChange = (index: number, field: keyof SKOfficial, value: string) => {
    const newOfficials = [...formData.officials];
    newOfficials[index] = {
      ...newOfficials[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      officials: newOfficials
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update user context with SK information
      updateUser({
        barangay: formData.barangayName,
        municipality: formData.municipality,
        province: formData.province,
        skTermStart: formData.skTermStart,
        skTermEnd: formData.skTermEnd,
        isFirstLogin: false
      });

      // Navigate to CBYDP creation
      navigate('/cbydp');
    } catch (error) {
      console.error('Error saving SK setup:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { id: 1, name: 'Basic Information', icon: MapPin },
    { id: 2, name: 'SK Officials', icon: Users }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">SK Information Setup</h1>
        <p className="text-gray-600 mt-2">
          Configure your barangay information and assign SK officials
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center">
        <div className="flex items-center space-x-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  isActive ? 'border-primary-600 bg-primary-600 text-white' :
                  isCompleted ? 'border-green-500 bg-green-500 text-white' :
                  'border-gray-300 bg-white text-gray-400'
                }`}>
                  {isCompleted ? (
                    <span className="text-sm font-bold">✓</span>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  isActive ? 'text-primary-600' : 'text-gray-500'
                }`}>
                  {step.name}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Form */}
      <div className="card p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Basic Barangay Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="form-label">Barangay Name</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.barangayName}
                      onChange={(e) => handleInputChange('barangayName', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Municipality/City</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.municipality}
                      onChange={(e) => handleInputChange('municipality', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Province</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.province}
                      onChange={(e) => handleInputChange('province', e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">SK Term Start Year</label>
                      <input
                        type="number"
                        className="input-field"
                        value={formData.skTermStart}
                        onChange={(e) => handleInputChange('skTermStart', parseInt(e.target.value))}
                        min={2020}
                        max={2030}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">SK Term End Year</label>
                      <input
                        type="number"
                        className="input-field"
                        value={formData.skTermEnd}
                        onChange={(e) => handleInputChange('skTermEnd', parseInt(e.target.value))}
                        min={2020}
                        max={2030}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="btn-primary"
                  disabled={!formData.barangayName || !formData.municipality || !formData.province}
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {/* Step 2: SK Officials */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  SK Officials Assignment
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Assign roles and contact information for each SK official
                </p>
                
                <div className="space-y-4">
                  {formData.officials.map((official, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg">
                      <div>
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="input-field"
                          value={official.name}
                          onChange={(e) => handleOfficialChange(index, 'name', e.target.value)}
                          placeholder={`Enter ${official.position} name`}
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">Position</label>
                        <input
                          type="text"
                          className="input-field"
                          value={official.position}
                          onChange={(e) => handleOfficialChange(index, 'position', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">Contact Number</label>
                        <input
                          type="tel"
                          className="input-field"
                          value={official.contact}
                          onChange={(e) => handleOfficialChange(index, 'contact', e.target.value)}
                          placeholder="09XX XXX XXXX"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="btn-secondary"
                >
                  Previous Step
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary flex items-center"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save and Continue
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default SKSetup; 