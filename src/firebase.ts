import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Auth helper
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Type for our user profile
export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'tech';
  campusId?: string; // Techs are restricted to a campus
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) {
    return userDoc.data() as UserProfile;
  }
  return null;
}

export async function createUserProfile(uid: string, email: string): Promise<UserProfile> {
  // Check if there's a pre-authorized document with this email
  const guestDoc = await getDoc(doc(db, 'users', email.toLowerCase()));
  
  if (guestDoc.exists()) {
    const data = guestDoc.data() as UserProfile;
    // Move the data to the uid-based document
    const profile: UserProfile = {
      ...data,
      uid,
    };
    await setDoc(doc(db, 'users', uid), profile);
    // Delete the temporary email-based doc
    await deleteDoc(doc(db, 'users', email.toLowerCase()));
    return profile;
  }

  // Check if this is a default admin
  const adminEmails = ['cesarchaanine3@gmail.com', 'reportilt@gmail.com'];
  const isAdmin = adminEmails.includes(email.toLowerCase());
  
  const profile: UserProfile = {
    uid,
    email: email.toLowerCase(),
    role: isAdmin ? 'admin' : 'tech',
  };
  
  await setDoc(doc(db, 'users', uid), profile);
  return profile;
}

export async function inviteUser(email: string, role: 'admin' | 'tech', campusId?: string): Promise<void> {
  await setDoc(doc(db, 'users', email.toLowerCase()), {
    uid: null, // Placeholder since we don't know it yet
    email: email.toLowerCase(),
    role,
    campusId: role === 'tech' ? campusId : undefined,
  });
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), updates);
}

export function subscribeToAllUsers(callback: (users: UserProfile[]) => void) {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = snapshot.docs.map(doc => doc.data() as UserProfile);
    callback(users);
  });
}
