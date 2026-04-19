import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, createUserProfile, UserProfile } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  techCampusId: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  techCampusId: null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        setLoading(true);
        // Set up real-time listener for profile
        const profileRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(profileRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
            setLoading(false);
          } else {
            // Document doesn't exist yet, check if there's an invite by email
            const newProfile = await createUserProfile(firebaseUser.uid, firebaseUser.email || '');
            setProfile(newProfile);
            setLoading(false);
          }
        }, (error) => {
          console.error("Error listening to profile:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const isAdmin = profile?.role === 'admin';
  const techCampusId = profile?.campusId || null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, techCampusId }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
