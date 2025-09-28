import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  setDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import googleDriveService from './googleDriveService';

// User Management
export const createUserProfile = async (uid: string, userData: any) => {
  try {
    await setDoc(doc(db, 'users', uid), {
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

export const getUserProfile = async (uid: string) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

export const updateUserProfile = async (uid: string, userData: any) => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...userData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// SK Profile Management
export const createSKProfile = async (profileData: any) => {
  try {
    const docRef = await addDoc(collection(db, 'sk_profiles'), {
      ...profileData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating SK profile:', error);
    throw error;
  }
};

export const getSKProfile = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'sk_profiles'));
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0]; // Get the first SK profile
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting SK profile:', error);
    throw error;
  }
};

export const updateSKProfile = async (profileId: string, profileData: any) => {
  try {
    await updateDoc(doc(db, 'sk_profiles', profileId), {
      ...profileData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating SK profile:', error);
    throw error;
  }
};

// CBYDP Management
export const createCBYDP = async (cbydpData: any) => {
  try {
    const docRef = await addDoc(collection(db, 'cbydp'), {
      ...cbydpData,
      createdBy: cbydpData.lastEditedBy || cbydpData.initiatedBy || 'Unknown',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating CBYDP:', error);
    throw error;
  }
};

export const getCBYDP = async () => {
  try {
    console.log('Fetching CBYDP from Firestore...');
    const querySnapshot = await getDocs(
      query(collection(db, 'cbydp'), orderBy('updatedAt', 'desc'))
    );
    console.log('CBYDP query result:', querySnapshot.size, 'documents found');
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0]; // Get the most recent CBYDP
      const data = { id: doc.id, ...doc.data() };
      console.log('Retrieved CBYDP:', data);
      return data;
    }
    console.log('No CBYDP documents found');
    return null;
  } catch (error) {
    console.error('Error getting CBYDP:', error);
    throw error;
  }
};

export const updateCBYDP = async (cbydpId: string, cbydpData: any) => {
  try {
    await updateDoc(doc(db, 'cbydp', cbydpId), {
      ...cbydpData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating CBYDP:', error);
    throw error;
  }
};

export const deleteCBYDP = async (cbydpId: string) => {
  try {
    await deleteDoc(doc(db, 'cbydp', cbydpId));
    return true;
  } catch (error) {
    console.error('Error deleting CBYDP:', error);
    throw error;
  }
};

export const getAllCBYDP = async () => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, 'cbydp'), orderBy('createdAt', 'desc'))
    );
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all CBYDP:', error);
    throw error;
  }
};

export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    console.log('Starting file upload to Google Drive:', path);
    console.log('File size:', file.size, 'bytes');
    
    // Only use Google Drive for all uploads
    const result = await googleDriveService.uploadFile(file, 'SK Management System');
    
    // Save metadata to Firestore
    await saveFileMetadata({
      fileId: result.fileId,
      webViewLink: result.webViewLink,
      webContentLink: result.webContentLink,
      originalName: file.name,
      size: file.size,
      uploadedBy: auth.currentUser?.uid,
      uploadedAt: new Date(),
      category: path
    });
    
    // Return the correct URL based on file type
    let returnUrl = result.webViewLink;
    if (file.type.startsWith('image/')) {
      // For images, use the thumbnail format which is more reliable
      returnUrl = `https://drive.google.com/thumbnail?id=${result.fileId}&sz=w400`;
    }
    
    console.log('File uploaded to Google Drive:', returnUrl);
    return returnUrl;
  } catch (error: any) {
    console.error('Google Drive upload failed:', error);
    throw new Error(`Upload failed: ${error.message || 'Google Drive upload failed. Please check your internet connection and try again.'}`);
  }
};

// Helper function to get file from local storage (for existing files)
export const getFileFromLocalStorage = (localUrl: string): string | null => {
  if (localUrl.startsWith('local://')) {
    const storageKey = localUrl.replace('local://', '');
    return localStorage.getItem(storageKey);
  }
  return null;
};

