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
  loginWithTech: (profile: UserProfile) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  techCampusId: null,
  loginWithTech: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loginWithTech = async (techProfile: UserProfile) => {
    try {
      setLoading(true);
      const { loginAnonymously } = await import('../firebase');
      // Store the tech's email temporarily for the sync logic
      sessionStorage.setItem('pendingTechProfile', JSON.stringify(techProfile));
      await loginAnonymously();
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

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

        // Check if this is a "Quick Access" session for a technician
        const pendingTechStr = sessionStorage.getItem('pendingTechProfile');
        if (pendingTechStr && firebaseUser.isAnonymous) {
          const techData = JSON.parse(pendingTechStr) as UserProfile;
          // For anonymous tech sessions, we use the invited profile directly
          setProfile({
            ...techData,
            uid: firebaseUser.uid 
          });
          setLoading(false);
          sessionStorage.removeItem('pendingTechProfile');
          return;
        }

        // Set up real-time listener for profile
        const profileRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(profileRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
            setLoading(false);
          } else {
            try {
              // Automatically try to create a profile for authorized Google users
              const newProfile = await createUserProfile(
                firebaseUser.uid, 
                firebaseUser.email
              );
              
              setProfile(newProfile);
            } catch (err) {
              console.error("Error creating profile:", err);
            } finally {
              setLoading(false);
            }
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
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, techCampusId, loginWithTech }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
