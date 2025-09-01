import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createSKProfile, getSKProfile, updateSKProfile, uploadFile, getFileFromLocalStorage, convertGoogleDriveUrl, getAuthenticatedDriveUrl } from '../services/firebaseService';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword, signInWithEmailAndPassword as signIn, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Shield, Upload, Save, Edit, CheckCircle, AlertCircle, UserPlus, Users, Trash2, Eye, EyeOff, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SKProfile {
  logo: string | null;
  region: string;
  province: string;
  city: string;
  barangay: string;
  skTermStart: number;
  skTermEnd: number;
  federationPresident: string;
}

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

const SKSetup: React.FC = () => {
  const { user, setSKProfile, setIsCreatingUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [existingProfileId, setExistingProfileId] = useState<string | null>(null);

  // SK Profile State
  const [profile, setProfile] = useState<SKProfile>({
    logo: null,
    region: '',
    province: '',
    city: '',
    barangay: '',
    skTermStart: 2024,
    skTermEnd: 2026,
    federationPresident: ''
  });

  // User Management State
  const [members, setMembers] = useState<SKMember[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [editingMember, setEditingMember] = useState<SKMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'council_member'
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'council_member' as 'chairperson' | 'secretary' | 'treasurer' | 'council_member'
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const roles = [
    { value: 'chairperson', label: 'SK Chairperson' },
    { value: 'secretary', label: 'SK Secretary' },
    { value: 'treasurer', label: 'SK Treasurer' },
    { value: 'council_member', label: 'SK Member' }
  ];

  const isChairperson = user?.role === 'chairperson';

  // Utility function to safely get image source
  const getSafeImageSource = async (logo: string | null): Promise<string | null> => {
    if (!logo) return null;
    
    console.log('Processing logo URL:', logo);
    
    if (logo.startsWith('local://')) {
      const localSrc = getFileFromLocalStorage(logo);
      console.log('Local storage result:', localSrc);
      return localSrc || null;
    }
    
    // Convert Google Drive URLs to direct download format
    if (logo.includes('drive.google.com')) {
      // Extract file ID from URL
      let fileId = '';
      if (logo.includes('/file/d/')) {
        const match = logo.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
        fileId = match ? match[1] : '';
      } else if (logo.includes('id=')) {
        const match = logo.match(/id=([^&]+)/);
        fileId = match ? match[1] : '';
      }
      
      console.log('Extracted file ID:', fileId);
      
      if (fileId) {
        try {
          // First try the thumbnail URL directly (most reliable)
          const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
          console.log('Trying thumbnail URL:', thumbnailUrl);
          
          // Test if thumbnail URL works
          const testImage = new Image();
          const thumbnailWorks = await new Promise<boolean>((resolve) => {
            testImage.onload = () => {
              console.log('✅ Thumbnail URL works');
              resolve(true);
            };
            testImage.onerror = () => {
              console.log('❌ Thumbnail URL failed');
              resolve(false);
            };
            testImage.src = thumbnailUrl;
          });
          
          if (thumbnailWorks) {
            return thumbnailUrl;
          }
          
          // If thumbnail fails, try authenticated URL
          console.log('Thumbnail failed, trying authenticated URL...');
          const authenticatedUrl = await getAuthenticatedDriveUrl(fileId);
          console.log('Got authenticated URL:', authenticatedUrl);
          return authenticatedUrl;
        } catch (error) {
          console.error('Error getting authenticated URL:', error);
          // Fallback to thumbnail URL anyway
          const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
          console.log('Using thumbnail fallback URL:', thumbnailUrl);
          return thumbnailUrl;
        }
      }
      
      const convertedUrl = convertGoogleDriveUrl(logo);
      console.log('Converted Google Drive URL:', convertedUrl);
      return convertedUrl;
    }
    
    console.log('Returning original URL:', logo);
    return logo;
  };

  // Safe Image Component with error handling and fallback URLs
  const SafeImage: React.FC<{ src: string | null; alt: string; className: string }> = ({ src, alt, className }) => {
    const [hasError, setHasError] = useState(false);
    const [currentSrc, setCurrentSrc] = useState<string | null>(src);
    const [retryCount, setRetryCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    console.log('SafeImage render - src:', src, 'currentSrc:', currentSrc, 'hasError:', hasError, 'retryCount:', retryCount);

    // Update currentSrc when src changes
    useEffect(() => {
      const loadImage = async () => {
        if (!src) {
          setCurrentSrc(null);
          setHasError(false);
          setRetryCount(0);
          return;
        }

        setIsLoading(true);
        try {
          // If it's a Google Drive URL, get the authenticated URL
          if (src.includes('drive.google.com')) {
            console.log('Processing Google Drive URL in SafeImage...');
            const authenticatedSrc = await getSafeImageSource(src);
            console.log('SafeImage got URL:', authenticatedSrc);
            setCurrentSrc(authenticatedSrc);
          } else {
            setCurrentSrc(src);
          }
          setHasError(false);
          setRetryCount(0);
        } catch (error) {
          console.error('Error loading image source:', error);
          setCurrentSrc(src); // Fallback to original
          setHasError(false);
          setRetryCount(0);
        } finally {
          setIsLoading(false);
        }
      };

      loadImage();
    }, [src]);

    if (isLoading) {
      return (
        <div className={`${className} bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center`}>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (hasError || !currentSrc) {
      return (
        <div className={`${className} bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center`}>
          <Shield className="h-8 w-8 text-gray-400" />
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50 bg-opacity-75 rounded-lg">
              <span className="text-xs text-red-600">Image failed to load</span>
            </div>
          )}
        </div>
      );
    }

    const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      console.error(`Failed to load image: ${currentSrc}`);
      
      // Try alternative URL format for Google Drive
      if (currentSrc && currentSrc.includes('drive.google.com') && retryCount < 3) {
        setRetryCount(prev => prev + 1);
        
        if (!currentSrc.includes('&confirm=')) {
          const newSrc = `${currentSrc}&confirm=t&uuid=${Date.now()}`;
          console.log('Trying alternative URL format:', newSrc);
          setCurrentSrc(newSrc);
          setHasError(false);
          return;
        } else if (!currentSrc.includes('&uuid=')) {
          const newSrc = `${currentSrc}&uuid=${Date.now()}`;
          console.log('Adding UUID to URL:', newSrc);
          setCurrentSrc(newSrc);
          setHasError(false);
          return;
        } else {
          // Try removing all parameters and adding fresh ones
          const baseUrl = currentSrc.split('?')[0];
          const newSrc = `${baseUrl}?export=view&id=${currentSrc.match(/id=([^&]+)/)?.[1]}&confirm=t&uuid=${Date.now()}`;
          console.log('Trying fresh URL format:', newSrc);
          setCurrentSrc(newSrc);
          setHasError(false);
          return;
        }
      }
      
      setHasError(true);
    };

    return (
      <img 
        src={currentSrc} 
        alt={alt} 
        className={className}
        onLoad={() => {
          console.log('Image loaded successfully:', currentSrc);
        }}
        onError={handleError}
      />
    );
  };

  // Load existing data on component mount
  useEffect(() => {
    if (isChairperson) {
      loadSKProfile();
      fetchMembers();
    }
  }, [isChairperson]);

  const loadSKProfile = async () => {
    try {
      setIsLoading(true);
      const existingProfile = await getSKProfile();
      if (existingProfile) {
        const { id, ...profileData } = existingProfile;
        const typedProfileData = profileData as SKProfile;
        setProfile(typedProfileData);
        setExistingProfileId(id);
        setSKProfile(typedProfileData);
        setMessage('SK Profile loaded successfully!');
        setIsSuccess(true);
        setTimeout(() => {
          setMessage('');
          setIsSuccess(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Error loading SK profile:', error);
      setMessage('Error loading SK profile. Starting fresh setup.');
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
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
    }
  };

  // SK Profile Functions
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Cleanup logo preview on unmount
  useEffect(() => {
    return () => {
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

     // Handle logo file change
   const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     console.log('File selected:', file);
     
     if (file) {
       console.log('File details:', {
         name: file.name,
         type: file.type,
         size: file.size,
         sizeInMB: (file.size / (1024 * 1024)).toFixed(2) + 'MB'
       });
       
       // Validate file type
       if (!file.type.startsWith('image/')) {
         console.log('Invalid file type:', file.type);
         setMessage('Please select a valid image file');
         setIsSuccess(false);
         return;
       }

       // Validate file size (5MB limit)
       if (file.size > 5 * 1024 * 1024) {
         console.log('File too large:', file.size);
         setMessage('File size must be less than 5MB');
         setIsSuccess(false);
         return;
       }

       console.log('File validation passed, setting logo file');
       setLogoFile(file);
       
       // Create preview
       const reader = new FileReader();
       reader.onload = (e) => {
         if (e.target?.result) {
           console.log('Preview created successfully');
           setLogoPreview(e.target.result as string);
         }
       };
       reader.onerror = () => {
         console.error('Error reading file for preview');
         setMessage('Error reading file for preview');
         setIsSuccess(false);
       };
       reader.readAsDataURL(file);
     } else {
       console.log('No file selected');
     }
   };

  const handleSaveProfile = async () => {
    // Validate required fields
    if (!profile.region || !profile.province || !profile.city || !profile.barangay || !profile.federationPresident) {
      setMessage('Please fill in all required fields before saving.');
      setIsSuccess(false);
      return;
    }

    // Validate logo upload
    if (!logoFile && !profile.logo) {
      setMessage('Please upload a barangay logo before saving.');
      setIsSuccess(false);
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      console.log('Starting save process...');
      console.log('Existing profile ID:', existingProfileId);
      console.log('Profile data:', profile);

      let logoUrl = profile.logo;

      // Enable logo upload
      const skipLogoUpload = false; // Logo upload is now enabled

             if (logoFile && !skipLogoUpload) {
         try {
           console.log('Starting logo upload to Google Drive...');
           console.log('Logo file:', logoFile);
           console.log('Logo file name:', logoFile.name);
           console.log('Logo file size:', logoFile.size);
           
           const logoPath = `logo_${Date.now()}`;
           console.log('Logo path:', logoPath);
           
           logoUrl = await uploadFile(logoFile, logoPath);
           console.log('Logo uploaded successfully to Google Drive:', logoUrl);
         } catch (uploadError: any) {
           console.error('Google Drive logo upload failed:', uploadError);
           console.error('Upload error details:', {
             message: uploadError?.message || 'Unknown error',
             code: uploadError?.code || 'No code',
             stack: uploadError?.stack || 'No stack'
           });
           
           // Show detailed error message
           const errorMessage = uploadError?.message || 'Google Drive upload failed';
           setMessage(`Logo upload failed: ${errorMessage}. Please check your internet connection and Google Drive access, then try again.`);
           setIsSuccess(false);
           setIsSaving(false);
           return;
         }
       } else {
         console.log('No logo file to upload or upload skipped');
         console.log('logoFile:', logoFile);
         console.log('skipLogoUpload:', skipLogoUpload);
       }

      const profileData = {
        logo: logoUrl,
        region: profile.region,
        province: profile.province,
        city: profile.city,
        barangay: profile.barangay,
        skTermStart: profile.skTermStart,
        skTermEnd: profile.skTermEnd,
        federationPresident: profile.federationPresident,
        updatedBy: user?.uid,
        updatedAt: new Date()
      };

      console.log('Profile data to save:', profileData);

      let profileId;
      if (existingProfileId) {
        console.log('Updating existing profile with ID:', existingProfileId);
        await updateSKProfile(existingProfileId, profileData);
        profileId = existingProfileId;
        console.log('Profile updated successfully');
      } else {
        console.log('Creating new profile...');
        profileId = await createSKProfile(profileData);
        setExistingProfileId(profileId);
        console.log('New profile created with ID:', profileId);
      }

      setSKProfile({ ...profile, logo: logoUrl });

      if (!logoFile || logoUrl !== profile.logo) {
        if (!skipLogoUpload) {
          setMessage('SK Profile saved successfully!');
        }
      }
      setIsSuccess(true);
      
      // Don't automatically move to step 2 - let user choose
      setTimeout(() => {
        setMessage('');
        setIsSuccess(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error saving SK profile:', error);
      setMessage('Error saving SK profile. Please try again.');
      setIsSuccess(false);
    } finally {
      setIsSaving(false);
    }
  };

  // User Management Functions
    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      // Store current chairperson info before creating new user
      const currentChairpersonEmail = 'chairperson@skclear.com';
      const currentChairpersonPassword = 'chairperson123';

      console.log('Creating new user while logged in as:', auth.currentUser?.email);

      // Set flag to prevent auth state change from affecting current user
      setIsCreatingUser(true);

      // Create the new user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      console.log('New user created, now signed in as:', userCredential.user.email);

      // Add user data to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        barangay: profile.barangay,
        municipality: profile.city,
        province: profile.province,
        skTermStart: profile.skTermStart,
        skTermEnd: profile.skTermEnd,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Immediately sign out the new user
      await signOut(auth);
      console.log('Signed out new user');

      // Sign back in as the chairperson
      try {
        await signInWithEmailAndPassword(auth, currentChairpersonEmail, currentChairpersonPassword);
        console.log('Signed back in as chairperson');
      } catch (signInError) {
        console.error('Error signing back in as chairperson:', signInError);
        // If sign-in fails, show error but don't redirect
        setMessage('User created successfully, but there was an issue with the session. Please refresh the page.');
        setIsSuccess(false);
        setIsCreatingUser(false);
        return;
      }

      // Reset the flag
      setIsCreatingUser(false);

      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'council_member'
      });

      setMessage('User created successfully!');
      setIsSuccess(true);
      
      await fetchMembers();

      setTimeout(() => {
        setMessage('');
        setIsSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('Error creating user:', error);
      setMessage(error.message || 'Error creating user');
      setIsSuccess(false);
      // Reset the flag on error
      setIsCreatingUser(false);
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

  const handleEditMember = (member: SKMember) => {
    setEditingMember(member);
    setEditFormData({
      name: member.name,
      email: member.email,
      password: '',
      role: member.role as 'chairperson' | 'secretary' | 'treasurer' | 'council_member'
    });
    setCurrentPassword('');
    setShowCurrentPassword(false);
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setIsSubmitting(true);
    setMessage('');

    try {
      const updateData: any = {
        name: editFormData.name,
        role: editFormData.role,
        barangay: profile.barangay,
        municipality: profile.city,
        province: profile.province,
        skTermStart: profile.skTermStart,
        skTermEnd: profile.skTermEnd,
        updatedAt: new Date()
      };

      // Only allow email change for chairperson (themselves)
      if (editingMember.role === 'chairperson' && editFormData.email !== editingMember.email) {
        updateData.email = editFormData.email;
      }

      // Update Firestore document
      await updateDoc(doc(db, 'users', editingMember.id), updateData);

      // Handle password update if provided
      if (editFormData.password) {
        try {
          // For password updates, we need to sign in as the user first
          // This is a limitation of Firebase Auth - only the user can change their own password
          // For now, we'll just update the Firestore document and show a message
          console.log('Password update requested for:', editingMember.email);
          setMessage('Member updated successfully! Note: Password changes require the user to reset their password through email.');
        } catch (passwordError) {
          console.error('Error updating password:', passwordError);
          setMessage('Member updated successfully! Password update failed - user will need to reset password through email.');
        }
      } else {
        setMessage('Member updated successfully!');
      }

      setIsSuccess(true);
      setEditingMember(null);
      
      setEditFormData({
        name: '',
        email: '',
        password: '',
        role: 'council_member'
      });
      setCurrentPassword('');
      setShowCurrentPassword(false);

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

     const handleUpdateChairperson = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!editingMember || editingMember.role !== 'chairperson') return;

     setIsSubmitting(true);
     setMessage('');

     try {
       const updateData: any = {
         name: editFormData.name,
         role: editFormData.role,
         barangay: profile.barangay,
         municipality: profile.city,
         province: profile.province,
         skTermStart: profile.skTermStart,
         skTermEnd: profile.skTermEnd,
         updatedAt: new Date()
       };

       // Allow email change for chairperson
       if (editFormData.email !== editingMember.email) {
         updateData.email = editFormData.email;
       }

       // Update Firestore document
       await updateDoc(doc(db, 'users', editingMember.id), updateData);

             // Handle password update if provided
      if (editFormData.password) {
        try {
          // For chairperson, we can update their password with re-authentication
          if (auth.currentUser && auth.currentUser.email === editingMember.email) {
            if (!currentPassword) {
              setMessage('Current password is required to update password.');
              setIsSuccess(false);
              return;
            }

            // Re-authenticate the user
            const credential = EmailAuthProvider.credential(editingMember.email, currentPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);
            
            // Update the password
            await updatePassword(auth.currentUser, editFormData.password);
            
            setMessage('Member updated successfully! Password has been changed.');
          } else {
            setMessage('Member updated successfully! Note: Password changes require the user to reset their password through email.');
          }
        } catch (passwordError: any) {
          console.error('Error updating password:', passwordError);
          if (passwordError.code === 'auth/wrong-password') {
            setMessage('Current password is incorrect. Please try again.');
          } else if (passwordError.code === 'auth/weak-password') {
            setMessage('New password is too weak. Please use a stronger password.');
          } else {
            setMessage('Member updated successfully! Password update failed - user will need to reset password through email.');
          }
          setIsSuccess(false);
          return;
        }
      } else {
        setMessage('Member updated successfully!');
      }

       setIsSuccess(true);
       setEditingMember(null);
       
       setEditFormData({
         name: '',
         email: '',
         password: '',
         role: 'council_member'
       });

       await fetchMembers();

       setTimeout(() => {
         setMessage('');
         setIsSuccess(false);
       }, 3000);

     } catch (error: any) {
       console.error('Error updating chairperson:', error);
       setMessage(error.message || 'Error updating chairperson');
       setIsSuccess(false);
     } finally {
       setIsSubmitting(false);
     }
   };

  const cancelEdit = () => {
    setEditingMember(null);
    setEditFormData({
      name: '',
      email: '',
      password: '',
      role: 'council_member'
    });
    setCurrentPassword('');
    setShowCurrentPassword(false);
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
          <p className="text-gray-600">Only the SK Chairperson can access this setup.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SK Setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">SK Setup & User Management</h1>
        <p className="text-gray-600">Complete your barangay setup and manage SK council members</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center ${currentStep >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              currentStep >= 1 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
            }`}>
              1
            </div>
            <span className="ml-2 font-medium">Barangay Setup</span>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
          <div className={`flex items-center ${currentStep >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              currentStep >= 2 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
            }`}>
              2
            </div>
            <span className="ml-2 font-medium">Council Members</span>
          </div>
        </div>
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

      {/* Step 1: Barangay Setup */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Logo Upload */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Barangay Logo *</h3>
              <p className="text-sm text-gray-600 mt-1">Upload your barangay logo (required)</p>
            </div>
            <div className="card-body">
              <div className="flex items-center space-x-6">
                <div className="flex-shrink-0">
                  {logoPreview ? (
                    <SafeImage 
                      src={logoPreview} 
                      alt="Barangay Logo" 
                      className="h-20 w-20 object-cover rounded-lg border-2 border-gray-200"
                    />
                  ) : profile.logo ? (
                    <SafeImage 
                      src={profile.logo} 
                      alt="Barangay Logo" 
                      className="h-20 w-20 object-cover rounded-lg border-2 border-gray-200"
                    />
                  ) : (
                    <SafeImage 
                      src={null} 
                      alt="Barangay Logo" 
                      className="h-20 w-20 object-cover rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <label className="form-label">Upload Logo *</label>
                                     <input
                     type="file"
                     accept="image/*"
                     onChange={handleLogoChange}
                     className="input-field"
                     required
                     id="logo-upload"
                   />
                                     <p className="text-xs text-gray-500 mt-1">
                     Required: Square image, max 5MB. Formats: JPG, PNG, GIF. Files will be saved to Google Drive.
                   </p>
                  {!logoFile && !profile.logo && (
                    <p className="text-xs text-danger-600 mt-1">
                      Please upload a barangay logo
                    </p>
                  )}
                  {profile.logo && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                      <p className="text-blue-700">Current logo URL: {profile.logo}</p>
                      <div className="mt-1 space-y-1">
                        <button 
                          type="button" 
                          onClick={async () => {
                            try {
                              console.log('=== Manual Test Start ===');
                              console.log('Original URL:', profile.logo);
                              
                              if (!profile.logo) {
                                console.log('No logo URL to test');
                                return;
                              }
                              
                              // Test Google Drive service directly
                              const googleDriveService = (await import('../services/googleDriveService')).default;
                              console.log('Google Drive service loaded');
                              console.log('Is signed in:', googleDriveService.isSignedIn());
                              
                              // Extract file ID
                              const fileId = profile.logo.match(/id=([^&]+)/)?.[1];
                              console.log('Extracted file ID:', fileId);
                              
                              if (fileId) {
                                const file = await googleDriveService.getFile(fileId);
                                console.log('File from API:', file);
                              }
                              
                              const converted = await getSafeImageSource(profile.logo);
                              console.log('Converted URL:', converted);
                              console.log('=== Manual Test End ===');
                            } catch (error) {
                              console.error('Manual test failed:', error);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Test URL Conversion
                        </button>
                        <button 
                          type="button" 
                          onClick={() => {
                            const fileId = profile.logo?.match(/id=([^&]+)/)?.[1];
                            if (fileId) {
                              const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
                              console.log('Direct thumbnail URL:', thumbnailUrl);
                              // Open in new tab to test
                              window.open(thumbnailUrl, '_blank');
                            }
                          }}
                          className="text-green-600 hover:text-green-800 underline block"
                        >
                          Test Thumbnail Directly
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            </div>
            <div className="card-body">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="form-label">Region</label>
                      <input
                        type="text"
                        value={profile.region}
                        onChange={(e) => setProfile({...profile, region: e.target.value})}
                        className="input-field"
                        placeholder="Enter region"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Province</label>
                      <input
                        type="text"
                        value={profile.province}
                        onChange={(e) => setProfile({...profile, province: e.target.value})}
                        className="input-field"
                        placeholder="Enter province"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">City/Municipality</label>
                      <input
                        type="text"
                        value={profile.city}
                        onChange={(e) => setProfile({...profile, city: e.target.value})}
                        className="input-field"
                        placeholder="Enter city or municipality"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Barangay</label>
                      <input
                        type="text"
                        value={profile.barangay}
                        onChange={(e) => setProfile({...profile, barangay: e.target.value})}
                        className="input-field"
                        placeholder="Enter barangay name"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">SK Federation President</label>
                      <input
                        type="text"
                        value={profile.federationPresident}
                        onChange={(e) => setProfile({...profile, federationPresident: e.target.value})}
                        className="input-field"
                        placeholder="Enter federation president name"
                        required
                      />
                    </div>
                  </div>
            </div>
          </div>

          {/* SK Term */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">SK Term</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Term Start Year</label>
                  <input
                    type="number"
                    value={profile.skTermStart}
                    onChange={(e) => setProfile({...profile, skTermStart: parseInt(e.target.value)})}
                    className="input-field"
                    placeholder="2024"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Term End Year</label>
                  <input
                    type="number"
                    value={profile.skTermEnd}
                    onChange={(e) => setProfile({...profile, skTermEnd: parseInt(e.target.value)})}
                    className="input-field"
                    placeholder="2026"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="btn-secondary flex items-center"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!existingProfileId}
              className="btn-primary flex items-center"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Continue to Council Members
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Council Members */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Add/Edit Member Form */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingMember 
                    ? (editingMember.role === 'chairperson' ? 'Edit Chairperson Profile' : 'Edit Member') 
                    : 'Add New Member'
                  }
                </h3>
              </div>
              <div className="card-body">
                <form onSubmit={editingMember ? (editingMember.role === 'chairperson' ? handleUpdateChairperson : handleUpdateMember) : handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        value={editingMember ? editFormData.name : formData.name}
                        onChange={(e) => editingMember 
                          ? setEditFormData({...editFormData, name: e.target.value})
                          : setFormData({...formData, name: e.target.value})
                        }
                        className="input-field"
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        value={editingMember ? editFormData.email : formData.email}
                        onChange={(e) => editingMember 
                          ? setEditFormData({...editFormData, email: e.target.value})
                          : setFormData({...formData, email: e.target.value})
                        }
                        className="input-field"
                        placeholder="Enter email address"
                        required
                        disabled={!!editingMember && editingMember.role !== 'chairperson'}
                      />
                      {editingMember && editingMember.role !== 'chairperson' && (
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed for non-chairperson members</p>
                      )}
                    </div>
                    <div>
                      <label className="form-label">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={editingMember ? editFormData.password : formData.password}
                          onChange={(e) => editingMember 
                            ? setEditFormData({...editFormData, password: e.target.value})
                            : setFormData({...formData, password: e.target.value})
                          }
                          className="input-field pr-10"
                          placeholder={editingMember ? 'Leave blank to keep current' : 'Enter password'}
                          required={!editingMember}
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
                    {editingMember && editingMember.role === 'chairperson' && editFormData.password && (
                      <div>
                        <label className="form-label">Current Password *</label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="input-field pr-10"
                            placeholder="Enter current password to confirm changes"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Required to update password</p>
                      </div>
                    )}
                    <div>
                      <label className="form-label">Role</label>
                      <select
                        value={editingMember ? editFormData.role : formData.role}
                        onChange={(e) => editingMember 
                          ? setEditFormData({...editFormData, role: e.target.value as any})
                          : setFormData({...formData, role: e.target.value})
                        }
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
                          {editingMember 
                            ? (editingMember.role === 'chairperson' ? 'Updating Chairperson...' : 'Updating...') 
                            : 'Creating...'
                          }
                        </>
                      ) : (
                        <>
                          {editingMember ? <Save className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                          {editingMember 
                            ? (editingMember.role === 'chairperson' ? 'Update Chairperson' : 'Update Member') 
                            : 'Add Member'
                          }
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
                {members.length === 0 ? (
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
          <div className="card">
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

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="btn-secondary flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Barangay Setup
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn-primary flex items-center"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Setup Complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SKSetup; 