// Helper function to convert Google Drive URLs to direct download format
export const convertGoogleDriveUrl = (url: string): string => {
  console.log('Converting Google Drive URL:', url);
  
  if (url.includes('drive.google.com/file/d/')) {
    // Extract file ID from Google Drive URL
    const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      // Try multiple URL formats for better compatibility
      const convertedUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
      console.log('Converted URL (thumbnail):', convertedUrl);
      return convertedUrl;
    }
  }
  
  // If it's already in the correct format, return as is
  if (url.includes('drive.google.com/uc?export=view&id=')) {
    // Convert to thumbnail format for better compatibility
    const fileId = url.match(/id=([^&]+)/)?.[1];
    if (fileId) {
      const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
      console.log('Converted to thumbnail URL:', thumbnailUrl);
      return thumbnailUrl;
    }
    console.log('URL already in correct format:', url);
    return url;
  }
  
  console.log('No conversion needed, returning original:', url);
  return url;
};

// Helper function to get authenticated Google Drive image URL
export const getAuthenticatedDriveUrl = async (fileId: string): Promise<string> => {
  try {
    console.log('Getting authenticated URL for file ID:', fileId);
    
    // Import the Google Drive service
    const googleDriveService = (await import('./googleDriveService')).default;
    
    // Check if we have an access token
    const isSignedIn = googleDriveService.isSignedIn();
    console.log('Google Drive signed in:', isSignedIn);
    
    if (!isSignedIn) {
      console.log('Not signed in to Google Drive, using thumbnail URL');
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }
    
    // Get the file using the API with authentication
    console.log('Fetching file from Google Drive API...');
    const file = await googleDriveService.getFile(fileId);
    console.log('File result:', file);
    
    if (file && file.webContentLink) {
      console.log('Got authenticated URL:', file.webContentLink);
      return file.webContentLink;
    }
    
    console.log('No webContentLink found, using thumbnail URL');
    // Fallback to thumbnail URL which is more reliable
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
  } catch (error) {
    console.error('Error getting authenticated URL:', error);
    // Fallback to thumbnail URL
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
  }
};

// Save file metadata to Firestore
const saveFileMetadata = async (metadata: any) => {
  try {
    await addDoc(collection(db, 'files'), {
      ...metadata,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error saving file metadata:', error);
  }
};

// SK Members Management
export const createSKMember = async (memberData: any) => {
  try {
    const docRef = await addDoc(collection(db, 'sk_members'), {
      ...memberData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating SK member:', error);
    throw error;
  }
};

export const getSKMembers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'sk_members'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting SK members:', error);
    throw error;
  }
};

export const updateSKMember = async (memberId: string, memberData: any) => {
  try {
    await updateDoc(doc(db, 'sk_members', memberId), {
      ...memberData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating SK member:', error);
    throw error;
  }
};

// Check if user is first time login
export const checkFirstTimeLogin = async (uid: string): Promise<boolean> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.isFirstLogin === true;
    }
    return true; // If user doesn't exist, consider it first time
  } catch (error) {
    console.error('Error checking first time login:', error);
    return true;
  }
};

// Mark user as not first time login
export const markNotFirstTimeLogin = async (uid: string) => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      isFirstLogin: false,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error marking not first time login:', error);
    throw error;
  }
};

// ABYIP Management
export const createABYIP = async (abyipData: any) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Check if ABYIP already exists for this year
    const existingABYIP = await getABYIP(abyipData.year);
    if (existingABYIP) {
      throw new Error(`ABYIP for year ${abyipData.year} already exists`);
    }

    const docRef = await addDoc(collection(db, 'abyip'), {
      ...abyipData,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating ABYIP:', error);
    throw error;
  }
};

export const getABYIP = async (year: string) => {
  try {
    console.log('Getting ABYIP for year:', year);

    // Get all ABYIPs, then filter by year in JavaScript
    // This allows all SK members to see ABYIPs (like CBYDP)
    const querySnapshot = await getDocs(collection(db, 'abyip'));
    console.log('ABYIP query result:', querySnapshot.docs.length, 'documents found');
    
    // Filter by year in JavaScript
    const abyipForYear = querySnapshot.docs.find(doc => {
      const data = doc.data();
      return data.year === year;
    });
    
    if (abyipForYear) {
      const data = { id: abyipForYear.id, ...abyipForYear.data() };
      console.log('ABYIP data retrieved:', data);
      return data;
    }
    console.log('No ABYIP found for year:', year);
    return null;
  } catch (error) {
    console.error('Error getting ABYIP:', error);
    throw error;
  }
};

