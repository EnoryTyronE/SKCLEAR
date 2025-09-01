import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const setupChairperson = async () => {
  try {
    let user;
    
    // Try to sign in first to check if account exists
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        'chairperson@skclear.com',
        'chairperson123'
      );
      user = userCredential.user;
      console.log('Chairperson account already exists, signed in:', user.uid);
    } catch (signInError: any) {
      // If sign in fails, create new account
      if (signInError.code === 'auth/user-not-found') {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          'chairperson@skclear.com',
          'chairperson123'
        );
        user = userCredential.user;
        console.log('Chairperson account created:', user.uid);
      } else {
        throw signInError;
      }
    }

    // Check if user document exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      // Add user data to Firestore if it doesn't exist
      await setDoc(doc(db, 'users', user.uid), {
        name: 'SK Chairperson',
        email: 'chairperson@skclear.com',
        role: 'chairperson',
        barangay: 'Your Barangay Name',
        municipality: 'Your Municipality', 
        province: 'Your Province',
        skTermStart: 2024,
        skTermEnd: 2026,
        isActive: true,
        isFirstLogin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Chairperson data added to Firestore');
    } else {
      // Update existing user document to ensure correct role
      await setDoc(doc(db, 'users', user.uid), {
        name: 'SK Chairperson',
        email: 'chairperson@skclear.com',
        role: 'chairperson',
        barangay: userDoc.data().barangay || 'Your Barangay Name',
        municipality: userDoc.data().municipality || 'Your Municipality',
        province: userDoc.data().province || 'Your Province',
        skTermStart: userDoc.data().skTermStart || 2024,
        skTermEnd: userDoc.data().skTermEnd || 2026,
        isActive: true,
        isFirstLogin: false,
        createdAt: userDoc.data().createdAt || new Date(),
        updatedAt: new Date()
      }, { merge: true });
      console.log('Chairperson data updated in Firestore');
    }

    return user;
  } catch (error: any) {
    console.error('Error setting up chairperson:', error);
    throw error;
  }
};

// Test function to check if chairperson exists
export const checkChairpersonExists = async () => {
  try {
    const userDoc = await getDoc(doc(db, 'users', 'chairperson@skclear.com'));
    return userDoc.exists();
  } catch (error) {
    console.error('Error checking chairperson:', error);
    return false;
  }
};
