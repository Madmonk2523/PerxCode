import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// ─── PASTE YOUR FIREBASE CONFIG HERE ─────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyATjIFByHZBBGr1R-L7euVmjohoOQm0nJA',
  authDomain: 'app-idea-adam.firebaseapp.com',
  projectId: 'app-idea-adam',
  storageBucket: 'app-idea-adam.firebasestorage.app',
  messagingSenderId: '871917956722',
  appId: '1:871917956722:web:4772cf99fde973cca09ceb',
};
// ─────────────────────────────────────────────────────────────────────────────

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