// Get all ABYIPs (for debugging and management)
export const getAllABYIPs = async () => {
  try {
    console.log('Getting all ABYIPs...');

    // Get all ABYIPs (like CBYDP) - no user filtering
    const querySnapshot = await getDocs(collection(db, 'abyip'));
    const abyips = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by creation date in JavaScript
    abyips.sort((a, b) => {
      const dateA = (a as any).createdAt?.toDate?.() || new Date(0);
      const dateB = (b as any).createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime(); // Descending order
    });
    
    console.log('All ABYIPs:', abyips);
    return abyips;
  } catch (error) {
    console.error('Error getting all ABYIPs:', error);
    throw error;
  }
};

export const updateABYIP = async (abyipId: string, abyipData: any) => {
  try {
    await updateDoc(doc(db, 'abyip', abyipId), {
      ...abyipData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating ABYIP:', error);
    throw error;
  }
};

export const deleteABYIP = async (abyipId: string) => {
  try {
    await deleteDoc(doc(db, 'abyip', abyipId));
    return true;
  } catch (error) {
    console.error('Error deleting ABYIP:', error);
    throw error;
  }
};

// Clear all ABYIP documents for the current user
export const clearAllABYIPs = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    console.log('Clearing all ABYIPs for user:', user.uid);

    // Get all ABYIPs for the current user
    const q = query(
      collection(db, 'abyip'),
      where('createdBy', '==', user.uid)
    );
    
    const querySnapshot = await getDocs(q);
    console.log('Found', querySnapshot.docs.length, 'ABYIP documents to delete');
    
    // Delete each document
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log('Successfully deleted all ABYIP documents');
    return true;
  } catch (error) {
    console.error('Error clearing all ABYIPs:', error);
    throw error;
  }
};

// SK Annual Budget Management
export const createSKAnnualBudget = async (budgetData: any) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Check if budget already exists for this year
    const existingBudget = await getSKAnnualBudget(budgetData.year);
    if (existingBudget) {
      throw new Error(`SK Annual Budget for year ${budgetData.year} already exists`);
    }

    const docRef = await addDoc(collection(db, 'sk_annual_budgets'), {
      ...budgetData,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating SK Annual Budget:', error);
    throw error;
  }
};

export const getSKAnnualBudget = async (year: string) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    console.log('Getting SK Annual Budget for year:', year, 'user:', user.uid);

    // Get all budgets for the user, then filter by year
    const q = query(
      collection(db, 'sk_annual_budgets'),
      where('createdBy', '==', user.uid)
    );
    
    const querySnapshot = await getDocs(q);
    console.log('SK Annual Budget query result:', querySnapshot.docs.length, 'documents found');
    
    // Filter by year in JavaScript
    const budgetForYear = querySnapshot.docs.find(doc => {
      const data = doc.data();
      return data.year === year;
    });
    
    if (budgetForYear) {
      const data = { id: budgetForYear.id, ...budgetForYear.data() };
      console.log('SK Annual Budget data retrieved:', data);
      return data;
    }
    console.log('No SK Annual Budget found for year:', year);
    return null;
  } catch (error) {
    console.error('Error getting SK Annual Budget:', error);
    throw error;
  }
};

export const getAllSKAnnualBudgets = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const q = query(
      collection(db, 'sk_annual_budgets'),
      where('createdBy', '==', user.uid)
    );
    
    const querySnapshot = await getDocs(q);
    const budgets = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by year in descending order
    budgets.sort((a, b) => {
      const yearA = parseInt((a as any).year) || 0;
      const yearB = parseInt((b as any).year) || 0;
      return yearB - yearA;
    });
    
    console.log('All SK Annual Budgets for user:', budgets);
    return budgets;
  } catch (error) {
    console.error('Error getting all SK Annual Budgets:', error);
    throw error;
  }
};

export const updateSKAnnualBudget = async (budgetId: string, budgetData: any) => {
  try {
    await updateDoc(doc(db, 'sk_annual_budgets', budgetId), {
      ...budgetData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating SK Annual Budget:', error);
    throw error;
  }
};

export const deleteSKAnnualBudget = async (budgetId: string) => {
  try {
    await deleteDoc(doc(db, 'sk_annual_budgets', budgetId));
    return true;
  } catch (error) {
    console.error('Error deleting SK Annual Budget:', error);
    throw error;
  }
};

