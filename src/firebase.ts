import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { CAMPUS_PINS } from './types';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Auth helper
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginAnonymously = () => signInAnonymously(auth);
export const logout = () => signOut(auth);

// Type for our user profile
export interface UserProfile {
  id: string; // The Document ID (either UUID or email/auto-id)
  uid: string | null;
  email?: string;
  role: 'admin' | 'tech';
  displayName?: string; // The assigned name for technicians
  campusId?: string; // Techs are restricted to a campus
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) {
    return { ...userDoc.data(), id: userDoc.id } as UserProfile;
  }
  return null;
}

export async function createUserProfile(uid: string, email: string | null): Promise<UserProfile> {
  const profileEmail = email?.toLowerCase() || `anon-${uid}@ilt.org`;
  
  // Check if there's a pre-authorized document with this email
  if (email) {
    const guestDoc = await getDoc(doc(db, 'users', email.toLowerCase()));
    
    if (guestDoc.exists()) {
      const data = guestDoc.data();
  // Move the data to the uid-based document
      const profile: any = {
        ...data,
        id: uid,
        uid,
        email: email.toLowerCase(),
        role: data.role || 'tech',
      };
      if (data.displayName) profile.displayName = data.displayName;
      if (data.campusId) profile.campusId = data.campusId;

      await setDoc(doc(db, 'users', uid), profile);
      // Delete the temporary email-based doc
      await deleteDoc(doc(db, 'users', email.toLowerCase()));
      return profile as UserProfile;
    }
  }

  // Check if this is a default admin (for legacy Google login)
  const adminEmails = ['cesarchaanine3@gmail.com', 'reportilt@gmail.com'];
  const isAdmin = email && adminEmails.includes(email.toLowerCase());
  
  const profile: UserProfile = {
    id: uid,
    uid,
    email: profileEmail,
    role: isAdmin ? 'admin' : 'tech',
  };
  // No campusId for default Google admins or new self-registered techs (they need to be assigned)
  
  await setDoc(doc(db, 'users', uid), profile);
  return profile;
}

export async function inviteUser(email: string | null, role: 'admin' | 'tech', campusId?: string, displayName?: string): Promise<void> {
  const emailLower = email?.toLowerCase().trim() || null;
  
  // For admins, we use email as ID. For techs without email, we use auto-id or name-based
  let docId = emailLower;
  if (!docId) {
    // Generate an ID if no email provided (for techs)
    // We'll use a random slug based on name if possible
    const nameSlug = displayName?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'tech';
    docId = `${nameSlug}-${Math.random().toString(36).substring(2, 7)}`;
  }

  const profile: any = {
    id: docId,
    uid: null,
    email: emailLower,
    role,
  };
  if (displayName) profile.displayName = displayName;
  if (role === 'tech' && campusId) {
    profile.campusId = campusId;
  }
  await setDoc(doc(db, 'users', docId), profile);
}

export async function updateUserProfile(docId: string, updates: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, 'users', docId), updates);
}

export async function deleteUser(docId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', docId));
}

export function subscribeToAllUsers(callback: (users: UserProfile[]) => void) {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as UserProfile));
    callback(users);
  });
}
