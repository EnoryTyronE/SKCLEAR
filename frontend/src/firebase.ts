// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQfKgRdvWGLPAvyaNFVE-m-mqA7GbtFXs",
  authDomain: "sk-clear.firebaseapp.com",
  projectId: "sk-clear",
  storageBucket: "sk-clear.firebasestorage.app",
  messagingSenderId: "198256677100",
  appId: "1:198256677100:web:bd2dac562cba390e3f55c9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services for use in the app
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;