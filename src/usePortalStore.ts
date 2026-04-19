import { useState, useEffect, useMemo } from 'react';
import { Student, LoanRecord, CAMPUSES } from './types';
import { db, auth } from './firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error details:', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

export function usePortalStore() {
  const [currentCampusId, setCurrentCampusId] = useState<string>(() => {
    return localStorage.getItem('iltexas_current_campus') || CAMPUSES[0].id;
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Track auth state to avoid premature listeners
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(!!user);
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Persistence of current campus selection
  useEffect(() => {
    localStorage.setItem('iltexas_current_campus', currentCampusId);
  }, [currentCampusId]);

  // Sync Students for current campus
  useEffect(() => {
    if (!authReady) return;
    setError(null);
    setLoading(true);

    const q = query(
      collection(db, 'students'),
      where('campusId', '==', currentCampusId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData = snapshot.docs.map(doc => doc.data() as Student);
      setStudents(studentData);
      setLoading(false);
    }, (err) => {
      console.error("Student sync error:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentCampusId, authReady]);

  // Sync Loans for current campus
  useEffect(() => {
    if (!authReady) return;

    const q = query(
      collection(db, 'loans'),
      where('campusId', '==', currentCampusId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loanData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id // Use Firestore doc ID
      } as LoanRecord));
      
      // Sort in descending order of checkoutDate
      loanData.sort((a, b) => new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime());
      
      setLoans(loanData);
    }, (err) => {
      console.error("Loan sync error:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentCampusId, authReady]);

  const addStudents = async (newStudents: Student[]) => {
    try {
      // Large imports can exceed the 500 document limit for batches.
      // We chunk the list into batches of 400.
      const CHUNK_SIZE = 400;
      for (let i = 0; i < newStudents.length; i += CHUNK_SIZE) {
        const chunk = newStudents.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(s => {
          const studentRef = doc(db, 'students', s.id);
          batch.set(studentRef, s);
        });
        
        await batch.commit();
      }
      console.log(`Successfully imported ${newStudents.length} students across chunks`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students');
    }
  };

  const addLoan = async (loan: Omit<LoanRecord, 'id' | 'checkoutDate' | 'status'>) => {
    try {
      const loanData = {
        ...loan,
        checkoutDate: new Date().toISOString(),
        status: 'active' as const,
      };
      
      await addDoc(collection(db, 'loans'), loanData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loans');
    }
  };

  const returnLoan = async (loanId: string) => {
    try {
      const loanRef = doc(db, 'loans', loanId);
      await updateDoc(loanRef, {
        status: 'returned',
        returnDate: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'loans');
    }
  };

  const returnAllDailyChargers = async () => {
    try {
      const activeChargers = loans.filter(l => 
        l.type === 'charger' && 
        l.status === 'active'
      );
      
      if (activeChargers.length === 0) return;

      const batch = writeBatch(db);
      const returnDate = new Date().toISOString();
      
      activeChargers.forEach(l => {
        const loanRef = doc(db, 'loans', l.id);
        batch.update(loanRef, {
          status: 'returned',
          returnDate: returnDate
        });
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'loans');
    }
  };

  const purgeDatabase = async () => {
    try {
      const batch = writeBatch(db);
      
      // Clear students
      students.forEach(s => {
        const studentRef = doc(db, 'students', s.id);
        batch.delete(studentRef);
      });

      // Clear loans
      loans.forEach(l => {
        const loanRef = doc(db, 'loans', l.id);
        batch.delete(loanRef);
      });

      await batch.commit();
      console.log('Database purged successfully for current campus');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'all_data');
    }
  };

  const currentCampusStudents = students; // Already filtered by query
  const currentCampusLoans = loans; // Already filtered by query

  return {
    currentCampusId,
    setCurrentCampusId,
    students,
    currentCampusStudents,
    loans,
    currentCampusLoans,
    loading,
    error,
    addStudents,
    addLoan,
    returnLoan,
    returnAllDailyChargers,
    purgeDatabase,
  };
}
