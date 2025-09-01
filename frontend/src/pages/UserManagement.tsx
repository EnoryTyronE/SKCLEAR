import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Users, Edit, Trash2, Eye, EyeOff, CheckCircle, AlertCircle, Save, X } from 'lucide-react';

interface SKMember {
  id: string;
  name: string;
  email: string;
  role: string;
  barangay: string;
  municipality: string;
  province: string;
  skTermStart: number;
  skTermEnd: number;
  isActive: boolean;
  createdAt: Date;
}

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<SKMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingMember, setEditingMember] = useState<SKMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'council_member',
    barangay: '',
    municipality: '',
    province: '',
    skTermStart: 2024,
    skTermEnd: 2026
  });

  const roles = [
    { value: 'chairperson', label: 'SK Chairperson' },
    { value: 'secretary', label: 'SK Secretary' },
    { value: 'treasurer', label: 'SK Treasurer' },
    { value: 'council_member', label: 'SK Member' }
  ];

  const isChairperson = user?.role === 'chairperson';

  useEffect(() => {
    if (isChairperson) {
      fetchMembers();
    }
  }, [isChairperson]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const querySnapshot = await getDocs(collection(db, 'users'));
      const membersData: SKMember[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        membersData.push({
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'council_member',
          barangay: data.barangay || '',
          municipality: data.municipality || '',
          province: data.province || '',
          skTermStart: data.skTermStart || 2024,
          skTermEnd: data.skTermEnd || 2026,
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });
      setMembers(membersData);
    } catch (error) {
      console.error('Error fetching members:', error);
      setMessage('Error fetching members');
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Save user data to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        barangay: formData.barangay,
        municipality: formData.municipality,
        province: formData.province,
        skTermStart: formData.skTermStart,
        skTermEnd: formData.skTermEnd,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'council_member',
        barangay: '',
        municipality: '',
        province: '',
        skTermStart: 2024,
        skTermEnd: 2026
      });

      setMessage('User created successfully!');
      setIsSuccess(true);
      
      // Refresh members list
      await fetchMembers();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage('');
        setIsSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('Error creating user:', error);
      setMessage(error.message || 'Error creating user');
      setIsSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (window.confirm('Are you sure you want to delete this member?')) {
      try {
        await deleteDoc(doc(db, 'users', memberId));
        setMessage('Member deleted successfully!');
        setIsSuccess(true);
        await fetchMembers();
        
        setTimeout(() => {
          setMessage('');
          setIsSuccess(false);
        }, 3000);
      } catch (error) {
        console.error('Error deleting member:', error);
        setMessage('Error deleting member');
        setIsSuccess(false);
      }
    }
  };

  const handleToggleActive = async (memberId: string, isActive: boolean) => {
    try {
      await updateDoc(doc(db, 'users', memberId), {
        isActive: !isActive,
        updatedAt: new Date()
      });
      setMessage(`Member ${isActive ? 'deactivated' : 'activated'} successfully!`);
      setIsSuccess(true);
      await fetchMembers();
      
      setTimeout(() => {
        setMessage('');
        setIsSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error updating member status:', error);
      setMessage('Error updating member status');
      setIsSuccess(false);
    }
  };

  const handleEditMember = (member: SKMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      password: '',
      role: member.role,
      barangay: member.barangay,
      municipality: member.municipality,
      province: member.province,
      skTermStart: member.skTermStart,
      skTermEnd: member.skTermEnd
    });
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setIsSubmitting(true);
    setMessage('');

    try {
      const updateData: any = {
        name: formData.name,
        role: formData.role,
        barangay: formData.barangay,
        municipality: formData.municipality,
        province: formData.province,
        skTermStart: formData.skTermStart,
        skTermEnd: formData.skTermEnd,
        updatedAt: new Date()
      };

      // Only update password if provided
      if (formData.password) {
        updateData.password = formData.password;
      }

      await updateDoc(doc(db, 'users', editingMember.id), updateData);

      setMessage('Member updated successfully!');
      setIsSuccess(true);
      setEditingMember(null);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'council_member',
        barangay: '',
        municipality: '',
        province: '',
        skTermStart: 2024,
        skTermEnd: 2026
      });

      await fetchMembers();

      setTimeout(() => {
        setMessage('');
        setIsSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('Error updating member:', error);
      setMessage(error.message || 'Error updating member');
      setIsSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setEditingMember(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'council_member',
      barangay: '',
      municipality: '',
      province: '',
      skTermStart: 2024,
      skTermEnd: 2026
    });
  };

  // Check role limits
  const getRoleCount = (role: string) => {
    return members.filter(m => m.role === role && m.isActive).length;
  };

  const canAddRole = (role: string) => {
    const limits: { [key: string]: number } = {
      chairperson: 1,
      secretary: 1,
      treasurer: 1,
      council_member: 7
    };
    return getRoleCount(role) < (limits[role] || 0);
  };

  if (!isChairperson) {
    return (
      <div className="p-6">
        <div className="card p-8 text-center">
          <AlertCircle className="h-12 w-12 text-danger-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only the SK Chairperson can manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">Manage SK council members and their system access</p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add/Edit Member Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingMember ? 'Edit Member' : 'Add New Member'}
            </h3>
          </div>
          <div className="card-body">
            <form onSubmit={editingMember ? handleUpdateMember : handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="input-field"
                    required
                    disabled={!!editingMember}
                  />
                </div>
                <div>
                  <label className="form-label">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="input-field pr-10"
                      required={!editingMember}
                      placeholder={editingMember ? 'Leave blank to keep current' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="form-label">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="input-field"
                    required
                  >
                    {roles.map(role => (
                      <option 
                        key={role.value} 
                        value={role.value}
                        disabled={!canAddRole(role.value) && !editingMember}
                      >
                        {role.label} {!canAddRole(role.value) && !editingMember ? '(Limit reached)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Barangay</label>
                  <input
                    type="text"
                    value={formData.barangay}
                    onChange={(e) => setFormData({...formData, barangay: e.target.value})}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Municipality/City</label>
                  <input
                    type="text"
                    value={formData.municipality}
                    onChange={(e) => setFormData({...formData, municipality: e.target.value})}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Province</label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) => setFormData({...formData, province: e.target.value})}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">SK Term Start</label>
                  <input
                    type="number"
                    value={formData.skTermStart}
                    onChange={(e) => setFormData({...formData, skTermStart: parseInt(e.target.value)})}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">SK Term End</label>
                  <input
                    type="number"
                    value={formData.skTermEnd}
                    onChange={(e) => setFormData({...formData, skTermEnd: parseInt(e.target.value)})}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                {editingMember && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="btn-secondary flex items-center"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingMember ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingMember ? <Save className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                      {editingMember ? 'Update Member' : 'Add Member'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Members List */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">SK Council Members</h3>
          </div>
          <div className="card-body">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading members...</p>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No members found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{member.name}</h4>
                        <p className="text-sm text-gray-600">{member.email}</p>
                        <p className="text-sm text-gray-600">
                          {roles.find(r => r.value === member.role)?.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {member.barangay}, {member.municipality}, {member.province}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          member.isActive 
                            ? 'bg-success-100 text-success-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => handleEditMember(member)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(member.id, member.isActive)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          {member.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-1 text-danger-400 hover:text-danger-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role Limits Info */}
      <div className="mt-6 card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">SK Council Structure</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-primary-50 rounded-lg">
              <div className="text-lg font-semibold text-primary-700">{getRoleCount('chairperson')}/1</div>
              <div className="text-sm text-gray-600">Chairperson</div>
            </div>
            <div className="text-center p-3 bg-secondary-50 rounded-lg">
              <div className="text-lg font-semibold text-secondary-700">{getRoleCount('secretary')}/1</div>
              <div className="text-sm text-gray-600">Secretary</div>
            </div>
            <div className="text-center p-3 bg-success-50 rounded-lg">
              <div className="text-lg font-semibold text-success-700">{getRoleCount('treasurer')}/1</div>
              <div className="text-sm text-gray-600">Treasurer</div>
            </div>
            <div className="text-center p-3 bg-warning-50 rounded-lg">
              <div className="text-lg font-semibold text-warning-700">{getRoleCount('council_member')}/7</div>
              <div className="text-sm text-gray-600">Members</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
