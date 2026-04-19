/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useRef, useEffect, type ChangeEvent, type ComponentProps } from 'react';
import { 
  Laptop, 
  Battery, 
  Upload, 
  BarChart3, 
  User, 
  Scan, 
  FileText, 
  ChevronDown, 
  CheckCircle2, 
  History,
  Search,
  Users,
  LogOut,
  ShieldCheck,
  Mail,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { CAMPUSES, LOAN_REASONS, Student } from './types';
import { usePortalStore } from './usePortalStore';
import { useAuth } from './context/AuthContext';
import { loginWithGoogle, logout, db, subscribeToAllUsers, updateUserProfile, UserProfile, inviteUser, deleteUser } from './firebase';
import { doc, getDocFromServer } from 'firebase/firestore';
import React from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const { 
    currentCampusId, 
    setCurrentCampusId, 
    currentCampusStudents, 
    currentCampusLoans, 
    loading: storeLoading,
    error: storeError,
    addStudents,
    addLoan,
    returnLoan,
    returnAllDailyChargers,
    purgeDatabase
  } = usePortalStore();


  const { user, profile, loading: authLoading, isAdmin, techCampusId, loginWithTech } = useAuth();

  const [loginCampusId, setLoginCampusId] = useState('');
  const [loginTechProfile, setLoginTechProfile] = useState<UserProfile | null>(null);
  const [showTechLogin, setShowTechLogin] = useState(false);
  const [techProfiles, setTechProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    // If they want to see the tech login and aren't signed in, sign in anonymously to fetch tech names
    if (!user && !authLoading && showTechLogin) {
      const initAnon = async () => {
        try {
          const { loginAnonymously } = await import('./firebase');
          await loginAnonymously();
        } catch (err) {
          console.error("Anon sign-in failed for tech list pre-fetch:", err);
        }
      };
      initAnon();
    }
  }, [user, authLoading, showTechLogin]);

  useEffect(() => {
    // If we are signed in (even anonymously) buy don't have a profile yet (meaning we are on login screen)
    // fetch only the tech names.
    if (user && !profile && showTechLogin) {
      const unsubscribe = subscribeToAllUsers((users) => {
        const techs = users.filter(u => u.role === 'tech' && u.displayName);
        setTechProfiles(techs);
      });
      return () => unsubscribe();
    }
  }, [user, profile, showTechLogin]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setEntryError('');
    try {
      await loginWithGoogle();
    } catch (error: any) {
      console.error("Login detail error:", error);
      setEntryError(`Connection failed: ${error.code || 'Unknown error'}`);
      setIsLoggingIn(false);
    }
  };

  const handleTechLogin = async () => {
    if (!loginTechProfile) return;
    setIsLoggingIn(true);
    setEntryError('');
    try {
      await loginWithTech(loginTechProfile);
    } catch (error: any) {
      console.error("Tech login error:", error);
      setEntryError(`Access failed: ${error.message || 'Unknown error'}`);
      setIsLoggingIn(false);
    }
  };

  // Test connection on boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'system', 'health'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firestore Connection: The client appears to be offline or configured incorrectly.");
        }
      }
    }
    testConnection();
  }, []);

  const [activeTab, setActiveTab] = useState('checkout');
  const [assetTag, setAssetTag] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedReason, setSelectedReason] = useState(LOAN_REASONS[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastImportCount, setLastImportCount] = useState(0);
  const [studentSearch, setStudentSearch] = useState('');
  const [entryError, setEntryError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loadNotification, setLoadNotification] = useState('');
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'tech'>('tech');
  const [inviteCampusId, setInviteCampusId] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [anonChargerNum, setAnonChargerNum] = useState('');
  const [showAnonChargerDialog, setShowAnonChargerDialog] = useState(false);
  const [anonChromebookNum, setAnonChromebookNum] = useState('');
  const [showAnonChromebookDialog, setShowAnonChromebookDialog] = useState(false);
  const [bulkChargeCount, setBulkChargeCount] = useState('1');
  const [chargerResetTime, setChargerResetTime] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('iltexas_charger_reset');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartIso = todayStart.toISOString();
      
      if (saved) {
        const savedDate = new Date(saved).toDateString();
        const currentDate = new Date().toDateString();
        if (savedDate !== currentDate) {
          localStorage.setItem('iltexas_charger_reset', todayStartIso);
          return todayStartIso;
        }
        return saved;
      }
      return todayStartIso;
    } catch (e) {
      return new Date().toISOString();
    }
  });

  const [chromebookResetTime, setChromebookResetTime] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('iltexas_chromebook_reset');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartIso = todayStart.toISOString();
      
      if (saved) {
        const savedDate = new Date(saved).toDateString();
        const currentDate = new Date().toDateString();
        if (savedDate !== currentDate) {
          localStorage.setItem('iltexas_chromebook_reset', todayStartIso);
          return todayStartIso;
        }
        return saved;
      }
      return todayStartIso;
    } catch (e) {
      return new Date().toISOString();
    }
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const studentInputRef = useRef<HTMLInputElement>(null);
  const quickCBInputRef = useRef<HTMLInputElement>(null);

  const selectedStudent = useMemo(() => 
    currentCampusStudents.find(s => s.id === selectedStudentId),
    [currentCampusStudents, selectedStudentId]
  );

  const stats = useMemo(() => {
    const active = currentCampusLoans.filter(l => l.status === 'active');
    const chromebooksOut = active.filter(l => l.type === 'chromebook').length;
    
    // Sessions Handouts logic
    let chargersSession = 0;
    let chromebooksSession = 0;
    
    try {
      const chargerResetTs = new Date(chargerResetTime).getTime();
      const cbResetTs = new Date(chromebookResetTime).getTime();
      
      currentCampusLoans.forEach(l => {
        if (l.status !== 'active' || !l.checkoutDate) return;
        const checkoutTs = new Date(l.checkoutDate).getTime();
        if (isNaN(checkoutTs)) return;
        
        if (l.type === 'charger' && checkoutTs >= chargerResetTs) {
          chargersSession++;
        }
        if (l.type === 'chromebook' && checkoutTs >= cbResetTs) {
          chromebooksSession++;
        }
      });
    } catch (e) {
      console.error("Stats calculation error:", e);
    }
    
    const reasons = active.reduce((acc, curr) => {
      if (curr.reason) {
        acc[curr.reason] = (acc[curr.reason] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return { 
      chromebooks: chromebooksOut, 
      chromebooksSession, 
      chargers: chargersSession, 
      reasons 
    };
  }, [currentCampusLoans, chargerResetTime, chromebookResetTime]);

  // Sync across tabs and handle midnight reset
  useEffect(() => {
    const checkReset = () => {
      // Charger sync
      const savedCharger = localStorage.getItem('iltexas_charger_reset');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      if (savedCharger) {
        const savedDate = new Date(savedCharger).toDateString();
        const currentDate = new Date().toDateString();
        if (savedDate !== currentDate) {
          setChargerResetTime(todayIso);
          localStorage.setItem('iltexas_charger_reset', todayIso);
        } else if (savedCharger !== chargerResetTime) {
          setChargerResetTime(savedCharger);
        }
      }

      // Chromebook sync
      const savedCB = localStorage.getItem('iltexas_chromebook_reset');
      if (savedCB) {
        const savedDate = new Date(savedCB).toDateString();
        const currentDate = new Date().toDateString();
        if (savedDate !== currentDate) {
          setChromebookResetTime(todayIso);
          localStorage.setItem('iltexas_chromebook_reset', todayIso);
        } else if (savedCB !== chromebookResetTime) {
          setChromebookResetTime(savedCB);
        }
      }
    };

    window.addEventListener('storage', checkReset);
    const interval = setInterval(checkReset, 30000); // Check every 30s
    
    return () => {
      window.removeEventListener('storage', checkReset);
      clearInterval(interval);
    };
  }, [chargerResetTime]);

  useEffect(() => {
    // If studentSearch matches exactly one student ID, select them automatically
    // This handles barcode scans or typing exact ID
    const exactMatch = currentCampusStudents.find(s => 
      s.id.toLowerCase() === studentSearch.toLowerCase()
    );
    if (exactMatch && exactMatch.id !== selectedStudentId) {
      setSelectedStudentId(exactMatch.id);
    }
  }, [studentSearch, currentCampusStudents, selectedStudentId]);

  useEffect(() => {
    // When a student is selected, Move focus to Asset Tag for the scanner
    if (selectedStudentId && assetInputRef.current) {
      assetInputRef.current.focus();
    }
  }, [selectedStudentId]);

  useEffect(() => {
    // Show a transient notification when campus changes or students are updated
    if (currentCampusStudents.length > 0) {
      setLoadNotification(`Campus Database: ${currentCampusStudents.length} Students Found`);
      const timer = setTimeout(() => setLoadNotification(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [currentCampusId]);

  useEffect(() => {
    // If tech is restricted to a campus, force it
    if (techCampusId && currentCampusId !== techCampusId) {
      setCurrentCampusId(techCampusId);
    }
  }, [techCampusId, currentCampusId, setCurrentCampusId]);

  useEffect(() => {
    // Subscribe to all users if admin
    if (isAdmin && user) {
      const unsubscribe = subscribeToAllUsers(setAllUsers);
      return () => unsubscribe();
    } else {
      setAllUsers([]);
    }
  }, [isAdmin, user]);

  const handleUpdateUserRole = async (docId: string, newRole: 'admin' | 'tech') => {
    try {
      await updateUserProfile(docId, { role: newRole });
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const handleUpdateUserCampus = async (docId: string, newCampusId: string) => {
    try {
      await updateUserProfile(docId, { campusId: newCampusId });
    } catch (error) {
      console.error("Error updating campus:", error);
    }
  };

  const handleDeleteUser = async (docId: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    try {
      await deleteUser(docId);
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const handleInviteUser = async () => {
    if (inviteRole === 'admin' && !inviteEmail) return;
    if (inviteRole === 'tech' && !inviteName) return;
    
    setInviteStatus('idle');
    setInviteError(null);

    try {
      await inviteUser(inviteEmail || null, inviteRole, inviteRole === 'tech' ? inviteCampusId : undefined, inviteName || undefined);
      setInviteStatus('success');
      setInviteEmail('');
      setInviteName('');
      setInviteCampusId('');
      setTimeout(() => setInviteStatus('idle'), 3000);
    } catch (error: any) {
      console.error("Error inviting user:", error);
      setInviteStatus('error');
      setInviteError(error.message || "Failed to invite user");
    }
  };

  const handleCheckout = () => {
    if (!selectedStudent) return;
    
    addLoan({
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      assetTag: assetTag || undefined,
      type: 'chromebook',
      reason: selectedReason,
      campusId: currentCampusId,
      returnDate: null,
    });

    setAssetTag('');
    setSelectedStudentId('');
    setStudentSearch('');
    setSelectedReason(LOAN_REASONS[0]);
    
    // Reset focus to student search for next scan
    if (studentInputRef.current) {
      studentInputRef.current.focus();
    }
  };

  const handleChargerIssue = () => {
    if (!selectedStudent) return;
    
    addLoan({
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      type: 'charger',
      campusId: currentCampusId,
      returnDate: null,
    });
    
    setSelectedStudentId('');
    setStudentSearch('');

    // Reset focus for next scan
    if (studentInputRef.current) {
      studentInputRef.current.focus();
    }
  };

  const handleAnonymousChargerIssue = () => {
    if (!anonChargerNum) return;
    
    addLoan({
      studentId: 'WALK-IN',
      studentName: 'Daily Usage (Untracked)',
      type: 'charger',
      assetTag: anonChargerNum,
      campusId: currentCampusId,
      reason: 'Daily Handout',
      returnDate: null,
    });
    
    setAnonChargerNum('');
    setShowAnonChargerDialog(false);
  };

  const handleAnonymousChromebookIssue = () => {
    if (!anonChromebookNum) return;
    
    // Create a copy of the number for the notification
    const issuedTag = anonChromebookNum;

    addLoan({
      studentId: 'WALK-IN',
      studentName: 'Daily Usage (Untracked)',
      type: 'chromebook',
      assetTag: issuedTag, // Saves exactly what was entered (e.g. "2" or "LTX...")
      campusId: currentCampusId,
      reason: 'Quick Handout',
      returnDate: null,
    });
    
    setAnonChromebookNum('');
    setShowAnonChromebookDialog(false);

    // Refocus for next scan
    setTimeout(() => {
      quickCBInputRef.current?.focus();
    }, 10);

    setLoadNotification(`CB ${issuedTag} Handed Out (+1 Counted)`);
    setTimeout(() => setLoadNotification(''), 3000);
  };

  const handleQuickTally = (count: number = 1) => {
    for (let i = 0; i < count; i++) {
      addLoan({
        studentId: 'TALLY-ONLY',
        studentName: 'Quick Handout (No Info)',
        type: 'charger',
        campusId: currentCampusId,
        reason: 'Bulk Tally',
        returnDate: null,
      });
    }
    setBulkChargeCount('1');
  };

  const resetChargerCounter = () => {
    const now = new Date().toISOString();
    setChargerResetTime(now);
    localStorage.setItem('iltexas_charger_reset', now);
  };

  const resetChromebookCounter = () => {
    const now = new Date().toISOString();
    setChromebookResetTime(now);
    localStorage.setItem('iltexas_chromebook_reset', now);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear value immediately so the same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';

    console.log('File selected:', file.name);
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    
    // Use a small timeout to let the UI update before heavy processing
    setTimeout(() => {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = event.target?.result;
            if (!data) {
              setIsUploading(false);
              setUploadError('Failed to read file contents.');
              return;
            }
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Find the best sheet (the one with the most recognizable student rows)
            let bestSheetName = workbook.SheetNames[0];
            let maxStudents = 0;
            let bestRows: any[] = [];

            workbook.SheetNames.forEach(name => {
              const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[name]) as any[];
              const validCount = sheetRows.filter(row => {
                const id = findValue(row, ['ID', 'Student ID', 'Local ID', 'External ID', 'id', 'School Id #']);
                const nameVal = findValue(row, ['Name', 'Student Name', 'Full Name', 'Student', 'name']);
                return id !== undefined && id !== null && id !== '' && nameVal;
              }).length;
              
              if (validCount > maxStudents) {
                maxStudents = validCount;
                bestSheetName = name;
                bestRows = sheetRows;
              }
            });

            console.log(`Auto-selected sheet "${bestSheetName}" with ${maxStudents} students.`);
            processRows(bestRows.length > 0 ? bestRows : XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]));
          } catch (err) {
            console.error('XLSX Error:', err);
            setIsUploading(false);
            setUploadError('Error reading Excel file: ' + (err instanceof Error ? err.message : String(err)));
          }
        };
        reader.onerror = () => {
          setIsUploading(false);
          setUploadError('Failed to read file.');
        };
        reader.readAsArrayBuffer(file);
      } else {
        // CSV handling
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors && results.errors.length > 0) {
              console.error('PapaParse errors:', results.errors);
              setIsUploading(false);
              setUploadError('Error parsing CSV: ' + results.errors[0].message);
              return;
            }
            processRows(results.data as any[]);
          },
          error: (error) => {
            console.error('PapaParse error:', error);
            setIsUploading(false);
            setUploadError('Failed to parse CSV: ' + error.message);
          }
        });
      }
    }, 100);
  };

  const findValue = (row: any, keys: string[]) => {
    if (!row) return null;
    const rowKeys = Object.keys(row);
    const normalizedKeys = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    // First try exact matches
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    }
    
    // Then try normalized matches
    for (const normalizedKey of normalizedKeys) {
      const foundKey = rowKeys.find(rk => 
        rk.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey
      );
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        return row[foundKey];
      }
    }
    return null;
  };

  const processRows = (rawRows: any[]) => {
    if (!rawRows || rawRows.length === 0) {
      setIsUploading(false);
      setUploadError('The file appears to be empty.');
      return;
    }

    // HEURISTIC: Many school files have blank rows or titles at the top.
    // We search for the row that looks most like a header row.
    let rows = rawRows;
    let headerIndex = -1;
    
    // If the data was parsed as objects (XLSX default), we check if the first object
    // is actually student data. If it has headers like "School Profile" or "Report", 
    // it might be wrong.
    
    const newStudents: Student[] = rows
      .map(row => {
        // ID variations - extremely permissive and expanded
        let id = findValue(row, [
          'School Id #', 'School Id', 'ID', 'Student ID', 'ID Number', 'Local ID', 
          'External ID', 'Student Number', 'Identification', 'id', 'username',
          'Local Student ID', 'State Student ID', 'SIS ID', 'User Name', 'STU_ID',
          'Perm ID', 'Person ID', 'Alternate ID', 'Student_Id', 'LASID', 'SASID'
        ]);
        
        // Name variations - extremely permissive and expanded
        let name = findValue(row, [
          'Name', 'Student Name', 'Full Name', 'DisplayName', 'name', 
          'Student', 'StudentFull', 'Full_Name', 'Student_Name', 'STU_NAME',
          'Student_Full_Name', 'LastFirstName', 'Last, First'
        ]);
        
        // Handle split names (First Name / Last Name)
        if (!name) {
          const first = findValue(row, ['First Name', 'FirstName', 'Given Name', 'STU_FNAME', 'First_Name', 'Given_Name']);
          const last = findValue(row, ['Last Name', 'LastName', 'Surname', 'Family Name', 'STU_LNAME', 'Last_Name', 'Family_Name']);
          if (first && last) {
            name = `${String(first).trim()} ${String(last).trim()}`;
          } else if (first || last) {
            name = String(first || last).trim();
          }
        }

        if (id === undefined || id === null || id === '' || !name) return null;

        return {
          id: String(id).trim(),
          name: String(name).trim(),
          grade: String(findValue(row, ['Grade', 'Grade Level', 'Level', 'Year', 'grade', 'STU_GRADE', 'Grade_Level']) || '').trim(),
          email: String(findValue(row, ['Email', 'Email Address', 'Mail', 'email', 'STU_EMAIL', 'School_Email']) || '').trim(),
          location: String(findValue(row, ['Location', 'Room', 'Classroom', 'Homeroom', 'location', 'Homeroom/Advisor', 'Room_Number']) || '').trim(),
          campusId: currentCampusId,
        };
      })
      .filter((s): s is Student => s !== null && s.id.length > 0);
    
    if (newStudents.length === 0) {
      setIsUploading(false);
      const headers = Object.keys(rows[0]).join(', ');
      setUploadError(`Could not find students. I found these columns: [${headers}]. Please ensure you have columns for Student Name and ID.`);
      return;
    }

    addStudents(newStudents);
    setIsUploading(false);
    setUploadSuccess(true);
    setLastImportCount(newStudents.length);
    setUploadError(null);
    setTimeout(() => {
      setUploadSuccess(false);
      setLastImportCount(0);
    }, 60000); // Changed to 1 minute as requested
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportReport = () => {
    const start = new Date(reportStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(reportEndDate);
    end.setHours(23, 59, 59, 999);

    const filteredLoans = currentCampusLoans.filter(l => {
      const checkoutDate = new Date(l.checkoutDate);
      return checkoutDate >= start && checkoutDate <= end;
    });

    if (filteredLoans.length === 0) {
      alert('No records found for the selected date range.');
      return;
    }

    const data = filteredLoans.map(l => ({
      'Student ID': l.studentId === 'WALK-IN' ? 'N/A' : l.studentId,
      'Student Name': l.studentId === 'WALK-IN' ? 'Walk-in / Daily' : l.studentName,
      'Item Type': l.type,
      'Charger # / Asset Tag': l.assetTag || 'N/A',
      'Reason': l.reason || 'N/A',
      'Status': l.status,
      'Checkout Time': new Date(l.checkoutDate).toLocaleString(),
      'Return Time': l.returnDate ? new Date(l.returnDate).toLocaleString() : 'Pending'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans');
    XLSX.writeFile(workbook, `Loaner_Report_${currentCampusId}_${reportStartDate}_to_${reportEndDate}.xlsx`);
  };

  const todayActivity = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return currentCampusLoans.filter(l => {
      const date = new Date(l.checkoutDate);
      return date >= today && l.status === 'active';
    }).slice(0, 20);
  }, [currentCampusLoans]);

  if (authLoading || (user && storeLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg space-y-6">
        {storeError ? (
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-red-100 flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight mb-2">Access Restricted</h2>
              <p className="text-sm text-text-sub leading-relaxed">
                You are currently logged in with <span className="font-bold text-slate-900">{user?.email}</span>, which does not have authorized access to this campus data.
              </p>
            </div>
            <Button 
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all"
              onClick={logout}
            >
              Sign Out & Try Again
            </Button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-brand-maroon font-bold animate-pulse uppercase tracking-widest text-sm">Initializing Portal...</p>
            <Button variant="ghost" className="text-xs text-text-sub hover:text-brand-maroon uppercase tracking-widest font-bold mt-8" onClick={logout}>
              Cancel & Sign Out
            </Button>
          </>
        )}
      </div>
    );
  }

  if (!user || (!profile && !user.isAnonymous)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border border-slate-100 flex flex-col items-center text-center space-y-6">
          <div className="bg-white p-4 rounded-full shadow-lg border-2 border-brand-gold/30">
            <img 
              src="https://www.iltexas.org/cms/lib/TX02217083/Centricity/Domain/1/ILTexas%20Seal.png" 
              alt="ILTexas Seal" 
              className="w-24 h-24 object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', '<svg class="text-brand-maroon w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>');
              }}
            />
          </div>
          <div>
            <h1 className="text-3xl font-black text-brand-maroon uppercase tracking-tight mb-2">ILTexas Portal</h1>
            <p className="text-text-sub font-medium text-sm">Choose your access method below</p>
          </div>
          
          <div className="w-full space-y-4">
            {!showTechLogin ? (
              <>
                <Button 
                  onClick={handleGoogleLogin}
                  className="w-full h-16 bg-brand-maroon hover:bg-slate-900 text-white font-bold text-lg rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/split-screen/google.svg" className="w-6 h-6 bg-white rounded-full p-1" referrerPolicy="no-referrer" />
                      Staff Google Login
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="ghost"
                  onClick={() => setShowTechLogin(true)}
                  className="w-full h-12 text-slate-400 hover:text-brand-maroon font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Campus Technician Access
                </Button>
              </>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pt-2"
              >
                <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Select Campus</label>
                    <select 
                      className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-gold font-medium text-sm"
                      value={loginCampusId}
                      onChange={(e) => {
                        setLoginCampusId(e.target.value);
                        setLoginTechProfile(null);
                      }}
                    >
                      <option value="">Select Campus...</option>
                      {CAMPUSES.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Your Name</label>
                    <select 
                      className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-gold font-medium text-sm"
                      disabled={!loginCampusId}
                      value={loginTechProfile?.id || ''}
                      onChange={(e) => {
                        const tech = techProfiles.find(t => t.id === e.target.value);
                        setLoginTechProfile(tech || null);
                      }}
                    >
                      <option value="">Choose your name...</option>
                      {techProfiles
                        .filter(t => t.campusId === loginCampusId)
                        .map(t => (
                        <option key={t.id} value={t.id}>{t.displayName}</option>
                      ))}
                    </select>
                  </div>

                  <Button 
                    onClick={handleTechLogin}
                    disabled={!loginTechProfile || isLoggingIn}
                    className="w-full h-14 bg-brand-maroon hover:bg-slate-900 text-white font-bold text-lg rounded-xl shadow-lg transition-all"
                  >
                    {isLoggingIn ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Access Portal"
                    )}
                  </Button>
                </div>

                <Button 
                  variant="ghost"
                  onClick={() => setShowTechLogin(false)}
                  className="w-full text-slate-400 hover:text-brand-maroon font-bold text-[10px] uppercase tracking-widest"
                >
                  Back to Google Login
                </Button>
              </motion.div>
            )}
            
            {entryError && (
              <p className="text-xs text-red-500 font-bold flex items-center justify-center gap-1 mt-2">
                <AlertCircle className="w-3 h-3" /> {entryError}
              </p>
            )}
          </div>
          
          <p className="text-[10px] text-text-sub uppercase font-bold text-center tracking-widest opacity-40">Restricted Access • Campus Technology Only</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">
      <header className="h-18 bg-brand-maroon flex items-center justify-between px-8 shadow-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-full shadow-inner overflow-hidden flex items-center justify-center w-12 h-12 border-2 border-brand-gold/30">
              <img 
                src="https://www.iltexas.org/cms/lib/TX02217083/Centricity/Domain/1/ILTexas%20Seal.png" 
                alt="ILTexas Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', '<svg class="text-brand-maroon w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>');
                }}
              />
            </div>
            <h1 className="text-white font-bold text-xl tracking-tight uppercase">ILTexas Loaner Portal</h1>
          </div>
          
          {profile && (
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-white/70 text-[11px] font-bold uppercase tracking-wider">
                {profile.role}: {profile.displayName || user.displayName}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <AnimatePresence>
            {loadNotification && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-brand-gold/20 border border-brand-gold/30 rounded-full px-4 py-1.5 flex items-center gap-2"
              >
                <Users className="w-3.5 h-3.5 text-brand-gold" />
                <span className="text-[11px] font-bold text-brand-gold uppercase tracking-wider">{loadNotification}</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          {isAdmin ? (
            <select 
              value={currentCampusId} 
              onChange={(e) => setCurrentCampusId(e.target.value)}
              className="w-[300px] h-10 bg-white/10 border border-white/20 text-white rounded-md px-3 outline-none hover:bg-white/20 transition-all cursor-pointer"
            >
              {CAMPUSES.map(campus => (
                <option key={campus.id} value={campus.id} className="text-black">
                  {campus.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="bg-white/10 border border-white/20 text-white rounded-md px-4 h-10 flex items-center font-bold text-sm uppercase">
              Campus: {CAMPUSES.find(c => c.id === currentCampusId)?.name}
            </div>
          )}

          {isAdmin && (
            <Dialog>
              <DialogTrigger
                render={
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white/50 hover:text-white hover:bg-white/10 h-10 px-3 gap-2"
                  />
                }
              >
                <Users className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase">Team</span>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-white">
                <DialogHeader>
                  <DialogTitle className="text-brand-maroon font-bold">Team Management</DialogTitle>
                  <DialogDescription>
                    Manage technician access, promote new administrators, or invite staff by email.
                  </DialogDescription>
                </DialogHeader>

                {/* Add Member Form */}
                <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-text-sub uppercase tracking-wider">Add Team Member</p>
                    {inviteStatus === 'success' && (
                      <span className="text-[10px] text-green-600 font-bold flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                        <CheckCircle2 className="w-3 h-3" /> Member Invited!
                      </span>
                    )}
                    {inviteStatus === 'error' && (
                      <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {inviteError}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 space-y-1">
                      <label htmlFor="invite-name" className="text-[9px] font-bold text-slate-400 uppercase ml-1">
                        {inviteRole === 'tech' ? 'Technician Name' : 'Full Name'}
                      </label>
                      <Input 
                        id="invite-name"
                        placeholder={inviteRole === 'tech' ? "e.g. John Doe" : "Full Name"}
                        className={cn(
                          "h-10 text-xs bg-white border-slate-200 focus:border-brand-gold"
                        )}
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {inviteRole === 'admin' && (
                      <div className="flex-1 space-y-1">
                        <label htmlFor="invite-email" className="text-[9px] font-bold text-slate-400 uppercase ml-1">Email Address</label>
                        <Input 
                          id="invite-email"
                          placeholder="john@ilt.org" 
                          className={cn(
                            "h-10 text-xs bg-white border-slate-200 focus:border-brand-gold",
                            inviteStatus === 'error' && "border-red-300"
                          )}
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="w-full md:w-[150px] space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Assign Role</label>
                      <select 
                        className="w-full h-10 px-3 text-xs border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-brand-gold"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'admin' | 'tech')}
                      >
                        <option value="tech">Technician (Team)</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                    {inviteRole === 'tech' && (
                      <div className="w-full md:w-[150px] space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Campus</label>
                        <select 
                          className="w-full h-10 px-3 text-xs border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-brand-gold"
                          value={inviteCampusId}
                          onChange={(e) => setInviteCampusId(e.target.value)}
                        >
                          <option value="">Select...</option>
                          {CAMPUSES.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-end">
                      <Button 
                        className={cn(
                          "h-10 text-white font-bold text-xs px-6 transition-all",
                          inviteStatus === 'success' ? "bg-green-600" : "bg-brand-maroon hover:bg-slate-800"
                        )}
                        onClick={handleInviteUser}
                        disabled={(inviteRole === 'admin' && !inviteEmail) || (inviteRole === 'tech' && (!inviteName || !inviteCampusId))}
                      >
                        {inviteStatus === 'success' ? "Invited!" : "Add Member"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Member</TableHead>
                        <TableHead className="text-xs font-mono"></TableHead>
                        <TableHead className="text-xs">Role</TableHead>
                        <TableHead className="text-xs">Assigned Campus</TableHead>
                        <TableHead className="text-right text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allUsers.map((u) => (
                        <TableRow key={u.id} className="hover:bg-slate-50">
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-[11px] text-brand-maroon">{u.displayName || 'Unnamed User'}</span>
                              <span className="text-[9px] text-slate-400">{u.email || 'Quick Access Only'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            {u.uid === user.uid && <span className="text-[9px] bg-brand-gold/20 text-brand-maroon px-1.5 py-0.5 rounded font-bold uppercase transition-all duration-300">You</span>}
                            {!u.uid && <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase italic">Pending</span>}
                          </TableCell>
                          <TableCell className="py-3">
                            {u.uid === user.uid ? (
                              <Badge variant="default" className="bg-brand-maroon text-white capitalize text-[9px] px-2 py-0">
                                {u.role}
                              </Badge>
                            ) : (
                              <select 
                                className="text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-white outline-none focus:ring-1 focus:ring-brand-gold font-bold"
                                value={u.role}
                                onChange={(e) => handleUpdateUserRole(u.id, e.target.value as 'admin' | 'tech')}
                              >
                                <option value="tech">Technician</option>
                                <option value="admin">Admin</option>
                              </select>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-[11px]">
                            {u.role === 'admin' ? (
                              <span className="text-slate-400 italic">Global Access</span>
                            ) : (
                              <select 
                                className="text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-white outline-none focus:ring-1 focus:ring-brand-gold"
                                value={u.campusId || ''}
                                onChange={(e) => handleUpdateUserCampus(u.id, e.target.value)}
                              >
                                <option value="">Unassigned</option>
                                {CAMPUSES.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            {u.uid !== user.uid ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteUser(u.id)}
                                className="h-7 w-7 p-0 text-slate-300 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <span className="text-[10px] text-slate-300">Self</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {allUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-text-sub text-xs italic">
                            Waiting for team data...
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={logout}
            className="text-white/50 hover:text-white hover:bg-white/10 h-10 px-3 gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Logout</span>
          </Button>
        </div>
      </header>

      <main className="bento-grid">
        {/* Chromebook Checkout Card */}
        <section className="bento-card grid-checkout">
          <div className="card-title justify-between">
            <div className="flex items-center gap-2">
              <Scan className="w-4 h-4" />
              Chromebook Checkout
            </div>
            
            <div className="flex items-center gap-3">
               <div className="flex flex-col items-end">
                <motion.span 
                  key={stats.chromebooksSession}
                  initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                  className="text-lg font-black text-brand-maroon leading-none"
                >
                  {stats.chromebooksSession}
                </motion.span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Session Handouts</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-6 flex-1 flex flex-col">
            <div className="space-y-4">
              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-text-main">Student Lookup (Name or ID)</label>
                <div className="relative group">
                  <Input 
                    placeholder="Search by ID or Name..." 
                    className={cn(
                      "h-12 pl-10 pr-10 border-border-subtle transition-all",
                      selectedStudent && "border-green-500 bg-green-50/30"
                    )}
                    value={studentSearch}
                    ref={studentInputRef}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      if (selectedStudentId) setSelectedStudentId('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !selectedStudentId) {
                        // If they hit enter/scan student ID
                        const match = currentCampusStudents.find(s => 
                          s.id.toLowerCase() === studentSearch.toLowerCase()
                        );
                        if (match) {
                          setSelectedStudentId(match.id);
                          setStudentSearch(match.name);
                        }
                      }
                    }}
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sub group-focus-within:text-brand-maroon" />
                  
                  {selectedStudent && (
                    <button 
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"
                      onClick={() => {
                        setStudentSearch('');
                        setSelectedStudentId('');
                      }}
                    >
                      <User className="w-4 h-4 text-green-600" />
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {studentSearch && !selectedStudent && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-border-subtle rounded-lg shadow-xl max-h-[300px] overflow-auto animate-in fade-in zoom-in duration-200">
                    {currentCampusStudents
                      .filter(s => 
                        s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                        s.id.toLowerCase().includes(studentSearch.toLowerCase())
                      )
                      .slice(0, 50) // Limit to 50 results
                      .map(student => (
                        <div 
                          key={student.id}
                          className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-border-subtle last:border-0"
                          onClick={() => {
                            setSelectedStudentId(student.id);
                            setStudentSearch(student.name);
                          }}
                        >
                          <div>
                            <p className="font-semibold text-brand-maroon">{student.name}</p>
                            <p className="text-xs text-text-sub">ID: {student.id} • Grade: {student.grade}</p>
                          </div>
                          <Users className="w-4 h-4 text-slate-300" />
                        </div>
                      ))}
                    {currentCampusStudents.length > 0 && 
                      currentCampusStudents.filter(s => 
                        s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                        s.id.toLowerCase().includes(studentSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="p-4 text-center text-sm text-text-sub">
                          No students found with "{studentSearch}"
                        </div>
                      )}
                    {currentCampusStudents.length === 0 && (
                      <div className="p-4 text-center text-sm text-text-sub">
                        Please upload a student roster first
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-main">Scan or Enter Asset Tag</label>
                <Input 
                  placeholder="LTX-2026-XXXXX" 
                  className="h-12 text-lg font-mono border-border-subtle"
                  value={assetTag}
                  ref={assetInputRef}
                  onChange={(e) => setAssetTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedStudentId && assetTag) {
                      handleCheckout();
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-main">Reason for Loaner</label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {LOAN_REASONS.map(reason => (
                    <button
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={cn(
                        "reason-btn",
                        selectedReason === reason && "reason-btn-active"
                      )}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-50">
              <Button 
                className="btn-primary w-full h-14 text-lg" 
                disabled={!selectedStudent}
                onClick={handleCheckout}
              >
                Confirm Checkout
              </Button>
            </div>
          </div>
        </section>

        {/* Student Detail Card */}
        <section className="bento-card grid-student">
          <div className="card-title">
            <User className="w-4 h-4" />
            Student Detail
          </div>
          <AnimatePresence mode="wait">
            {selectedStudent ? (
              <motion.div 
                key={selectedStudent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <div>
                  <p className="text-[12px] text-text-sub uppercase font-bold tracking-widest">Name</p>
                  <p className="text-lg font-bold text-brand-maroon">{selectedStudent.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-text-sub uppercase font-bold">ID</p>
                    <p className="font-semibold">{selectedStudent.id}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-sub uppercase font-bold">Grade</p>
                    <p className="font-semibold">{selectedStudent.grade}</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-4">
                <User className="text-slate-200 w-8 h-8 mb-2" />
                <p className="text-[10px] text-text-sub font-bold uppercase">No Student Selected</p>
              </div>
            )}
          </AnimatePresence>
        </section>

        {/* Charger Quick Card */}
        <section className="bento-card grid-charger">
          <div className="card-title justify-between">
            <div className="flex items-center gap-2">
              <Battery className="w-4 h-4 text-brand-gold fill-brand-gold/20" />
              Charger Loan
            </div>
            <Dialog>
              <DialogTrigger 
                render={
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold text-brand-gold hover:text-brand-gold hover:bg-brand-gold/10 px-2">
                    ACTIVE
                  </Button>
                }
              />
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Active Charger Loans</DialogTitle>
                  <DialogDescription>List of students who currently have a loaner charger.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[400px] mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Time Out</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentCampusLoans.filter(l => l.type === 'charger' && l.status === 'active').length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-400 italic">No active charger loans</TableCell>
                        </TableRow>
                      ) : (
                        currentCampusLoans.filter(l => l.type === 'charger' && l.status === 'active').map(loan => (
                          <TableRow key={loan.id}>
                            <TableCell className="font-bold text-sm">{loan.studentName}</TableCell>
                            <TableCell className="font-mono text-[10px]">{loan.studentId}</TableCell>
                            <TableCell className="text-[10px]">{new Date(loan.checkoutDate).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" className="text-brand-gold font-bold h-7" onClick={() => returnLoan(loan.id)}>Return</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
            <div className="flex flex-col items-center justify-center flex-1">
              <motion.div 
                key={stats.chargers}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-black text-brand-maroon mb-0"
              >
                {stats.chargers}
              </motion.div>
              <p className="text-[9px] text-text-sub font-bold uppercase tracking-widest mb-4">Session Handouts</p>
            
            <div className="w-full space-y-2">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col gap-2">
                <Button 
                  className="w-full h-9 bg-brand-maroon !text-white font-bold text-[10px]"
                  onClick={() => handleQuickTally(1)}
                >
                  +1 CHARGER
                </Button>
                <div className="flex gap-1">
                  <Input 
                    className="h-8 text-center text-[10px] w-12 bg-white" 
                    value={bulkChargeCount}
                    onChange={(e) => setBulkChargeCount(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Qty"
                  />
                  <Button 
                    variant="outline"
                    className="flex-1 h-8 border-brand-gold text-brand-gold font-bold text-[10px]"
                    onClick={() => handleQuickTally(parseInt(bulkChargeCount) || 1)}
                  >
                    ADD MULTIPLE
                  </Button>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full border-brand-maroon text-brand-maroon h-9 font-bold text-[10px]"
                disabled={!selectedStudent}
                onClick={handleChargerIssue}
              >
                Issue to Student
              </Button>
            </div>
          </div>
        </section>

        {/* NEW Separate Chromebook Quick Card */}
        <section className="bento-card grid-cb-quick">
          <div className="card-title justify-between">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-brand-maroon" />
              Quick CB Loan
            </div>
            <Dialog>
              <DialogTrigger 
                render={
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold text-slate-400 hover:text-brand-maroon hover:bg-slate-50 px-2">
                    ACTIVE
                  </Button>
                }
              />
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Active Quick Chromebook Loans</DialogTitle>
                  <DialogDescription>List of untracked chromebooks currently out.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[400px] mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset Tag</TableHead>
                        <TableHead>Time Out</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentCampusLoans.filter(l => l.type === 'chromebook' && l.status === 'active' && l.studentId === 'WALK-IN').length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-slate-400 italic">No untracked Chromebooks out</TableCell>
                        </TableRow>
                      ) : (
                        currentCampusLoans.filter(l => l.type === 'chromebook' && l.status === 'active' && l.studentId === 'WALK-IN').map(loan => (
                          <TableRow key={loan.id}>
                            <TableCell className="font-bold text-sm">{loan.assetTag}</TableCell>
                            <TableCell className="text-[10px]">{new Date(loan.checkoutDate).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" className="text-brand-maroon font-bold h-7" onClick={() => returnLoan(loan.id)}>Return</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="flex flex-col items-center justify-center flex-1">
            <motion.div 
              key={stats.chromebooksSession}
              initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="text-4xl font-black text-brand-maroon mb-0"
            >
              {stats.chromebooksSession}
            </motion.div>
            <p className="text-[10px] text-text-sub font-bold uppercase tracking-widest mb-4">Session Handouts</p>
            
            <div className="w-full space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-full block">CB # OR ASSET TAG</label>
              <Input 
                ref={quickCBInputRef}
                placeholder="Ex. 1, 2, or scan tag"
                className="h-10 text-center font-bold border-slate-200 text-sm"
                value={anonChromebookNum}
                onChange={(e) => setAnonChromebookNum(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAnonymousChromebookIssue();
                }}
              />
              <Button 
                className="w-full h-10 bg-brand-maroon !text-white font-bold text-xs"
                onClick={handleAnonymousChromebookIssue}
                disabled={!anonChromebookNum}
              >
                Hand Out Chromebook
              </Button>
            </div>
            <p className="text-[8px] text-slate-300 font-bold uppercase mt-2">No Student ID Required</p>
          </div>
        </section>

            {/* Session Reset Button */}
            <div className="mt-6 pt-4 border-t border-slate-100 w-full grid grid-cols-2 gap-2">
              <p className="col-span-2 text-[10px] font-black text-slate-300 uppercase tracking-widest text-center mb-1">Shift Cleanup</p>
              <Button 
                variant="outline"
                className="h-10 border-red-100 text-red-400 hover:bg-red-50 hover:text-red-500 font-bold text-[9px] uppercase tracking-tighter"
                onClick={() => {
                  if(confirm("Reset DAILY CHARGER counter to 0?")) {
                    resetChargerCounter();
                  }
                }}
              >
                Reset Charger (0)
              </Button>
              <Button 
                variant="outline"
                className="h-10 border-red-100 text-red-400 hover:bg-red-50 hover:text-red-500 font-bold text-[9px] uppercase tracking-tighter"
                onClick={() => {
                  if(confirm("Reset DAILY CHROMEBOOK counter to 0?")) {
                    resetChromebookCounter();
                  }
                }}
              >
                Reset CB (0)
              </Button>
            </div>

        {/* Data Upload Card - ADMIN ONLY */}
        {isAdmin && (
          <section className="bento-card grid-upload">
            <div className="card-title justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Update Student Database
              </div>
              <Dialog>
                <DialogTrigger 
                  render={
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold text-text-sub hover:bg-slate-100 px-2">
                      MANAGE STUDENTS
                    </Button>
                  }
                />
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Campus Student Directory</DialogTitle>
                    <DialogDescription>View and manage the student list for {CAMPUSES.find(c => c.id === currentCampusId)?.name}.</DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-4 mt-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder="Search by name or ID..." 
                        className="pl-10"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className={cn(uploadSuccess && "border-green-500 text-green-600 font-bold")}
                    >
                      {isUploading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-brand-maroon border-t-transparent rounded-full animate-spin" />
                          Uploading...
                        </div>
                      ) : uploadSuccess ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          {lastImportCount} Students Added!
                        </div>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" /> Upload New Sheet
                        </>
                      )}
                    </Button>
                  </div>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>ID Number</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Location</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentCampusStudents
                          .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.id.includes(studentSearch))
                          .map(student => (
                          <TableRow key={student.id}>
                            <TableCell className="font-bold">{student.name}</TableCell>
                            <TableCell className="font-mono text-xs">{student.id}</TableCell>
                            <TableCell>{student.grade}</TableCell>
                            <TableCell className="text-xs text-text-sub">{student.email}</TableCell>
                            <TableCell>{student.location}</TableCell>
                          </TableRow>
                        ))}
                        {currentCampusStudents.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic font-medium">No students in directory</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="mt-4 pt-4 border-t flex justify-between items-center bg-slate-50/50 p-4 -mx-6 -mb-6 rounded-b-xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-2">ILTexas Enrollment Records</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[9px] text-red-400 hover:text-red-600 hover:bg-red-50 font-bold uppercase tracking-widest gap-2"
                      onClick={async () => {
                        if (confirm("⚠️ WARNING: This will PERMANENTLY delete ALL students and loan history for this campus. Proceed?")) {
                          await purgeDatabase();
                          setLoadNotification("Database Cleared Successfully");
                          setTimeout(() => setLoadNotification(''), 4000);
                        }
                      }}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Wipe Campus Data
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex-1 flex gap-6">
              <div 
                className={cn(
                  "upload-zone flex-1 transition-all",
                  uploadSuccess && "border-green-400 bg-green-50/50",
                  uploadError && "border-red-400 bg-red-50/50"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={cn(
                  "p-4 rounded-full mb-3 transition-all",
                  isUploading ? "animate-spin bg-brand-gold/20" : 
                  uploadSuccess ? "bg-green-100" : 
                  uploadError ? "bg-red-100" : "bg-slate-100"
                )}>
                  {isUploading ? (
                    <Upload className="w-6 h-6 text-brand-maroon" />
                  ) : uploadSuccess ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : uploadError ? (
                    <div className="w-6 h-6 text-red-600 font-bold flex items-center justify-center">!</div>
                  ) : (
                    <FileText className="w-6 h-6 text-text-sub" />
                  )}
                </div>
                <p className={cn("font-semibold", uploadError ? "text-red-700" : "text-text-main")}>
                  {isUploading ? "Uploading Data..." : 
                   uploadSuccess ? `Update Successful! (${lastImportCount} Students)` : 
                   uploadError ? "Upload Failed" :
                   "Drop CSV or Excel sheet here"}
                </p>
                <p className="text-xs text-text-sub mt-1 max-w-[200px] text-center">
                  {isUploading ? "Parsing student records..." : 
                   uploadSuccess ? `Successfully imported students to ${CAMPUSES.find(c => c.id === currentCampusId)?.name}` : 
                   uploadError ? uploadError :
                   "Supports per-campus updates"}
                </p>
                {uploadError && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-[10px] text-red-500 underline mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadError(null);
                    }}
                  >
                    Clear Error
                  </Button>
                )}
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  accept=".csv,.xlsx,.xls"
                />
              </div>
            </div>
          </section>
        )}

        {!isAdmin && (
          <section className="bento-card grid-upload flex items-center justify-center flex-col text-center p-8">
            <ShieldCheck className="w-12 h-12 text-slate-200 mb-4" />
            <h3 className="font-bold text-slate-800 mb-1 uppercase tracking-tight">Tech Zone</h3>
            <p className="text-xs text-text-sub max-w-[200px]">Only admins can upload student databases. Contact your campus administrator to update rosters.</p>
          </section>
        )}

        {/* Stats & Reports Card */}
        <section className="bento-card grid-reports">
          <div className="card-title">
            <BarChart3 className="w-4 h-4" />
            Live Loaner Overview
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 flex-1">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-text-sub">Chromebooks Out</span>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">{stats.chromebooks}</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-text-sub">Chargers Loaned</span>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">{stats.chargers}</Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-text-sub">Forgotten Reason</span>
                <Badge className="bg-slate-100 text-slate-700">{stats.reasons['Forgotten at Home'] || 0}</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-text-sub">Broken Reason</span>
                <Badge className="bg-slate-100 text-slate-700">{stats.reasons['Broken'] || 0}</Badge>
              </div>
            </div>

            <div className="col-span-2 flex flex-col justify-end gap-3">
              <ScrollArea className="h-[120px] w-full border rounded-lg bg-slate-50/50 p-2">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-text-sub uppercase mb-2 ml-1">Today's Activity</p>
                  {todayActivity.map(loan => (
                    <div key={loan.id} className="text-[11px] flex items-center justify-between bg-white p-2 rounded border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        {loan.status === 'active' ? (
                          <div className="w-2 h-2 rounded-full bg-orange-400" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                        )}
                        <span className="font-semibold underline decoration-slate-200">{loan.studentName}</span>
                        <span className="text-text-sub lowercase">took {loan.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 capitalize">{loan.status}</span>
                        {loan.status === 'active' && (
                          <button 
                            onClick={() => returnLoan(loan.id)}
                            className="text-brand-maroon hover:underline font-bold"
                          >
                            Return
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {todayActivity.length === 0 && (
                    <div className="h-full flex items-center justify-center py-6 text-text-sub text-xs italic">
                      No activity today
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-text-sub ml-1">From</span>
                    <input 
                      type="date" 
                      className="text-xs bg-transparent outline-none cursor-pointer" 
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                    />
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-text-sub ml-1">To</span>
                    <input 
                      type="date" 
                      className="text-xs bg-transparent outline-none cursor-pointer" 
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                    />
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  className="h-14 border-brand-maroon text-brand-maroon font-bold px-8 hover:bg-brand-maroon hover:text-white transition-all flex-1"
                  onClick={exportReport}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="mt-auto py-4 px-8 border-t bg-white flex justify-between items-center text-xs text-text-sub">
        <div>© 2026 International Leadership of Texas | Loaner Portal v1.0</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            System Live
          </div>
          <div>All data stored locally in browser session</div>
        </div>
      </footer>
    </div>
  );
}
