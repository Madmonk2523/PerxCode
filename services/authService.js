import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Register a new user with email and password.
 * Creates a Firestore user document on first signup only.
 */
export async function signup(email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const uid = credential.user.uid;

  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);

  // Only create the document if it doesn't already exist — preserves balance on re-signup edge cases
  if (!existing.exists()) {
    await setDoc(userRef, {
      email: credential.user.email,
      tokenBalance: 0,
      createdAt: serverTimestamp(),
    });
  }

  return credential.user;
}

/**
 * Sign in with email and password.
 */
export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

/**
 * Sign the current user out.
 */
export async function logout() {
  await signOut(auth);
}
