/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  getDoc,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { 
  BookOpen, 
  Users, 
  CheckCircle, 
  Download, 
  Plus, 
  Trash2, 
  UserPlus, 
  Award, 
  Clock, 
  LogOut, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  AlertTriangle, 
  AlertCircle,
  Search, 
  RotateCcw, 
  Calendar, 
  Briefcase, 
  ShieldAlert, 
  Check, 
  X, 
  ClipboardCheck,
  Info,
  Lock,
  Sliders,
  Pencil,
  ArrowRight,
  Contact,
  RefreshCw,
  Printer,
  Upload,
  Image
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  School, 
  Profile, 
  Class, 
  ClassTeacherAssignment, 
  Student, 
  AttendanceRecord, 
  StudentReportRow,
  TermFeesConfig,
  StudentTermRegistration,
  SubscriptionPaymentRecord
} from './types';
import { 
  generateStudentCode, 
  calculateStudentStats, 
  downloadCSV,
  downloadPDF
} from './utils/helpers';
import { 
  seedDemoDataForUser, 
  DEMO_ADMIN_EMAIL, 
  DEMO_TEACHER_EMAIL, 
  DEMO_PASSWORD 
} from './utils/seed';
import StudentCodeBadge from './components/StudentCodeBadge';
import GradesTab from './components/GradesTab';
import { BillingTabPanel } from './components/BillingTabPanel';
import { Homepage } from './components/Homepage';
import { PaystackPaymentModal } from './components/PaystackPaymentModal';

const PRESET_SCHOOL_BADGES = [
  {
    id: 'badge-academic-crest',
    name: 'Academic Shield & Star',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,5 95,25 95,60 50,95 5,60 5,25" fill="%231B4332" stroke="%23D4A017" stroke-width="4"/><polygon points="50,12 87,29 87,57 50,87 13,57 13,29" fill="%23143225"/><path d="M50 25 L58 45 L80 45 L62 57 L68 78 L50 65 L32 78 L38 57 L20 45 L42 45 Z" fill="%23D4A017"/><circle cx="50" cy="50" r="8" fill="%23FFFFFF"/></svg>'
  },
  {
    id: 'badge-crown-book',
    name: 'Crown & Book Emblem',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%231B4332" stroke="%23D4A017" stroke-width="5"/><circle cx="50" cy="50" r="38" fill="%230F281E"/><path d="M30 40 L40 55 L50 40 L60 55 L70 40 L70 60 L30 60 Z" fill="%23D4A017"/><path d="M25 68 Q50 60 75 68 L75 74 Q50 66 25 74 Z" fill="%23FFFFFF"/></svg>'
  },
  {
    id: 'badge-laurel-crest',
    name: 'Eagle & Laurel Seal',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="20" fill="%231B4332" stroke="%23D4A017" stroke-width="4"/><path d="M50 20 L75 35 L75 65 L50 80 L25 65 L25 35 Z" fill="%23D4A017"/><path d="M50 26 L69 38 L69 62 L50 74 L31 62 L31 38 Z" fill="%23143225"/><text x="50" y="55" font-size="28" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="%23FFFFFF">K</text></svg>'
  },
  {
    id: 'badge-nigeria-coat',
    name: 'National Coat Shield',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,5 92,20 85,80 50,95 15,80 8,20" fill="%23046A38" stroke="%23FFFFFF" stroke-width="4"/><polygon points="50,12 84,24 78,74 50,87 22,74 16,24" fill="%23034B28"/><path d="M35 30 L65 30 L65 70 L35 70 Z" fill="%23FFFFFF"/><path d="M50 35 L55 48 L68 48 L58 57 L62 70 L50 61 L38 70 L42 57 L32 48 L45 48 Z" fill="%23046A38"/></svg>'
  }
];

function cleanObject<T extends object>(obj: T): T {
  const result = { ...obj } as any;
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) {
      delete result[key];
    }
  });
  return result;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);

  // Offline Sandbox Mode State & Configs
  const [isOfflineMode, setIsOfflineMode] = useState(() => {
    const stored = localStorage.getItem('rollcall_is_offline');
    if (stored !== null) return stored === 'true';
    
    // Auto-fallback if the Firebase project credentials are unconfigured / placeholders
    const isPlaceholder = !firebaseConfig || 
                           !firebaseConfig.apiKey || 
                           firebaseConfig.apiKey === 'remixed-api-key' || 
                           firebaseConfig.projectId === 'remixed-project-id' || 
                           firebaseConfig.apiKey.toLowerCase().includes('placeholder') ||
                           firebaseConfig.apiKey.toLowerCase().includes('remixed');
    
    if (isPlaceholder) {
      localStorage.setItem('rollcall_is_offline', 'true');
      return true;
    }
    return false;
  });

  const OFFLINE_SEED_SCHOOL: School = {
    id: 'focused-school-fgc-abia',
    name: 'Federal Government College, Abia',
    terms: ['First Term 2025/2026', 'Second Term 2025/2026', 'Third Term 2025/2026'],
    created_at: new Date().toISOString()
  };

  const OFFLINE_SEED_PROFILES: Profile[] = [
    {
      id: 'demo-admin-uid-mr-ogbuagu',
      school_id: 'focused-school-fgc-abia',
      full_name: 'Mr. Gamaliel Ogbuagu',
      email: 'mr.ogbuagu@school.edu',
      role: 'admin',
      created_at: new Date().toISOString()
    },
    {
      id: 'demo-teacher-uid-mrs-amadi',
      school_id: 'focused-school-fgc-abia',
      full_name: 'Mrs. Chioma Amadi',
      email: 'mrs.amadi@school.edu',
      role: 'teacher',
      created_at: new Date().toISOString()
    }
  ];

  const OFFLINE_SEED_CLASSES: Class[] = [
    {
      id: 'class-js1a',
      school_id: 'focused-school-fgc-abia',
      name: 'JS 1A',
      created_at: new Date().toISOString()
    },
    {
      id: 'class-js1b',
      school_id: 'focused-school-fgc-abia',
      name: 'JS 1B',
      created_at: new Date().toISOString()
    },
    {
      id: 'class-ss1',
      school_id: 'focused-school-fgc-abia',
      name: 'SS 1 Science',
      created_at: new Date().toISOString()
    }
  ];

  const OFFLINE_SEED_ASSIGNMENTS: ClassTeacherAssignment[] = [
    {
      id: 'class-js1a_demo-teacher-uid-mrs-amadi',
      class_id: 'class-js1a',
      teacher_id: 'demo-teacher-uid-mrs-amadi',
      school_id: 'focused-school-fgc-abia',
      created_at: new Date().toISOString()
    }
  ];

  const OFFLINE_SEED_STUDENTS: Student[] = [
    // JS 1A Students
    { id: 'stud-01', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', name: 'Obi Nwosu', code: 'JS1A-001', email: 'obi.nwosu@student.ng', created_at: new Date().toISOString() },
    { id: 'stud-02', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', name: 'Amaka Okafor', code: 'JS1A-002', email: 'amaka.okafor@student.ng', created_at: new Date().toISOString() },
    { id: 'stud-03', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', name: 'Chidi Benson', code: 'JS1A-003', email: 'chidi.benson@student.ng', created_at: new Date().toISOString() },
    { id: 'stud-04', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', name: 'Funmilayo Adebayo', code: 'JS1A-004', email: 'funmi.ade@student.ng', created_at: new Date().toISOString() },
    { id: 'stud-05', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', name: 'Fatima Ibrahim', code: 'JS1A-005', email: 'fatima.ib@student.ng', created_at: new Date().toISOString() },
    { id: 'stud-06', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', name: 'Ngozi Aliu', code: 'JS1A-006', email: 'ngozi@student.ng', created_at: new Date().toISOString() },
    { id: 'stud-07', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', name: 'Tunde Bakare', code: 'JS1A-007', email: 'tunde@student.ng', created_at: new Date().toISOString() },
    // JS 1B Students
    { id: 'stud-08', school_id: 'focused-school-fgc-abia', class_id: 'class-js1b', name: 'Emeka Ezike', code: 'JS1B-001', email: 'emeka@student.ng', created_at: new Date().toISOString() },
    { id: 'stud-09', school_id: 'focused-school-fgc-abia', class_id: 'class-js1b', name: 'Aisha Bello', code: 'JS1B-002', email: 'aisha@student.ng', created_at: new Date().toISOString() },
    // SS 1 Science Students
    { id: 'stud-10', school_id: 'focused-school-fgc-abia', class_id: 'class-ss1', name: 'Yusuf Musa', code: 'SS1S-001', email: 'yusuf@student.ng', created_at: new Date().toISOString() },
    { id: 'stud-11', school_id: 'focused-school-fgc-abia', class_id: 'class-ss1', name: 'Chioma Okeke', code: 'SS1S-002', email: 'chioma@student.ng', created_at: new Date().toISOString() }
  ];

  const OFFLINE_SEED_RECORDS: AttendanceRecord[] = [
    // Seeding some initial past attendance records for JS 1A from the previous few days to make reports dynamic
    { id: 'rec-01', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-01', term: 'First Term 2025/2026', date: '2026-06-19', status: 'early', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },
    { id: 'rec-02', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-02', term: 'First Term 2025/2026', date: '2026-06-19', status: 'early', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },
    { id: 'rec-03', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-03', term: 'First Term 2025/2026', date: '2026-06-19', status: 'late', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },
    { id: 'rec-04', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-04', term: 'First Term 2025/2026', date: '2026-06-19', status: 'early', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },
    { id: 'rec-05', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-05', term: 'First Term 2025/2026', date: '2026-06-19', status: 'early', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },

    { id: 'rec-06', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-01', term: 'First Term 2025/2026', date: '2026-06-18', status: 'early', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },
    { id: 'rec-07', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-02', term: 'First Term 2025/2026', date: '2026-06-18', status: 'late', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },
    { id: 'rec-08', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-03', term: 'First Term 2025/2026', date: '2026-06-18', status: 'early', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },
    { id: 'rec-09', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-04', term: 'First Term 2025/2026', date: '2026-06-18', status: 'early', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },

    { id: 'rec-11', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-01', term: 'First Term 2025/2026', date: '2026-06-17', status: 'early', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },
    { id: 'rec-12', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-02', term: 'First Term 2025/2026', date: '2026-06-17', status: 'early', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() },
    { id: 'rec-13', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', student_id: 'stud-03', term: 'First Term 2025/2026', date: '2026-06-17', status: 'late', marked_by: 'demo-teacher-uid-mrs-amadi', created_at: new Date().toISOString() }
  ];

  const OFFLINE_SEED_SUBJECTS: any[] = [
    { id: 'sub-math', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', name: 'Mathematics', created_at: new Date().toISOString() },
    { id: 'sub-english', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', name: 'English Language', created_at: new Date().toISOString() },
    { id: 'sub-science', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', name: 'Basic Science', created_at: new Date().toISOString() }
  ];

  const OFFLINE_SEED_ASSESSMENT_CONFIGS: any[] = [
    { id: 'assess-math-test', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-math', name: 'Midterm Test', type: 'test', max_score: 30, created_at: new Date().toISOString() },
    { id: 'assess-math-exam', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-math', name: 'Terminal Exam', type: 'exam', max_score: 70, created_at: new Date().toISOString() },
    { id: 'assess-eng-test', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-english', name: 'Continuous Assessment', type: 'test', max_score: 30, created_at: new Date().toISOString() },
    { id: 'assess-eng-exam', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-english', name: 'Terminal Exam', type: 'exam', max_score: 70, created_at: new Date().toISOString() }
  ];

  const OFFLINE_SEED_SCORES: any[] = [
    // Obi Nwosu
    { id: 'score-1', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-math', student_id: 'stud-01', term: 'First Term 2025/2026', assessment_config_id: 'assess-math-test', score: 24, created_at: new Date().toISOString() },
    { id: 'score-2', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-math', student_id: 'stud-01', term: 'First Term 2025/2026', assessment_config_id: 'assess-math-exam', score: 58, created_at: new Date().toISOString() },
    { id: 'score-3', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-english', student_id: 'stud-01', term: 'First Term 2025/2026', assessment_config_id: 'assess-eng-test', score: 26, created_at: new Date().toISOString() },
    { id: 'score-4', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-english', student_id: 'stud-01', term: 'First Term 2025/2026', assessment_config_id: 'assess-eng-exam', score: 61, created_at: new Date().toISOString() },
    
    // Amaka Okafor
    { id: 'score-5', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-math', student_id: 'stud-02', term: 'First Term 2025/2026', assessment_config_id: 'assess-math-test', score: 28, created_at: new Date().toISOString() },
    { id: 'score-6', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-math', student_id: 'stud-02', term: 'First Term 2025/2026', assessment_config_id: 'assess-math-exam', score: 67, created_at: new Date().toISOString() },
    { id: 'score-7', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-english', student_id: 'stud-02', term: 'First Term 2025/2026', assessment_config_id: 'assess-eng-test', score: 22, created_at: new Date().toISOString() },
    { id: 'score-8', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-english', student_id: 'stud-02', term: 'First Term 2025/2026', assessment_config_id: 'assess-eng-exam', score: 54, created_at: new Date().toISOString() },

    // Chidi Benson
    { id: 'score-9', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-math', student_id: 'stud-03', term: 'First Term 2025/2026', assessment_config_id: 'assess-math-test', score: 18, created_at: new Date().toISOString() },
    { id: 'score-10', school_id: 'focused-school-fgc-abia', class_id: 'class-js1a', subject_id: 'sub-math', student_id: 'stud-03', term: 'First Term 2025/2026', assessment_config_id: 'assess-math-exam', score: 42, created_at: new Date().toISOString() }
  ];

  const initLocalStorageDb = (forceReset = false) => {
    // If we've run before with Enugu data, let's force a re-init to apply the Abia rename and fresh start
    const currentLocalSchool = localStorage.getItem('rc_school');
    const isEnugu = currentLocalSchool && currentLocalSchool.includes('Enugu');
    
    if (!localStorage.getItem('rc_initialized') || isEnugu || forceReset) {
      localStorage.setItem('rc_school', JSON.stringify(OFFLINE_SEED_SCHOOL));
      localStorage.setItem('rc_profiles', JSON.stringify(OFFLINE_SEED_PROFILES));
      localStorage.setItem('rc_classes', JSON.stringify(OFFLINE_SEED_CLASSES));
      localStorage.setItem('rc_class_teachers', JSON.stringify(OFFLINE_SEED_ASSIGNMENTS));
      localStorage.setItem('rc_students', JSON.stringify(OFFLINE_SEED_STUDENTS));
      localStorage.setItem('rc_attendance_records', JSON.stringify(OFFLINE_SEED_RECORDS));
      
      // Seed academic items
      localStorage.setItem('rc_subjects', JSON.stringify(OFFLINE_SEED_SUBJECTS));
      localStorage.setItem('rc_assessment_configs', JSON.stringify(OFFLINE_SEED_ASSESSMENT_CONFIGS));
      localStorage.setItem('rc_student_scores', JSON.stringify(OFFLINE_SEED_SCORES));

      // Seed student fees configuration and dynamic installment tracking registrations
      const SEED_TERM_FEES: TermFeesConfig[] = [
        {
          id: 'focused-school-fgc-abia_First Term 2025/2026',
          school_id: 'focused-school-fgc-abia',
          term: 'First Term 2025/2026',
          newStudentFee: 150000,
          returningStudentFee: 100000,
          created_at: new Date().toISOString()
        }
      ];

      const SEED_TERM_REGISTRATIONS: StudentTermRegistration[] = [
        {
          id: 'focused-school-fgc-abia_First Term 2025/2026_stud-01',
          school_id: 'focused-school-fgc-abia',
          term: 'First Term 2025/2026',
          student_id: 'stud-01',
          studentType: 'returning',
          addedToNameNote: 'Approved Scholar Suffix',
          totalFee: 100000,
          paidAmount: 100000,
          status: 'paid',
          payments: [
            { id: 'pay_1', date: '2026-06-15', amount: 100000, reference: 'REF-NWOSU-001', notes: 'Paid in full at UBA Branch' }
          ],
          created_at: new Date().toISOString()
        },
        {
          id: 'focused-school-fgc-abia_First Term 2025/2026_stud-02',
          school_id: 'focused-school-fgc-abia',
          term: 'First Term 2025/2026',
          student_id: 'stud-02',
          studentType: 'new',
          addedToNameNote: 'Nursery Alumnus',
          totalFee: 150000,
          paidAmount: 80000,
          status: 'partial',
          payments: [
            { id: 'pay_2', date: '2026-06-16', amount: 80000, reference: 'REF-OKAFOR-002', notes: 'First installment. Outstanding ₦70,000 balance in July' }
          ],
          created_at: new Date().toISOString()
        }
      ];

      localStorage.setItem('rc_term_fees_configs', JSON.stringify(SEED_TERM_FEES));
      localStorage.setItem('rc_student_term_registrations', JSON.stringify(SEED_TERM_REGISTRATIONS));

      localStorage.setItem('rc_initialized', 'true');
    }
  };

  const syncOfflineDataToState = () => {
    const localSchool = localStorage.getItem('rc_school');
    const localProfiles = localStorage.getItem('rc_profiles');
    const localClasses = localStorage.getItem('rc_classes');
    const localAssignments = localStorage.getItem('rc_class_teachers');
    const localStudents = localStorage.getItem('rc_students');
    const localRecords = localStorage.getItem('rc_attendance_records');
    
    const localSubjects = localStorage.getItem('rc_subjects');
    const localConfigs = localStorage.getItem('rc_assessment_configs');
    const localScores = localStorage.getItem('rc_student_scores');
    
    const localTermFeesConfigs = localStorage.getItem('rc_term_fees_configs');
    const localStudentTermRegistrations = localStorage.getItem('rc_student_term_registrations');

    if (localSchool) setCurrentSchool(JSON.parse(localSchool));
    if (localClasses) setClasses(JSON.parse(localClasses));
    if (localProfiles) setAllProfilesInSchool(JSON.parse(localProfiles));
    if (localAssignments) setClassAssignments(JSON.parse(localAssignments));
    if (localStudents) setStudents(JSON.parse(localStudents));
    if (localRecords) setAttendanceRecords(JSON.parse(localRecords));

    if (localSubjects) setSubjects(JSON.parse(localSubjects));
    if (localConfigs) setAssessmentConfigs(JSON.parse(localConfigs));
    if (localScores) setStudentScores(JSON.parse(localScores));
    
    if (localTermFeesConfigs) setTermFeesConfigs(JSON.parse(localTermFeesConfigs));
    if (localStudentTermRegistrations) setStudentTermRegistrations(JSON.parse(localStudentTermRegistrations));
  };

  const saveOfflineItem = (key: string, list: any[]) => {
    localStorage.setItem(key, JSON.stringify(list));
    syncOfflineDataToState();
  };

  // Core Data State
  const [classes, setClasses] = useState<Class[]>([]);
  const [allProfilesInSchool, setAllProfilesInSchool] = useState<Profile[]>([]);
  const [classAssignments, setClassAssignments] = useState<ClassTeacherAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // School Academic states
  const [subjects, setSubjects] = useState<any[]>([]);
  const [assessmentConfigs, setAssessmentConfigs] = useState<any[]>([]);
  const [studentScores, setStudentScores] = useState<any[]>([]);

  // School Fees and Billings state
  const [termFeesConfigs, setTermFeesConfigs] = useState<TermFeesConfig[]>([]);
  const [studentTermRegistrations, setStudentTermRegistrations] = useState<StudentTermRegistration[]>([]);

  // Generated teacher login details
  const [lastGeneratedCredentials, setLastGeneratedCredentials] = useState<{ email: string; pass: string; name: string } | null>(null);

  // Selection & Mode State
  const [currentTerm, setCurrentTerm] = useState<string>('First Term 2025/2026');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [activeTab, setActiveTab] = useState<'attendance' | 'reports' | 'roster' | 'grades'>('attendance');
  const [codeMode, setCodeMode] = useState<'early' | 'late'>('early');
  const [codeInputValue, setCodeInputValue] = useState<string>('');
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'err' | 'info'; msg: string } | null>(null);

  // Authentication states
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState<string | null>(null);

  // Management modals and input fields
  const [newClassName, setNewClassName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTermName, setNewTermName] = useState('');
  const [showAddTermModal, setShowAddTermModal] = useState(false);
  const prevAddTermModalRef = useRef(false);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);

  // Detailed student registration states
  const [showDetailStudentModal, setShowDetailStudentModal] = useState(false);
  const [newStudentDetailName, setNewStudentDetailName] = useState('');
  const [newStudentDetailEmail, setNewStudentDetailEmail] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentPassport, setNewStudentPassport] = useState('');
  const [newStudentType, setNewStudentType] = useState<'new' | 'returning'>('new');
  const newStudentFileInputRef = useRef<HTMLInputElement>(null);
  const editStudentFileInputRef = useRef<HTMLInputElement>(null);

  // Editing student state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');
  const [editStudentPhone, setEditStudentPhone] = useState('');
  const [editStudentPassport, setEditStudentPassport] = useState('');
  const [editStudentType, setEditStudentType] = useState<'new' | 'returning'>('new');

  // ID Card State
  const [selectedIdCardStudent, setSelectedIdCardStudent] = useState<Student | null>(null);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [idCardSide, setIdCardSide] = useState<'front' | 'back'>('front');

  // School Badge & Branding State
  const [showSchoolBadgeModal, setShowSchoolBadgeModal] = useState(false);
  const [badgeInputUrl, setBadgeInputUrl] = useState('');
  const [schoolAddressInput, setSchoolAddressInput] = useState('');
  const [schoolPhoneInput, setSchoolPhoneInput] = useState('');

  // Term Countdown Config states
  const [calendarSelectedTerm, setCalendarSelectedTerm] = useState<string>('');
  const [termStartMonth, setTermStartMonth] = useState<string>('January');
  const [termEndMonth, setTermEndMonth] = useState<string>('April');
  const [termStartDate, setTermStartDate] = useState<string>('');
  const [termEndDate, setTermEndDate] = useState<string>('');
  const [calendarTab, setCalendarTab] = useState<'label' | 'dates'>('label');

  // School Selection and Registration states
  const [allSchoolsList, setAllSchoolsList] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [isRegisteringSchool, setIsRegisteringSchool] = useState<boolean>(false);
  
  // Registration Inputs
  const [regSchoolName, setRegSchoolName] = useState('');
  const [regSchoolAddress, setRegSchoolAddress] = useState('');
  const [regSchoolPhone, setRegSchoolPhone] = useState('');
  const [regSchoolContactEmail, setRegSchoolContactEmail] = useState('');
  const [regAdminName, setRegAdminName] = useState('');
  const [regAdminEmail, setRegAdminEmail] = useState('');
  const [regAdminPassword, setRegAdminPassword] = useState('');

  // Payment Mock Gateway Dialog states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTermTarget, setPaymentTermTarget] = useState('');
  const [paymentStep, setPaymentStep] = useState<'method' | 'card' | 'processing' | 'success'>('method');
  const [paymentCardNumber, setPaymentCardNumber] = useState('');
  const [paymentExpiry, setPaymentExpiry] = useState('');
  const [paymentCVV, setPaymentCVV] = useState('');

  // Landing Page & Custom Plans states
  const [showAuthPortal, setShowAuthPortal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [regSchoolTier, setRegSchoolTier] = useState<'free' | 'premium'>('free');


  // Memoized completion and input-lock check
  const isTermCompleted = useMemo(() => {
    if (!currentSchool || !currentTerm) return false;
    const config = currentSchool.termConfigs?.[currentTerm];
    if (!config || !config.endDate) return false;
    
    const end = new Date(config.endDate);
    end.setHours(23, 59, 59, 999);
    
    const now = new Date();
    return now > end;
  }, [currentSchool, currentTerm]);

  // Dynamic subscription fee checking (20,000 Naira per term)
  // Lock triggers 1 month after registration or 1 month after the oldest term's commencement
  const isSchoolLocked = useMemo(() => {
    if (!currentSchool || !currentTerm) return false;

    // Demo accounts bypass locks for general inspection
    if (currentUser?.email === DEMO_ADMIN_EMAIL || currentUser?.email === DEMO_TEACHER_EMAIL) {
      return false;
    }

    // Unlocked if paymentStatus for this term is registered as 'paid'
    if (currentSchool.paymentStatus && currentSchool.paymentStatus[currentTerm] === 'paid') {
      return false;
    }

    // Default grace period: 1 month after school registration date
    const regDateString = currentSchool.created_at || new Date().toISOString();
    const regDate = new Date(regDateString);
    const oneMonthMillis = 30 * 24 * 60 * 60 * 1000;
    const now = new Date();

    if (now.getTime() < regDate.getTime() + oneMonthMillis) {
      return false; // Still in trial
    }

    // Check oldest term if configured
    if (currentSchool.termConfigs) {
      const configKeys = Object.keys(currentSchool.termConfigs);
      if (configKeys.length > 0) {
        let oldestDate: Date | null = null;
        for (const tk of configKeys) {
          const config = currentSchool.termConfigs[tk];
          if (config && config.startDate) {
            const sd = new Date(config.startDate);
            if (!isNaN(sd.getTime())) {
              if (!oldestDate || sd < oldestDate) {
                oldestDate = sd;
              }
            }
          }
        }
        if (oldestDate) {
          // Grace period of 1 month after the first term's startDate
          const oneMonthAfterOldestTerm = new Date(oldestDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          if (now.getTime() < oneMonthAfterOldestTerm.getTime()) {
            return false;
          }
        }
      }
    }

    return true; // Locked: Past free month trial and unpaid!
  }, [currentSchool, currentTerm, currentUser?.email]);

  const isInputLockedForTeacher = (isTermCompleted || isSchoolLocked) && currentProfile?.role === 'teacher';

  // Refs for focusing
  const codeInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Authentication observer
  useEffect(() => {
    if (isOfflineMode) {
      // Mock observer initialization
      initLocalStorageDb();
      const offlineRole = localStorage.getItem('rollcall_offline_role') || 'admin';
      const uid = offlineRole === 'admin' ? 'demo-admin-uid-mr-ogbuagu' : 'demo-teacher-uid-mrs-amadi';
      const email = offlineRole === 'admin' ? DEMO_ADMIN_EMAIL : DEMO_TEACHER_EMAIL;

      setCurrentUser({ uid, email } as any);

      // Seed local storage mock states
      const localSchool = localStorage.getItem('rc_school');
      const localProfiles = localStorage.getItem('rc_profiles');

      if (localSchool) setCurrentSchool(JSON.parse(localSchool));
      if (localProfiles) {
        const list = JSON.parse(localProfiles) as Profile[];
        const matched = list.find(p => p.id === uid);
        if (matched) setCurrentProfile(matched);
      }

      syncOfflineDataToState();
      setAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (!user) {
        setCurrentProfile(null);
        setCurrentSchool(null);
      }
    });
    return () => unsubscribe();
  }, [isOfflineMode]);

  // 2. Clear notification timeouts
  useEffect(() => {
    if (statusFeedback) {
      const timer = setTimeout(() => {
        statusFeedback && setStatusFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusFeedback]);

  // Load independent list of schools for selector dropdown on credentials card
  useEffect(() => {
    if (isOfflineMode) {
      setAllSchoolsList([
        {
          id: 'focused-school-fgc-abia',
          name: 'Federal Government College, Abia',
          terms: ['First Term 2025/2026'],
          created_at: '2026-05-01T00:00:00Z',
          address: 'Umuahia, Abia State',
          phone: '+234 803 123 4567',
          contactEmail: 'contact@fgcabia.edu.ng',
          paymentStatus: {}
        }
      ]);
      setSelectedSchoolId('focused-school-fgc-abia');
      return;
    }
    
    const unsubscribe = onSnapshot(collection(db, 'schools'), (snap) => {
      const list = snap.docs.map(d => d.data() as School);
      setAllSchoolsList(list);
      if (list.length > 0) {
        setSelectedSchoolId(prev => {
          if (prev && list.some(s => s.id === prev)) return prev;
          return list[0].id;
        });
      }
    }, (err) => {
      console.warn("Could not load schools list for dropdown selector:", err);
    });
    
    return () => unsubscribe();
  }, [isOfflineMode]);

  // 3. Sync profile & school-isolated metrics
  useEffect(() => {
    if (isOfflineMode) return;
    if (!currentUser) return;

    const profileDocRef = doc(db, 'profiles', currentUser.uid);
    let unsubscribeSchool: (() => void) | null = null;

    const unsubscribeProfile = onSnapshot(profileDocRef, (profileSnap) => {
      if (profileSnap.exists()) {
        const pData = profileSnap.data() as Profile;
        setCurrentProfile(pData);
        
        // Clean up previous school listener if it exists
        if (unsubscribeSchool) {
          unsubscribeSchool();
        }

        // Establish real-time listen to the associated School structure
        const schoolDocRef = doc(db, 'schools', pData.school_id);
        unsubscribeSchool = onSnapshot(schoolDocRef, (schoolSnap) => {
          if (schoolSnap.exists()) {
            const sData = schoolSnap.data() as School;
            setCurrentSchool(sData);
            if (sData.terms && sData.terms.length > 0) {
              setCurrentTerm(prev => sData.terms.includes(prev) ? prev : sData.terms[0]);
            }
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `schools/${pData.school_id}`);
        });
      } else {
        // If profile does not exist yet (but auth exists), we let them seed or establish state
        setCurrentProfile(null);
        setCurrentSchool(null);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `profiles/${currentUser.uid}`);
    });

    return () => {
      unsubscribeProfile();
      if (unsubscribeSchool) {
        unsubscribeSchool();
      }
    };
  }, [currentUser, isOfflineMode]);

  // 4. Sync School-bound lists
  useEffect(() => {
    if (isOfflineMode) return;
    if (!currentProfile) {
      setClasses([]);
      setAllProfilesInSchool([]);
      setClassAssignments([]);
      setStudents([]);
      setAttendanceRecords([]);
      setSubjects([]);
      setAssessmentConfigs([]);
      setStudentScores([]);
      return;
    }

    const schoolId = currentProfile.school_id;

    // A. Sync Classes
    const qClasses = query(collection(db, 'classes'), where('school_id', '==', schoolId));
    const unsubscribeClasses = onSnapshot(qClasses, (snap) => {
      const list = snap.docs.map(d => d.data() as Class);
      setClasses(list);
      // Auto-select class if empty
      if (list.length > 0) {
        setSelectedClassId(prev => {
          const match = list.find(c => c.id === prev);
          // If previous exists check if it is still valid, else default to first category
          if (match) return prev;
          
          // If teacher, filter for their assignments
          if (currentProfile.role === 'teacher') {
            const myAssignedIds = classAssignments.filter(a => a.teacher_id === currentProfile.id).map(a => a.class_id);
            const teacherClassOption = list.find(c => myAssignedIds.includes(c.id));
            return teacherClassOption ? teacherClassOption.id : '';
          }
          return list[0].id;
        });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'classes');
    });

    // B. Sync All Profiles (including other teachers)
    const qProfiles = query(collection(db, 'profiles'), where('school_id', '==', schoolId));
    const unsubscribeProfiles = onSnapshot(qProfiles, (snap) => {
      const list = snap.docs.map(d => d.data() as Profile);
      setAllProfilesInSchool(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'profiles');
    });

    // C. Sync Teacher class assignments
    const qAssigns = query(collection(db, 'class_teachers'), where('school_id', '==', schoolId));
    const unsubscribeAssigns = onSnapshot(qAssigns, (snap) => {
      const list = snap.docs.map(d => d.data() as ClassTeacherAssignment);
      setClassAssignments(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'class_teachers');
    });

    // D. Sync Students
    const qStudents = query(collection(db, 'students'), where('school_id', '==', schoolId));
    const unsubscribeStudents = onSnapshot(qStudents, (snap) => {
      const list = snap.docs.map(d => d.data() as Student);
      setStudents(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'students');
    });

    // E. Sync Attendance Records
    const qRecords = query(collection(db, 'attendance_records'), where('school_id', '==', schoolId));
    const unsubscribeRecords = onSnapshot(qRecords, (snap) => {
       const list = snap.docs.map(d => d.data() as AttendanceRecord);
       setAttendanceRecords(list);
    }, (err) => {
       handleFirestoreError(err, OperationType.LIST, 'attendance_records');
    });

    // F. Sync Academic Subjects
    const qSubjects = query(collection(db, 'subjects'), where('school_id', '==', schoolId));
    const unsubscribeSubjects = onSnapshot(qSubjects, (snap) => {
       const list = snap.docs.map(d => d.data() as any);
       setSubjects(list);
    }, (err) => {
       handleFirestoreError(err, OperationType.LIST, 'subjects');
    });

    // G. Sync Assessment Configs
    const qConfigs = query(collection(db, 'assessment_configs'), where('school_id', '==', schoolId));
    const unsubscribeConfigs = onSnapshot(qConfigs, (snap) => {
       const list = snap.docs.map(d => d.data() as any);
       setAssessmentConfigs(list);
    }, (err) => {
       handleFirestoreError(err, OperationType.LIST, 'assessment_configs');
    });

    // H. Sync Student Scores
    const qScores = query(collection(db, 'student_scores'), where('school_id', '==', schoolId));
    const unsubscribeScores = onSnapshot(qScores, (snap) => {
       const list = snap.docs.map(d => d.data() as any);
       setStudentScores(list);
    }, (err) => {
       handleFirestoreError(err, OperationType.LIST, 'student_scores');
    });

    // I. Sync Term Fees Configs
    const qTermFees = query(collection(db, 'term_fees_configs'), where('school_id', '==', schoolId));
    const unsubscribeTermFees = onSnapshot(qTermFees, (snap) => {
       const list = snap.docs.map(d => d.data() as TermFeesConfig);
       setTermFeesConfigs(list);
    }, (err) => {
       handleFirestoreError(err, OperationType.LIST, 'term_fees_configs');
    });

    // J. Sync Student Term Registrations
    const qTermRegs = query(collection(db, 'student_term_registrations'), where('school_id', '==', schoolId));
    const unsubscribeTermRegs = onSnapshot(qTermRegs, (snap) => {
       const list = snap.docs.map(d => d.data() as StudentTermRegistration);
       setStudentTermRegistrations(list);
    }, (err) => {
       handleFirestoreError(err, OperationType.LIST, 'student_term_registrations');
    });

    return () => {
      unsubscribeClasses();
      unsubscribeProfiles();
      unsubscribeAssigns();
      unsubscribeStudents();
      unsubscribeRecords();
      unsubscribeSubjects();
      unsubscribeConfigs();
      unsubscribeScores();
      unsubscribeTermFees();
      unsubscribeTermRegs();
    };
  }, [currentProfile, classAssignments.length, isOfflineMode]);

  // Handle focusing code entry box naturally
  useEffect(() => {
    if (activeTab === 'attendance' && selectedClassId && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [activeTab, selectedClassId, codeMode]);

  // Dynamic filter for classes based on user role permissions
  const visibleClasses = classes.filter(cls => {
    if (!currentProfile) return false;
    if (currentProfile.role === 'admin') return true;
    
    // Teacher sees only assigned classes
    const assignedClassIds = classAssignments
      .filter(a => a.teacher_id === currentProfile.id)
      .map(a => a.class_id);
    return assignedClassIds.includes(cls.id);
  });

  // Adjust selected class if visibleClasses changes and does not include current one
  useEffect(() => {
    if (visibleClasses.length > 0 && !visibleClasses.some(c => c.id === selectedClassId)) {
      setSelectedClassId(visibleClasses[0].id);
    }
  }, [visibleClasses, selectedClassId]);

  const activeClass = classes.find(c => c.id === selectedClassId);

  // Authentication Logic
  const handleAuthLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Please fill in both email and password.');
      return;
    }
    setAuthError(null);
    setIsAuthLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      const user = credential.user;

      // School & Role Lock validation filters:
      const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
      if (profileDoc.exists()) {
        const pData = profileDoc.data() as Profile;
        if (pData.school_id) {
          setSelectedSchoolId(pData.school_id);
        }

        if (pData.school_id) {
          const schoolDoc = await getDoc(doc(db, 'schools', pData.school_id));
          if (schoolDoc.exists()) {
            const sData = schoolDoc.data() as School;
            const currentSchoolTerm = (sData.terms && sData.terms.length > 0) ? sData.terms[0] : 'First Term 2026/2027';
            
            let isSchoolTermLocked = false;
            const isTermPaid = sData.paymentStatus && sData.paymentStatus[currentSchoolTerm] === 'paid';
            if (!isTermPaid) {
              const regDateStr = sData.created_at || new Date().toISOString();
              const regDate = new Date(regDateStr);
              const oneMonthMillis = 30 * 24 * 60 * 60 * 1000;
              const now = new Date();
              if (now.getTime() >= regDate.getTime() + oneMonthMillis) {
                isSchoolTermLocked = true;
              }
            }

            if (isSchoolTermLocked && pData.role === 'teacher') {
              await signOut(auth);
              setAuthError('Access Locked: Your school subscription has expired. Please notify your administrator to pay the termly subscription of ₦20,000 on their portal to unlock teacher access.');
              setIsAuthLoading(false);
              return;
            }
          }
        }
      }
      setShowDashboard(true);
    } catch (err: any) {
      const firebaseMsg = err.message || '';
      const isAltNotAllowed = err.code === 'auth/operation-not-allowed' || firebaseMsg.includes('operation-not-allowed');
      const isApiKeyInvalid = err.code === 'auth/api-key-not-valid' || 
                              firebaseMsg.toLowerCase().includes('api-key-not-valid') || 
                              firebaseMsg.toLowerCase().includes('api key') || 
                              firebaseMsg.toLowerCase().includes('invalid-api-key') ||
                              firebaseMsg.toLowerCase().includes('api_key_invalid');

      if (isAltNotAllowed || isApiKeyInvalid) {
        console.warn('Authentication disabled or invalid API key on dashboard. Resolving via sandbox credentials check...', err);
        initLocalStorageDb();
        const localProfiles = JSON.parse(localStorage.getItem('rc_profiles') || '[]');
        const matched = localProfiles.find(
          (p: any) => p.email.toLowerCase() === authEmail.trim().toLowerCase()
        );

        if (matched) {
          // If a generated password exists, validate it to enable ultra-realistic login testing
          if (matched.generated_password && authPassword.trim() !== matched.generated_password) {
            setAuthError(`Incorrect Password. For this sandbox account, please enter "${matched.generated_password}" of the assigned teacher.`);
            setIsAuthLoading(false);
            return;
          }

          localStorage.setItem('rollcall_is_offline', 'true');
          localStorage.setItem('rollcall_offline_role', matched.role);
          setIsOfflineMode(true);

          setCurrentUser({
            uid: matched.id,
            email: matched.email
          } as any);
          setCurrentProfile(matched);
          const localSchool = JSON.parse(localStorage.getItem('rc_school') || '{}');
          setCurrentSchool(localSchool);
          syncOfflineDataToState();
          setShowDashboard(true);

          setStatusFeedback({
            type: 'success',
            msg: `Auth Provider Disabled: Local Sandbox Mode Synchronized as ${matched.full_name}!`
          });
          setIsAuthLoading(false);
          return;
        } else {
          setAuthError('Account not found in Sandbox school list. Check credentials or create a profile in the Admin dashboard.');
          setIsAuthLoading(false);
          return;
        }
      }

      // Self-Healing Auth Pathway:
      // If profile exists in the DB (created by Admin) but no actual user is registered in Custom Auth,
      // we register the account on-the-fly to prevent auth lockout.
      try {
        const qProfileByEmail = query(collection(db, 'profiles'), where('email', '==', authEmail.trim().toLowerCase()));
        const snap = await getDocs(qProfileByEmail); // let's fetch manual snaps
        
        if (!snap.empty) {
          // Profile is created by Admin, now bootstrap their actual Login password
          const profileDoc = snap.docs[0];
          const profileData = profileDoc.data() as Profile;
          
          const newCredential = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
          // Migrate Profile document ID to synchronize with the brand new UID
          await setDoc(doc(db, 'profiles', newCredential.user.uid), {
            ...profileData,
            id: newCredential.user.uid,
          });
          // Delete older duplicate
          if (profileDoc.id !== newCredential.user.uid) {
            await deleteDoc(doc(db, 'profiles', profileDoc.id));
          }
          setIsAuthLoading(false);
          return;
        }
      } catch (checkErr) {
        console.warn('Self-healing failed (this is normal if API keys are unconfigured):', checkErr);
      }

      if (firebaseMsg.includes('auth/invalid-credential') || firebaseMsg.includes('auth/wrong-password')) {
        setAuthError('Incorrect Email or Password. Try typing the original school password or click Demo sign in.');
      } else if (firebaseMsg.includes('auth/user-not-found')) {
        setAuthError('No profile matching this email was found. Please ask your school administrator to invite you.');
      } else {
        setAuthError('Log in error. Try one of the Demo Accounts below for immediate, preconfigured testing!');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) {
      setAuthError('Please enter your email address to reset your password.');
      setPasswordResetSuccess(null);
      return;
    }
    setAuthError(null);
    setPasswordResetSuccess(null);
    setIsAuthLoading(true);

    try {
      if (isOfflineMode) {
        setPasswordResetSuccess(`Sandbox Mode: Password reset email simulated successfully for ${authEmail}.`);
        setIsAuthLoading(false);
        return;
      }
      
      await sendPasswordResetEmail(auth, authEmail.trim());
      setPasswordResetSuccess(`A password reset link has been sent to ${authEmail}. Please check your spam or inbox folders.`);
    } catch (err: any) {
      const firebaseMsg = err.message || '';
      console.warn('Firebase reset password error:', err);
      if (firebaseMsg.includes('auth/invalid-email') || firebaseMsg.includes('invalid-email')) {
        setAuthError('The email address is badly formatted.');
      } else if (firebaseMsg.includes('auth/user-not-found') || firebaseMsg.includes('user-not-found')) {
        setAuthError('No profile matching this email was found in our records.');
      } else {
        // Fallback simulation in case DB API key is unconfigured
        setPasswordResetSuccess(`Simulated: Password reset request simulated successfully for ${authEmail}.`);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Demo Login triggers high-fidelity Nigerian seeding instantly
  const handleDemoSignIn = async (role: 'admin' | 'teacher') => {
    setAuthError(null);
    setIsAuthLoading(true);
    const email = role === 'admin' ? DEMO_ADMIN_EMAIL : DEMO_TEACHER_EMAIL;

    try {
      // 1. Attempt login with predetermined secure credential
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, DEMO_PASSWORD);
      } catch (loginErr: any) {
        // 2. If credential does not exist, create it (First-Run bootstrap initialization)
        if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential' || loginErr.code === 'auth/configuration-not-found' || loginErr.message) {
          userCredential = await createUserWithEmailAndPassword(auth, email, DEMO_PASSWORD);
        } else {
          throw loginErr;
        }
      }

      const user = userCredential.user;
      
      // 3. Seeds the entire database context if empty / first visit
      await seedDemoDataForUser(user.uid, role, email);
      
      setStatusFeedback({
        type: 'success',
        msg: `Demo ${role === 'admin' ? 'Proprietor' : 'Teacher'} session synchronized. Seeding succeeded!`
      });
      setShowDashboard(true);
    } catch (err: any) {
      console.warn('Demo synchronization failed with Firebase, running local-only sandbox mode fallback:', err);
      
      // Activate Offline Sandbox mode
      localStorage.setItem('rollcall_is_offline', 'true');
      localStorage.setItem('rollcall_offline_role', role);
      initLocalStorageDb(true); // Force overwrite with high-fidelity demo dataset
      setIsOfflineMode(true);

      const mockUid = role === 'admin' ? 'demo-admin-uid-mr-ogbuagu' : 'demo-teacher-uid-mrs-amadi';
      setCurrentUser({
        uid: mockUid,
        email,
      } as any);

      const localSchool = localStorage.getItem('rc_school');
      const localProfiles = localStorage.getItem('rc_profiles');

      if (localSchool) setCurrentSchool(JSON.parse(localSchool));
      if (localProfiles) {
        const list = JSON.parse(localProfiles) as Profile[];
        const matchedProfile = list.find(p => p.id === mockUid);
        if (matchedProfile) setCurrentProfile(matchedProfile);
      }

      // Pre-select correct default values for a flawless demo presentation
      setCurrentTerm('First Term 2025/2026');
      setSelectedClassId('class-js1a');
      setActiveTab('attendance');

      syncOfflineDataToState();

      setStatusFeedback({
        type: 'success',
        msg: `Offline Sandbox Active! Demo ${role === 'admin' ? 'Proprietor' : 'Teacher'} portal populated.`
      });
      setShowDashboard(true);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // School registration and custom Nigerian Payment setup
  const handleRegisterSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regSchoolName || !regSchoolContactEmail || !regAdminEmail || !regAdminPassword || !regAdminName) {
      setAuthError('Please fill in all required fields.');
      return;
    }
    setAuthError(null);
    setIsAuthLoading(true);

    try {
      if (isOfflineMode) {
        const newSchoolId = 'school_' + Date.now();
        const demoAdminUid = 'admin_' + Date.now();

        const schoolData: School = {
          id: newSchoolId,
          name: regSchoolName,
          address: regSchoolAddress || 'Nigeria',
          phone: regSchoolPhone || '',
          contactEmail: regSchoolContactEmail,
          terms: ['First Term 2026/2027'],
          termConfigs: {
            'First Term 2026/2027': {
              startMonth: 'September',
              endMonth: 'December',
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            }
          },
          paymentStatus: {},
          tier: regSchoolTier,
          created_at: new Date().toISOString()
        };

        const adminProfile: Profile = {
          id: demoAdminUid,
          school_id: newSchoolId,
          full_name: regAdminName,
          email: regAdminEmail.toLowerCase(),
          role: 'admin',
          created_at: new Date().toISOString()
        };

        // Save local sandbox state variables
        localStorage.setItem('rc_school', JSON.stringify(schoolData));
        localStorage.setItem('rc_profiles', JSON.stringify([adminProfile]));
        localStorage.setItem('rc_classes', JSON.stringify([]));
        localStorage.setItem('rc_class_teachers', JSON.stringify([]));
        localStorage.setItem('rc_students', JSON.stringify([]));
        localStorage.setItem('rc_attendance_records', JSON.stringify([]));
        localStorage.setItem('rc_subjects', JSON.stringify([]));
        localStorage.setItem('rc_assessment_configs', JSON.stringify([]));
        localStorage.setItem('rc_student_scores', JSON.stringify([]));
        localStorage.setItem('rc_term_fees_configs', JSON.stringify([]));
        localStorage.setItem('rc_student_term_registrations', JSON.stringify([]));
        localStorage.setItem('rollcall_is_offline', 'true');
        localStorage.setItem('rollcall_offline_role', 'admin');

        setCurrentUser({ uid: demoAdminUid, email: regAdminEmail } as any);
        setCurrentSchool(schoolData);
        setCurrentProfile(adminProfile);
        setCurrentTerm('First Term 2026/2027');
        syncOfflineDataToState();

        setStatusFeedback({
          type: 'success',
          msg: `Offline Registration Successful: welcome to ${regSchoolName}!`
        });
        setIsRegisteringSchool(false);
        setIsAuthLoading(false);
        return;
      }

      // Live registration via Auth setup
      let credential;
      try {
        credential = await createUserWithEmailAndPassword(auth, regAdminEmail.trim(), regAdminPassword);
      } catch (authErr: any) {
        console.warn("Live Firebase registration failed, checking for unconfigured database fallback...", authErr);
        const errMsg = authErr.message || '';
        const errCode = authErr.code || '';
        
        // Detect invalid api-keys or unconfigured Firebase environments
        if (
          errCode.includes('api-key-not-valid') || 
          errCode.includes('invalid-api-key') || 
          errCode.includes('configuration-not-found') || 
          errCode.includes('operation-not-allowed') || 
          errMsg.includes('api-key-not-valid') || 
          errMsg.includes('API key') ||
          errMsg.includes('Firebase')
        ) {
          console.warn("Self-healing: Fresh Firebase environment detected. Auto-activating local Sandbox Register.");
          
          const newSchoolId = 'school_' + Date.now();
          const demoAdminUid = 'admin_' + Date.now();

          const schoolData: School = {
            id: newSchoolId,
            name: regSchoolName,
            address: regSchoolAddress || 'Nigeria',
            phone: regSchoolPhone || '',
            contactEmail: regSchoolContactEmail,
            terms: ['First Term 2026/2027'],
            termConfigs: {
              'First Term 2026/2027': {
                startMonth: 'September',
                endMonth: 'December',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              }
            },
            paymentStatus: {},
            tier: regSchoolTier,
            created_at: new Date().toISOString()
          };

          const adminProfile: Profile = {
            id: demoAdminUid,
            school_id: newSchoolId,
            full_name: regAdminName,
            email: regAdminEmail.toLowerCase(),
            role: 'admin',
            created_at: new Date().toISOString()
          };

          // Save local sandbox state variables
          localStorage.setItem('rc_school', JSON.stringify(schoolData));
          localStorage.setItem('rc_profiles', JSON.stringify([adminProfile]));
          localStorage.setItem('rc_classes', JSON.stringify([]));
          localStorage.setItem('rc_class_teachers', JSON.stringify([]));
          localStorage.setItem('rc_students', JSON.stringify([]));
          localStorage.setItem('rc_attendance_records', JSON.stringify([]));
          localStorage.setItem('rc_subjects', JSON.stringify([]));
          localStorage.setItem('rc_assessment_configs', JSON.stringify([]));
          localStorage.setItem('rc_student_scores', JSON.stringify([]));
          localStorage.setItem('rc_term_fees_configs', JSON.stringify([]));
          localStorage.setItem('rc_student_term_registrations', JSON.stringify([]));
          localStorage.setItem('rollcall_is_offline', 'true');
          localStorage.setItem('rollcall_offline_role', 'admin');

          setIsOfflineMode(true);
          setCurrentUser({ uid: demoAdminUid, email: regAdminEmail } as any);
          setCurrentSchool(schoolData);
          setCurrentProfile(adminProfile);
          setCurrentTerm('First Term 2026/2027');
          syncOfflineDataToState();

          setStatusFeedback({
            type: 'success',
            msg: `Registered Successfully in Offline Sandbox! (Live database auth is not yet active on this deployment).`
          });
          setShowDashboard(true);
          setIsRegisteringSchool(false);
          setIsAuthLoading(false);
          return;
        } else {
          throw authErr;
        }
      }

      const user = credential.user;
      const newSchoolId = 'school_' + user.uid.slice(0, 8) + '_' + Math.random().toString(36).substring(2, 6);

      const schoolData: School = {
        id: newSchoolId,
        name: regSchoolName,
        address: regSchoolAddress || 'Nigeria',
        phone: regSchoolPhone || '',
        contactEmail: regSchoolContactEmail,
        terms: ['First Term 2026/2027'],
        termConfigs: {
          'First Term 2026/2027': {
            startMonth: 'September',
            endMonth: 'December',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        },
        paymentStatus: {},
        tier: regSchoolTier,
        created_at: new Date().toISOString()
      };

      const adminProfile: Profile = {
        id: user.uid,
        school_id: newSchoolId,
        full_name: regAdminName,
        email: regAdminEmail.toLowerCase(),
        role: 'admin',
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'schools', newSchoolId), schoolData);
      await setDoc(doc(db, 'profiles', user.uid), adminProfile);

      // Seed small sample classes & subjects to welcome the school
      const defaultClasses = ['JS 1A', 'JS 1B', 'SS 1 Science'];
      for (const clsName of defaultClasses) {
        const classId = 'class_' + Math.random().toString(36).substring(2, 8);
        await setDoc(doc(db, 'classes', classId), {
          id: classId,
          school_id: newSchoolId,
          name: clsName,
          created_at: new Date().toISOString()
        });
      }

      const defaultSubjects = ['Mathematics', 'English Language', 'Basic Science'];
      for (const subName of defaultSubjects) {
        const subId = 'subject_' + Math.random().toString(36).substring(2, 8);
        await setDoc(doc(db, 'subjects', subId), {
          id: subId,
          school_id: newSchoolId,
          name: subName,
          created_at: new Date().toISOString()
        });
      }

      setCurrentUser(user);
      setCurrentSchool(schoolData);
      setCurrentProfile(adminProfile);
      setCurrentTerm('First Term 2026/2027');

      setStatusFeedback({
        type: 'success',
        msg: `School Registered Successfully! Welcome to ${regSchoolName} Proprietor Portal.`
      });
      setShowDashboard(true);
      setIsRegisteringSchool(false);
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('api-key-not-valid') || errMsg.includes('API key') || errMsg.includes('Firebase') || errMsg.includes('key')) {
        console.warn("Registration failed due to configuration issue (this is expected in sandbox environment):", err);
      } else {
        console.error("Registration failed:", err);
      }
      
      // Secondary absolute fallback check to allow continuous trial testing
      if (errMsg.includes('api-key-not-valid') || errMsg.includes('API key') || errMsg.includes('Firebase') || errMsg.includes('key')) {
        setAuthError(`Firebase credentials issue: ${errMsg}. We have enabled 'Sandbox Mode' fallback; click the orange button above the inputs or toggle Sandbox to proceed instantly with localized registers!`);
      } else {
        setAuthError(err.message || 'Verification Error during registration.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handlePaySubscription = async (termToPay: string, paymentRecord?: SubscriptionPaymentRecord) => {
    if (!currentSchool) return;
    setIsAuthLoading(true);
    try {
      const updatedPaymentStatus = {
        ...(currentSchool.paymentStatus || {}),
        [termToPay]: 'paid'
      };

      const newRecord: SubscriptionPaymentRecord = paymentRecord || {
        id: `pstk_${Date.now()}`,
        reference: `pstk_rc_${Date.now()}`,
        amount: 20000,
        term: termToPay,
        paid_at: new Date().toISOString(),
        channel: 'paystack_direct',
        customer_email: currentProfile?.email || 'admin@klaso.edu.ng',
        status: 'success'
      };

      const updatedPayments = [
        ...(currentSchool.subscriptionPayments || []),
        newRecord
      ];

      if (isOfflineMode) {
        const updatedSchool = {
          ...currentSchool,
          paymentStatus: updatedPaymentStatus,
          subscriptionPayments: updatedPayments,
          tier: 'premium' as const
        };
        localStorage.setItem('rc_school', JSON.stringify(updatedSchool));
        setCurrentSchool(updatedSchool);
        setStatusFeedback({
          type: 'success',
          msg: `₦20,000 Payment via Paystack Confirmed (Ref: ${newRecord.reference})! ${termToPay} is unlocked and ${currentSchool.name} is upgraded to Premium.`
        });
        setIsAuthLoading(false);
        return;
      }

      const schoolRef = doc(db, 'schools', currentSchool.id);
      await updateDoc(schoolRef, {
        paymentStatus: updatedPaymentStatus,
        subscriptionPayments: updatedPayments,
        tier: 'premium'
      });

      const updatedSchool: School = {
        ...currentSchool,
        paymentStatus: updatedPaymentStatus,
        subscriptionPayments: updatedPayments,
        tier: 'premium'
      };
      setCurrentSchool(updatedSchool);

      setStatusFeedback({
        type: 'success',
        msg: `₦20,000 Payment via Paystack Confirmed (Ref: ${newRecord.reference})! ${termToPay} is unlocked and ${currentSchool.name} is upgraded to Premium.`
      });
    } catch (err: any) {
      console.error("Paystack subscription payment failed:", err);
      setStatusFeedback({
        type: 'err',
        msg: `Paystack transaction update failed: ${err.message || 'unknown gateway error'}`
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (isOfflineMode) {
        setIsOfflineMode(false);
        localStorage.removeItem('rollcall_is_offline');
        localStorage.removeItem('rollcall_offline_role');
      } else {
        await signOut(auth);
      }
      setClasses([]);
      setCurrentProfile(null);
      setCurrentSchool(null);
      setShowDashboard(false);
      setShowAuthPortal(false);
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  // 5. ATTENDANCE SUBMISSION ENGINE
  const handleMarkByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !activeClass) return;

    if (isInputLockedForTeacher) {
      setStatusFeedback({
        type: 'err',
        msg: `Forbidden: This academic session is completed & locked. Teachers can no longer register scores or mark attendance.`
      });
      setCodeInputValue('');
      return;
    }

    const trimmedCode = codeInputValue.trim().toUpperCase();
    if (!trimmedCode) return;

    // Search for a student matching this code within ONLY the selected class
    const studentMatch = students.find(
      s => s.class_id === selectedClassId && s.code === trimmedCode
    );

    if (!studentMatch) {
      setStatusFeedback({
        type: 'err',
        msg: `Code [${trimmedCode}] does not exist in ${activeClass.name}. Please verify student ID badge.`
      });
      setCodeInputValue('');
      return;
    }

    const recId = `${studentMatch.id}_${currentTerm.replace(/[\s/]+/g, '_')}_${currentDate}`;
    const isExist = attendanceRecords.some(r => r.id === recId);
    const recordData: AttendanceRecord = {
      id: recId,
      school_id: currentProfile.school_id,
      class_id: selectedClassId,
      student_id: studentMatch.id,
      term: currentTerm,
      date: currentDate,
      status: codeMode,
      marked_by: currentProfile.id,
      created_at: new Date().toISOString()
    };

    if (isOfflineMode) {
      const records = [...attendanceRecords];
      const index = records.findIndex(r => r.id === recId);
      if (index > -1) {
        records[index] = recordData;
      } else {
        records.push(recordData);
      }
      saveOfflineItem('rc_attendance_records', records);

      setStatusFeedback({
        type: isExist ? 'info' : 'success',
        msg: isExist
          ? `Updated: ${studentMatch.name} [${trimmedCode}] is now ${codeMode === 'early' ? 'On Time' : 'Late'}.`
          : `Success: Marked ${studentMatch.name} [${trimmedCode}] as ${codeMode === 'early' ? 'On Time' : 'Late'}.`
      });
      setCodeInputValue('');
      return;
    }

    try {
      await setDoc(doc(db, 'attendance_records', recId), recordData);

      setStatusFeedback({
        type: isExist ? 'info' : 'success',
        msg: isExist
          ? `Updated: ${studentMatch.name} [${trimmedCode}] is now ${codeMode === 'early' ? 'On Time' : 'Late'}.`
          : `Success: Marked ${studentMatch.name} [${trimmedCode}] as ${codeMode === 'early' ? 'On Time' : 'Late'}.`
      });

      setCodeInputValue('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `attendance_records/${trimmedCode}`);
    }
  };

  // 6. QUICK ACTIONS - Manual Tick & Undo
  const handleQuickMark = async (studentId: string, status: 'early' | 'late') => {
    if (!currentProfile || !selectedClassId) return;

    if (isInputLockedForTeacher) {
      setStatusFeedback({
        type: 'err',
        msg: `Forbidden: This academic session is completed & locked. Teachers can no longer register scores or mark attendance.`
      });
      return;
    }

    const recId = `${studentId}_${currentTerm.replace(/[\s/]+/g, '_')}_${currentDate}`;
    const isExist = attendanceRecords.some(r => r.id === recId);
    const recordData: AttendanceRecord = {
      id: recId,
      school_id: currentProfile.school_id,
      class_id: selectedClassId,
      student_id: studentId,
      term: currentTerm,
      date: currentDate,
      status: status,
      marked_by: currentProfile.id,
      created_at: new Date().toISOString()
    };

    if (isOfflineMode) {
      const records = [...attendanceRecords];
      const index = records.findIndex(r => r.id === recId);
      if (index > -1) {
        records[index] = recordData;
      } else {
        records.push(recordData);
      }
      saveOfflineItem('rc_attendance_records', records);

      const studentName = students.find(s => s.id === studentId)?.name || 'Student';
      setStatusFeedback({
        type: isExist ? 'info' : 'success',
        msg: isExist
          ? `Updated: Marked ${studentName} as ${status === 'early' ? 'On Time' : 'Late'}.`
          : `Marked: ${studentName} is ${status === 'early' ? 'On Time' : 'Late'}.`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'attendance_records', recId), recordData);

      const studentName = students.find(s => s.id === studentId)?.name || 'Student';
      setStatusFeedback({
        type: isExist ? 'info' : 'success',
        msg: isExist
          ? `Updated: Marked ${studentName} as ${status === 'early' ? 'On Time' : 'Late'}.`
          : `Marked: ${studentName} is ${status === 'early' ? 'On Time' : 'Late'}.`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `attendance_records/${studentId}`);
    }
  };

  const handleUndoMark = async (studentId: string) => {
    if (!currentProfile) return;

    if (isInputLockedForTeacher) {
      setStatusFeedback({
        type: 'err',
        msg: `Forbidden: This academic session is completed & locked. Teachers can no longer register scores or mark attendance.`
      });
      return;
    }

    const recId = `${studentId}_${currentTerm.replace(/[\s/]+/g, '_')}_${currentDate}`;

    if (isOfflineMode) {
      const records = attendanceRecords.filter(r => r.id !== recId);
      saveOfflineItem('rc_attendance_records', records);
      const studentName = students.find(s => s.id === studentId)?.name || 'Student';
      setStatusFeedback({
        type: 'info',
        msg: `Removed check-in record for ${studentName} today.`
      });
      return;
    }

    try {
      await deleteDoc(doc(db, 'attendance_records', recId));
      
      const studentName = students.find(s => s.id === studentId)?.name || 'Student';
      setStatusFeedback({
        type: 'info',
        msg: `Removed check-in record for ${studentName} today.`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `attendance_records/${studentId}`);
    }
  };

  // 7. ROSTER & MANAGEMENT ACTIONS (Admin Only)
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !newClassName.trim()) return;

    const classId = `class_${Date.now()}`;
    const classData: Class = {
      id: classId,
      school_id: currentProfile.school_id,
      name: newClassName.trim(),
      created_at: new Date().toISOString()
    };

    if (isOfflineMode) {
      const list = [...classes, classData];
      saveOfflineItem('rc_classes', list);
      setNewClassName('');
      setSelectedClassId(classId);
      setStatusFeedback({
        type: 'success',
        msg: `Class [${newClassName.trim()}] was successfully created!`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'classes', classId), classData);
      setNewClassName('');
      setSelectedClassId(classId);
      setStatusFeedback({
        type: 'success',
        msg: `Class [${newClassName.trim()}] was successfully created!`
      });
    } catch (err) {
      console.warn("Creating class online failed. Auto-saved to Sandbox instead.", err);
      const list = [...classes, classData];
      saveOfflineItem('rc_classes', list);
      setIsOfflineMode(true);
      localStorage.setItem('rollcall_is_offline', 'true');
      setNewClassName('');
      setSelectedClassId(classId);
      setStatusFeedback({
        type: 'success',
        msg: `Class [${newClassName.trim()}] saved locally to Sandbox! Remote database is unconfigured.`
      });
    }
  };

  const findDuplicateStudent = (name: string, email?: string, phone?: string) => {
    if (!name.trim()) return null;
    const trimmedInputName = name.trim().toLowerCase();
    const cleanInputEmail = email?.trim().toLowerCase();
    const cleanInputPhone = phone?.trim().replace(/\s+/g, '');

    return students.find(s => {
      // 1. Exact name match (case insensitive)
      const existingName = s.name.trim().toLowerCase();
      if (existingName === trimmedInputName) {
        return true;
      }
      // 2. Email match if both are present
      if (cleanInputEmail && s.email) {
        const existingEmail = s.email.trim().toLowerCase();
        if (existingEmail === cleanInputEmail) {
          return true;
        }
      }
      // 3. Phone match if both are present
      if (cleanInputPhone && s.phone) {
        const existingPhone = s.phone.trim().replace(/\s+/g, '');
        if (existingPhone === cleanInputPhone) {
          return true;
        }
      }
      return false;
    });
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !selectedClassId || !newStudentName.trim()) return;

    // Check duplicate first
    const duplicate = findDuplicateStudent(newStudentName, newStudentEmail);
    if (duplicate) {
      const dupClass = classes.find(c => c.id === duplicate.class_id)?.name || 'another class';
      const proceed = window.confirm(
        `🚨 WARNING: DETECTED DUPLICATE PROFILE\n\n` +
        `A student named "${duplicate.name}" is already registered in class "${dupClass}" [Code: ${duplicate.code}].\n\n` +
        `Are you sure you want to register them anyway? This will result in double-registration entries.`
      );
      if (!proceed) return;
    }

    // Get count of existing students in this specific class to generate next sequence
    const classStudentsCount = students.filter(s => s.class_id === selectedClassId).length;
    const autoCode = generateStudentCode(activeClass?.name || 'CLS', classStudentsCount);
    const studentId = `stud_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const studentData: Student = cleanObject({
      id: studentId,
      school_id: currentProfile.school_id,
      class_id: selectedClassId,
      name: newStudentName.trim(),
      code: autoCode,
      email: newStudentEmail.trim() || undefined,
      created_at: new Date().toISOString()
    });

    if (isOfflineMode) {
      const list = [...students, studentData];
      saveOfflineItem('rc_students', list);
      setNewStudentName('');
      setNewStudentEmail('');
      setStatusFeedback({
        type: 'success',
        msg: `Added: ${newStudentName.trim()} assigned code [${autoCode}].`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'students', studentId), studentData);
      setNewStudentName('');
      setNewStudentEmail('');
      setStatusFeedback({
        type: 'success',
        msg: `Added: ${newStudentName.trim()} assigned code [${autoCode}].`
      });
    } catch (err) {
      console.warn("Adding student online failed. Auto-saved to Sandbox instead.", err);
      const list = [...students, studentData];
      saveOfflineItem('rc_students', list);
      setIsOfflineMode(true);
      localStorage.setItem('rollcall_is_offline', 'true');
      setNewStudentName('');
      setNewStudentEmail('');
      setStatusFeedback({
        type: 'success',
        msg: `Added (Sandbox Mode): ${newStudentName.trim()} assigned code [${autoCode}].`
      });
    }
  };

  const handleCreateDetailedStudent = async (
    name: string,
    email: string,
    phone: string,
    passportBase64: string,
    studentType: 'new' | 'returning',
    targetClassId: string,
    registerCurrentTerm: boolean,
    firstInstallmentAmount: number,
    termNote: string
  ) => {
    if (!currentProfile || !targetClassId || !name.trim()) return;

    // Check duplicate first
    const duplicate = findDuplicateStudent(name, email, phone);
    if (duplicate) {
      const dupClass = classes.find(c => c.id === duplicate.class_id)?.name || 'another class';
      const proceed = window.confirm(
        `🚨 WARNING: DETECTED DUPLICATE PROFILE\n\n` +
        `A student named "${duplicate.name}" is already registered in class "${dupClass}" [Code: ${duplicate.code}].\n\n` +
        `Are you sure you want to register them anyway? This will result in double-registration entries.`
      );
      if (!proceed) return;
    }

    const classStudentsCount = students.filter(s => s.class_id === targetClassId).length;
    const targetClass = classes.find(c => c.id === targetClassId);
    const autoCode = generateStudentCode(targetClass?.name || 'CLS', classStudentsCount);
    const studentId = `stud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const studentData: Student = cleanObject({
      id: studentId,
      school_id: currentProfile.school_id,
      class_id: targetClassId,
      name: name.trim(),
      code: autoCode,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      passportUrl: passportBase64 || undefined,
      studentType: studentType,
      created_at: new Date().toISOString()
    });

    // If immediate term registration requested, construct registration state item
    let regData: StudentTermRegistration | null = null;
    if (registerCurrentTerm && currentTerm) {
      // Find term fees config, or default
      const feesConfig = termFeesConfigs.find(
        f => f.school_id === currentProfile.school_id && f.term === currentTerm
      );
      const totalFee = feesConfig 
        ? (studentType === 'new' ? feesConfig.newStudentFee : feesConfig.returningStudentFee)
        : (studentType === 'new' ? 150000 : 100000);

      const paymentsList = [];
      if (firstInstallmentAmount > 0) {
        paymentsList.push({
          id: `pay_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          amount: firstInstallmentAmount,
          reference: `REG-PAY-${Date.now().toString().slice(-6)}`,
          notes: 'First installment during detailed registration'
        });
      }

      const status = firstInstallmentAmount >= totalFee 
        ? 'paid' 
        : (firstInstallmentAmount > 0 ? 'partial' : 'unpaid');

      regData = cleanObject({
        id: `${currentProfile.school_id}_${currentTerm}_${studentId}`,
        school_id: currentProfile.school_id,
        term: currentTerm,
        student_id: studentId,
        studentType: studentType,
        addedToNameNote: (termNote || '').trim() || undefined,
        totalFee: totalFee,
        paidAmount: firstInstallmentAmount,
        status: status,
        payments: paymentsList,
        created_at: new Date().toISOString()
      });
    }

    if (isOfflineMode) {
      const list = [...students, studentData];
      saveOfflineItem('rc_students', list);
      if (regData) {
        const regsList = [...studentTermRegistrations, regData];
        saveOfflineItem('rc_student_term_registrations', regsList);
      }
      setStatusFeedback({
        type: 'success',
        msg: `Added: ${name.trim()} dynamically with sequence [${autoCode}].`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'students', studentId), studentData);
      if (regData) {
        await setDoc(doc(db, 'student_term_registrations', regData.id), regData);
      }
      setStatusFeedback({
        type: 'success',
        msg: `Added: ${name.trim()} dynamically with sequence [${autoCode}].`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'students');
    }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${studentName}? Historical attendance records remain stored safely.`)) {
      return;
    }

    if (isOfflineMode) {
      const list = students.filter(s => s.id !== studentId);
      saveOfflineItem('rc_students', list);
      setStatusFeedback({
        type: 'info',
        msg: `Removed ${studentName} from school roster.`
      });
      return;
    }

    try {
      await deleteDoc(doc(db, 'students', studentId));
      setStatusFeedback({
        type: 'info',
        msg: `Removed ${studentName} from school roster.`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${studentId}`);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !editingStudent) return;

    const updatedStudent: Student = cleanObject({
      ...editingStudent,
      name: editStudentName.trim(),
      email: editStudentEmail.trim() || undefined,
      phone: editStudentPhone.trim() || undefined,
      passportUrl: editStudentPassport || undefined,
      studentType: editStudentType
    });

    if (isOfflineMode) {
      const list = students.map(s => s.id === editingStudent.id ? updatedStudent : s);
      saveOfflineItem('rc_students', list);
      setEditingStudent(null);
      setEditStudentName('');
      setEditStudentEmail('');
      setEditStudentPhone('');
      setEditStudentPassport('');
      setEditStudentType('returning');
      setStatusFeedback({
        type: 'success',
        msg: `Successfully updated pupil ${updatedStudent.name}!`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'students', editingStudent.id), updatedStudent);
      setEditingStudent(null);
      setEditStudentName('');
      setEditStudentEmail('');
      setEditStudentPhone('');
      setEditStudentPassport('');
      setEditStudentType('returning');
      setStatusFeedback({
        type: 'success',
        msg: `Successfully updated pupil ${updatedStudent.name}!`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `students/${editingStudent.id}`);
    }
  };

  const handleAddTeacherToClass = async (teacherId: string) => {
    if (!currentProfile || !selectedClassId) return;

    const assignmentId = `${selectedClassId}_${teacherId}`;
    const assignData: ClassTeacherAssignment = {
      id: assignmentId,
      class_id: selectedClassId,
      teacher_id: teacherId,
      school_id: currentProfile.school_id,
      created_at: new Date().toISOString()
    };

    // Auto-generate teacher login credentials if not already generated
    const teacherProfile = allProfilesInSchool.find(p => p.id === teacherId);
    let generatedPass = teacherProfile?.generated_password;
    
    if (teacherProfile && !generatedPass) {
      const cleanFirstName = teacherProfile.full_name.trim().split(' ')[0].replace(/[^a-zA-Z]/g, '');
      generatedPass = `Klaso@${cleanFirstName || 'Teacher'}${Math.floor(100 + Math.random() * 900)}`;
      
      const updatedProfile: Profile = {
        ...teacherProfile,
        generated_password: generatedPass
      };

      if (isOfflineMode) {
        const list = allProfilesInSchool.map(p => p.id === teacherId ? updatedProfile : p);
        saveOfflineItem('rc_profiles', list);
      } else {
        try {
          await setDoc(doc(db, 'profiles', teacherId), updatedProfile);
        } catch (err) {
          console.error('Error auto-generating teacher credentials profile:', err);
        }
      }
    }

    if (teacherProfile && generatedPass) {
      setLastGeneratedCredentials({
        name: teacherProfile.full_name,
        email: teacherProfile.email,
        pass: generatedPass
      });
    }

    if (isOfflineMode) {
      const list = [...classAssignments, assignData];
      saveOfflineItem('rc_class_teachers', list);
      
      const teacherName = allProfilesInSchool.find(p => p.id === teacherId)?.full_name || 'Teacher';
      setStatusFeedback({
        type: 'success',
        msg: `Assigned: ${teacherName} is now a form teacher for ${activeClass?.name}. Credentials generated below!`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'class_teachers', assignmentId), assignData);
      
      const teacherName = allProfilesInSchool.find(p => p.id === teacherId)?.full_name || 'Teacher';
      setStatusFeedback({
        type: 'success',
        msg: `Assigned: ${teacherName} is now a form teacher for ${activeClass?.name}. Credentials generated below!`
      });
    } catch (err) {
      console.warn("Assigning teacher online failed. Auto-saved to Sandbox instead.", err);
      // Fallback
      const list = [...classAssignments, assignData];
      saveOfflineItem('rc_class_teachers', list);
      setIsOfflineMode(true);
      localStorage.setItem('rollcall_is_offline', 'true');

      const teacherName = allProfilesInSchool.find(p => p.id === teacherId)?.full_name || 'Teacher';
      setStatusFeedback({
        type: 'success',
        msg: `Assigned (Sandbox Mode)! Remote database was unconfigured, so we saved teacher ${teacherName} assignment to ${activeClass?.name} locally. Credentials generated below!`
      });
    }
  };

  const handleRemoveTeacherFromClass = async (teacherId: string) => {
    if (!currentProfile || !selectedClassId) return;
    const assignmentId = `${selectedClassId}_${teacherId}`;

    if (isOfflineMode) {
      const list = classAssignments.filter(a => a.id !== assignmentId);
      saveOfflineItem('rc_class_teachers', list);
      setStatusFeedback({
        type: 'info',
        msg: `Teacher is no longer assigned to this class.`
      });
      return;
    }

    try {
      await deleteDoc(doc(db, 'class_teachers', assignmentId));
      setStatusFeedback({
        type: 'info',
        msg: `Teacher is no longer assigned to this class.`
      });
    } catch (err) {
      console.warn("Removing teacher online failed. Auto-saved to Sandbox instead.", err);
      // Fallback
      const list = classAssignments.filter(a => a.id !== assignmentId);
      saveOfflineItem('rc_class_teachers', list);
      setIsOfflineMode(true);
      localStorage.setItem('rollcall_is_offline', 'true');
      setStatusFeedback({
        type: 'info',
        msg: `Teacher is no longer assigned to this class (Sandbox updated).`
      });
    }
  };

  const handleAddNewTeacherProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !newTeacherName.trim() || !newTeacherEmail.trim()) return;

    const newTeacherUid = `profile_t_${Date.now()}`;
    const cleanFirstName = newTeacherName.trim().split(' ')[0].replace(/[^a-zA-Z]/g, '');
    const generatedPass = `Klaso@${cleanFirstName || 'Teacher'}${Math.floor(100 + Math.random() * 900)}`;

    const teacherData: Profile = {
      id: newTeacherUid,
      school_id: currentProfile.school_id,
      full_name: newTeacherName.trim(),
      email: newTeacherEmail.trim().toLowerCase(),
      role: 'teacher',
      generated_password: generatedPass,
      created_at: new Date().toISOString()
    };

    if (isOfflineMode) {
      const list = [...allProfilesInSchool, teacherData];
      saveOfflineItem('rc_profiles', list);

      setLastGeneratedCredentials({
        name: teacherData.full_name,
        email: teacherData.email,
        pass: generatedPass
      });

      setStatusFeedback({
        type: 'success',
        msg: `Profile created! Mrs/Mr ${newTeacherName} can now log in using email: ${newTeacherEmail.trim()} and Password: ${generatedPass}`
      });
      setNewTeacherName('');
      setNewTeacherEmail('');
      setShowAddTeacherModal(false);
      return;
    }

    try {
      await setDoc(doc(db, 'profiles', newTeacherUid), teacherData);

      setLastGeneratedCredentials({
        name: teacherData.full_name,
        email: teacherData.email,
        pass: generatedPass
      });

      setStatusFeedback({
        type: 'success',
        msg: `Profile created! Mrs/Mr ${newTeacherName} can now log in using email: ${newTeacherEmail.trim()} and Password: ${generatedPass}`
      });
      setNewTeacherName('');
      setNewTeacherEmail('');
      setShowAddTeacherModal(false);
    } catch (err) {
      console.warn("Adding teacher online failed. Auto-saved to Sandbox instead.", err);
      // Fallback to offline store
      const list = [...allProfilesInSchool, teacherData];
      saveOfflineItem('rc_profiles', list);
      setIsOfflineMode(true);
      localStorage.setItem('rollcall_is_offline', 'true');

      setLastGeneratedCredentials({
        name: teacherData.full_name,
        email: teacherData.email,
        pass: generatedPass
      });

      setStatusFeedback({
        type: 'success',
        msg: `Saved to Sandbox Mode! Remote database was unconfigured, so we saved teacher ${newTeacherName} locally. Login Email: ${newTeacherEmail.trim()} | Password: ${generatedPass}`
      });
      setNewTeacherName('');
      setNewTeacherEmail('');
      setShowAddTeacherModal(false);
    }
  };

  const handleAddTermLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !currentSchool || !newTermName.trim()) return;

    // Check duplicate term
    if (currentSchool.terms.includes(newTermName.trim())) {
      alert('This term already exists in your school catalog!');
      return;
    }

    if (isOfflineMode) {
      const updatedTerms = [...currentSchool.terms, newTermName.trim()];
      const schoolData: School = {
        ...currentSchool,
        terms: updatedTerms
      };
      localStorage.setItem('rc_school', JSON.stringify(schoolData));
      setCurrentSchool(schoolData);
      setCurrentTerm(newTermName.trim());
      setNewTermName('');
      setShowAddTermModal(false);
      setStatusFeedback({
        type: 'success',
        msg: `Synchronized: Added term [${newTermName.trim()}].`
      });
      return;
    }

    try {
      const updatedTerms = [...currentSchool.terms, newTermName.trim()];
      const schoolData = {
        ...currentSchool,
        terms: updatedTerms
      };
      await setDoc(doc(db, 'schools', currentSchool.id), schoolData);

      setCurrentSchool(schoolData);
      setCurrentTerm(newTermName.trim());
      setNewTermName('');
      setShowAddTermModal(false);
      setStatusFeedback({
        type: 'success',
        msg: `Synchronized: Added term [${newTermName.trim()}].`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schools/${currentSchool.id}`);
    }
  };

  const handleUpdateTermConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !currentSchool || !calendarSelectedTerm) return;

    const termConfig = {
      startMonth: termStartMonth,
      endMonth: termEndMonth,
      startDate: termStartDate,
      endDate: termEndDate,
    };

    const currentConfigs = currentSchool.termConfigs || {};
    const updatedConfigs = {
      ...currentConfigs,
      [calendarSelectedTerm]: termConfig,
    };

    const schoolData: School = {
      ...currentSchool,
      termConfigs: updatedConfigs,
    };

    if (isOfflineMode) {
      localStorage.setItem('rc_school', JSON.stringify(schoolData));
      setCurrentSchool(schoolData);
      setStatusFeedback({
        type: 'success',
        msg: `Term calendar parameters updated for "${calendarSelectedTerm}"!`
      });
      setShowAddTermModal(false);
      return;
    }

    try {
      await setDoc(doc(db, 'schools', currentSchool.id), schoolData);
      setCurrentSchool(schoolData);
      setStatusFeedback({
        type: 'success',
        msg: `Term calendar parameters updated for "${calendarSelectedTerm}"!`
      });
      setShowAddTermModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schools/${currentSchool.id}`);
    }
  };

  useEffect(() => {
    const wasOpen = prevAddTermModalRef.current;
    prevAddTermModalRef.current = showAddTermModal;

    if (showAddTermModal && !wasOpen && currentSchool) {
      const defaultTerm = currentTerm || currentSchool.terms[0] || '';
      setCalendarSelectedTerm(defaultTerm);
      const config = currentSchool.termConfigs?.[defaultTerm];
      if (config) {
        setTermStartMonth(config.startMonth || 'January');
        setTermEndMonth(config.endMonth || 'April');
        setTermStartDate(config.startDate || '');
        setTermEndDate(config.endDate || '');
      } else {
        setTermStartMonth('January');
        setTermEndMonth('April');
        setTermStartDate('');
        setTermEndDate('');
      }
    }
  }, [showAddTermModal, currentTerm, currentSchool]);

  const handleCalendarTermChange = (term: string) => {
    setCalendarSelectedTerm(term);
    const config = currentSchool?.termConfigs?.[term];
    if (config) {
      setTermStartMonth(config.startMonth || 'January');
      setTermEndMonth(config.endMonth || 'April');
      setTermStartDate(config.startDate || '');
      setTermEndDate(config.endDate || '');
    } else {
      setTermStartMonth('January');
      setTermEndMonth('April');
      setTermStartDate('');
      setTermEndDate('');
    }
  };

  // 8. REPORT GENERATOR LOGIC
  // Calculate distinct dates with at least ONE attendance record for this class & term
  const activeClassRecords = attendanceRecords.filter(
    r => r.class_id === selectedClassId && r.term === currentTerm
  );
  
  const distinctDates = Array.from(
    new Set(activeClassRecords.map(r => r.date))
  ).sort();
  
  const sessionsHeldCount = distinctDates.length;

  const activeClassStudents = students.filter(s => s.class_id === selectedClassId);

  const reportRows: StudentReportRow[] = activeClassStudents.map(student => {
    return calculateStudentStats(student, activeClassRecords, sessionsHeldCount);
  });

  const handleExportCSV = () => {
    if (!activeClass || reportRows.length === 0) return;
    downloadCSV(activeClass.name, currentTerm, reportRows);
    setStatusFeedback({
      type: 'success',
      msg: `Report downloaded successfully as CSV config.`
    });
  };

  const handleExportPDF = () => {
    if (!activeClass || reportRows.length === 0 || !currentSchool) return;
    downloadPDF(currentSchool.name, activeClass.name, currentTerm, reportRows, currentSchool.badgeUrl || currentSchool.logoUrl);
    setStatusFeedback({
      type: 'success',
      msg: `Report downloaded successfully as PDF file.`
    });
  };

  const handleSaveSchoolBadge = async (badgeUrlToSave: string) => {
    if (!currentSchool) return;
    const updatedSchool: School = {
      ...currentSchool,
      badgeUrl: badgeUrlToSave,
      logoUrl: badgeUrlToSave,
      address: schoolAddressInput.trim() || currentSchool.address,
      phone: schoolPhoneInput.trim() || currentSchool.phone,
    };

    if (isOfflineMode) {
      localStorage.setItem('rc_school', JSON.stringify(updatedSchool));
      setCurrentSchool(updatedSchool);
      setShowSchoolBadgeModal(false);
      setStatusFeedback({
        type: 'success',
        msg: 'School badge & branding synced across all document templates.'
      });
      return;
    }

    try {
      await setDoc(doc(db, 'schools', currentSchool.id), updatedSchool, { merge: true });
      setCurrentSchool(updatedSchool);
      setShowSchoolBadgeModal(false);
      setStatusFeedback({
        type: 'success',
        msg: 'School badge & branding synced across all document templates.'
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `schools/${currentSchool.id}`);
    }
  };

  const handleResetAllLists = async () => {
    if (!currentProfile || currentProfile.role !== 'admin') return;

    const confirmReset = window.confirm(
      "CONFIRM REGISTRY RESET:\n\nAre you sure you want to permanently delete all registry lists (classes, students, attendance records, academic subjects, and student grades) to start completely fresh?\n\nThis action cannot be undone."
    );
    if (!confirmReset) return;

    try {
      if (isOfflineMode) {
        localStorage.setItem('rc_classes', JSON.stringify([]));
        localStorage.setItem('rc_class_teachers', JSON.stringify([]));
        localStorage.setItem('rc_students', JSON.stringify([]));
        localStorage.setItem('rc_attendance_records', JSON.stringify([]));
        localStorage.setItem('rc_subjects', JSON.stringify([]));
        localStorage.setItem('rc_assessment_configs', JSON.stringify([]));
        localStorage.setItem('rc_student_scores', JSON.stringify([]));

        syncOfflineDataToState();
        setSelectedClassId('');
        
        setStatusFeedback({
          type: 'success',
          msg: 'Local Sandbox Registry has been successfully reset. Start clean!'
        });
      } else {
        setStatusFeedback({
          type: 'info',
          msg: 'Resetting cloud databases, please wait...'
        });

        const schoolId = currentProfile.school_id;

        const collectionsToClear = [
          'classes',
          'students',
          'attendance_records',
          'subjects',
          'assessment_configs',
          'student_scores',
          'class_teachers'
        ];

        for (const cName of collectionsToClear) {
          const q = query(collection(db, cName), where('school_id', '==', schoolId));
          const snap = await getDocs(q);
          for (const docSnap of snap.docs) {
            await deleteDoc(doc(db, cName, docSnap.id));
          }
        }

        setSelectedClassId('');
        setStatusFeedback({
          type: 'success',
          msg: 'Live Cloud Registry lists have been successfully reset. Start clean!'
        });
      }
    } catch (err: any) {
      console.error("Reset failed:", err);
      setStatusFeedback({
        type: 'err',
        msg: `Reset failed: ${err.message || 'database error'}`
      });
    }
  };

  // Show Homepage immediately if we are not inside the dashboard and not in the auth portal
  if (!showDashboard && !showAuthPortal) {
    return (
      <Homepage 
        isLoggedIn={authReady && !!(currentUser && currentProfile && currentSchool)}
        onOpenPortal={(mode, defaultTier) => {
          if (currentUser && currentProfile && currentSchool) {
            setShowDashboard(true);
          } else {
            setShowAuthPortal(true);
            setIsRegisteringSchool(mode === 'register');
            if (defaultTier) {
              setRegSchoolTier(defaultTier);
            }
          }
        }}
        onOpenDemo={async (role) => {
          if (currentUser && currentProfile && currentSchool) {
            setShowDashboard(true);
          } else {
            await handleDemoSignIn(role);
            setShowDashboard(true);
          }
        }}
      />
    );
  }

  // Helper renderer for login screen
  if (!authReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#FAF7F0]">
        <div className="text-center font-display">
          <ClipboardCheck className="mx-auto h-12 w-12 text-[#1B4332] animate-bounce" />
          <h2 className="mt-4 text-xl font-bold text-[#1B4332]">Loading Ledger Configuration...</h2>
          <p className="text-gray-500 text-sm mt-1">Authenticating with server endpoints</p>
        </div>
      </div>
    );
  }

  if (!showDashboard) {
    if (showAuthPortal && (!currentUser || !currentProfile || !currentSchool)) {
      return (
        <div className="min-h-screen bg-[#FAF7F0] py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden">
          
          <div className="bg-[#1B4332] py-6 px-6 text-center text-white relative">
            <div className="absolute top-4 right-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-2 py-0.5 rounded-full font-mono uppercase tracking-widest font-bold">
              v1.6
            </div>
            <ClipboardCheck className="mx-auto h-12 w-12 text-[#D4A017] stroke-[1.5]" />
            <h1 className="mt-2 text-2xl font-display font-extrabold tracking-tight">Klaso</h1>
            <p className="mt-1 text-stone-200 text-xs font-sans max-w-xs mx-auto">
              Digital School Operating System (SOS)
            </p>
          </div>

          {/* Core Tab Switcher */}
          <div className="flex border-b border-stone-200 bg-stone-50">
            <button
              onClick={() => { 
                setIsRegisteringSchool(false); 
                setAuthError(null); 
                setShowForgotPassword(false);
                setPasswordResetSuccess(null);
              }}
              className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
                !isRegisteringSchool 
                  ? 'border-b-2 border-[#1B4332] text-[#1B4332] bg-white font-semibold' 
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100/50'
              }`}
            >
              Sign In Portal
            </button>
            <button
              onClick={() => { 
                setIsRegisteringSchool(true); 
                setAuthError(null); 
                setShowForgotPassword(false);
                setPasswordResetSuccess(null);
              }}
              className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
                isRegisteringSchool 
                  ? 'border-b-2 border-[#1B4332] text-[#1B4332] bg-white font-semibold' 
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100/50'
              }`}
            >
              School Registration
            </button>
          </div>

          <div className="py-6 px-6 sm:px-10">
            {authError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3 flex flex-col space-y-2">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
                {(authError.includes('api-key-not-valid') || authError.includes('Firebase') || authError.includes('API key') || authError.includes('key') || authError.includes('auth/') || authError.includes('configuration-not-found')) && (
                  <div className="mt-1 pt-2 border-t border-red-200 text-xs text-red-950">
                    <p className="font-semibold">⚡ Unconfigured Cloud Database Found</p>
                    <p className="mt-1 text-stone-600 leading-relaxed text-[11px]">
                      Your Firebase project API keys are not valid or not yet enabled in the dashboard console. Click below to instantly activate local Offline Sandbox Mode (no configuration required!).
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOfflineMode(true);
                        localStorage.setItem('rollcall_is_offline', 'true');
                        setAuthError(null);
                        setStatusFeedback({
                          type: 'success',
                          msg: 'Offline Sandbox Mode Enabled! Try registering your school now.'
                        });
                      }}
                      className="mt-2 inline-flex items-center px-3 py-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded text-xs cursor-pointer shadow-xs border-0"
                    >
                      Enable Offline Sandbox Mode
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isRegisteringSchool ? (
              showForgotPassword ? (
                // FORGOT PASSWORD FORM
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-[#1B4332] leading-relaxed">
                    Enter your registered email address and we will send you a secure link to reset your password.
                  </div>

                  {passwordResetSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-[#1B4332] text-xs font-semibold rounded-lg p-3">
                      {passwordResetSuccess}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. mr.ogbuagu@school.edu"
                      className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] text-sm"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#1B4332] hover:bg-[#143225] focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-[#1B4332] transition-colors duration-150 cursor-pointer"
                  >
                    {isAuthLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setAuthError(null);
                        setPasswordResetSuccess(null);
                      }}
                      className="text-xs text-[#1B4332] hover:underline font-semibold cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              ) : (
                // SIGN IN FORM
                <form onSubmit={handleAuthLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. mr.ogbuagu@school.edu"
                      className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] text-sm"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setAuthError(null);
                          setPasswordResetSuccess(null);
                        }}
                        className="text-xs text-[#1B4332] hover:underline font-semibold cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] text-sm"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#1B4332] hover:bg-[#143225] focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-[#1B4332] transition-colors duration-150 cursor-pointer"
                  >
                    {isAuthLoading ? 'Syncing...' : 'Sign In to Portal'}
                  </button>
                </form>
              )
            ) : (
              // SCHOOL REGISTRATION FORM
              <form onSubmit={handleRegisterSchoolSubmit} className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-2xs text-[#1B4332] leading-relaxed mb-1">
                  <strong>School registration includes:</strong> Fill details, click submit, and your unique proprietor subscription account is generated. 1 month trial period is active!
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                    School Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Federal Government College, Abia"
                    className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] text-sm"
                    value={regSchoolName}
                    onChange={(e) => setRegSchoolName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                    Address / State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Umuahia, Abia State"
                    className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] text-sm"
                    value={regSchoolAddress}
                    onChange={(e) => setRegSchoolAddress(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                      Contact Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="contact@fgcabia.edu.ng"
                      className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] text-sm"
                      value={regSchoolContactEmail}
                      onChange={(e) => setRegSchoolContactEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                      School Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+234 803 123 4567"
                      className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] text-sm"
                      value={regSchoolPhone}
                      onChange={(e) => setRegSchoolPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">
                    Select School Subscription Plan
                  </label>
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setRegSchoolTier('free')}
                      className={`flex flex-col items-start p-3 text-left rounded-xl border text-xs gap-1 transition-all cursor-pointer ${
                        regSchoolTier === 'free'
                          ? 'border-[#1B4332] bg-[#1B4332]/5 ring-2 ring-[#1B4332]/20'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <strong className="text-stone-800 flex items-center space-x-1">
                        <span>Free Plan</span>
                      </strong>
                      <span className="text-stone-500 text-3xs font-mono leading-none">₦0 / term</span>
                      <span className="text-[10px] text-stone-600 mt-1 leading-snug">
                        Class attendance only. Perfect for simple registry logs.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegSchoolTier('premium')}
                      className={`flex flex-col items-start p-3 text-left rounded-xl border text-xs gap-1 transition-all cursor-pointer relative ${
                        regSchoolTier === 'premium'
                          ? 'border-[#1B4332] bg-[#1B4332]/5 ring-2 ring-[#1B4332]/20'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-[#D4A017] text-stone-950 font-bold uppercase rounded text-[8px] tracking-wider leading-none">Popular</span>
                      <strong className="text-[#1B4332] flex items-center space-x-1">
                        <span>Premium</span>
                      </strong>
                      <span className="text-[#D4A017] text-3xs font-mono font-bold leading-none">₦20,000 / term</span>
                      <span className="text-[10px] text-stone-600 mt-1 leading-snug">
                        Full Access. Unlock PDF analytics, continuous gradebooks, and billings.
                      </span>
                    </button>
                  </div>
                </div>

                <hr className="border-stone-200" />

                <div className="bg-stone-50 p-2.5 rounded border border-stone-200 space-y-3">
                  <h4 className="text-2xs font-bold text-stone-700 uppercase tracking-wider">
                    Proprietor / Administrator Login Setup
                  </h4>
                  
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 tracking-wide">
                      Admin Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Mr. Gamaliel Ogbuagu"
                      className="mt-1 block w-full px-3 py-2 border border-stone-300 bg-white rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] text-sm"
                      value={regAdminName}
                      onChange={(e) => setRegAdminName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-600 tracking-wide">
                      Admin Email (Login ID) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="mr.ogbuagu@school.edu"
                      className="mt-1 block w-full px-3 py-2 border border-stone-300 bg-white rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] text-sm"
                      value={regAdminEmail}
                      onChange={(e) => setRegAdminEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-600 tracking-wide">
                      Set Administration Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••••••"
                      className="mt-1 block w-full px-3 py-2 border border-stone-300 bg-white rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] text-sm"
                      value={regAdminPassword}
                      onChange={(e) => setRegAdminPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#1B4332] hover:bg-[#143225] focus:outline-hidden focus:ring-2 focus:ring-[#1B4332] transition-colors cursor-pointer"
                >
                  {isAuthLoading ? 'Creating School Portal...' : 'Register school & Subscribe'}
                </button>
              </form>
            )}

            {!isRegisteringSchool && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-stone-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="px-2 bg-white text-stone-500 font-semibold tracking-wider">
                      Or Instant Demo Portals
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setSelectedSchoolId('focused-school-fgc-abia');
                      handleDemoSignIn('admin');
                    }}
                    disabled={isAuthLoading}
                    className="w-full relative flex items-center justify-between px-4 py-3 border border-stone-200 rounded-xl hover:border-[#1B4332] hover:bg-emerald-50/30 transition-all group cursor-pointer"
                  >
                    <div className="text-left">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs text-white bg-[#1B4332] px-1.5 py-0.5 rounded font-mono font-bold uppercase scale-90">
                          School Admin
                        </span>
                        <span className="font-semibold text-stone-800 text-sm">Mr. Gamaliel Ogbuagu</span>
                      </div>
                      <p className="text-stone-500 text-xs mt-0.5">{DEMO_ADMIN_EMAIL}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-[#1B4332] group-hover:translate-x-1 transition-all" />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedSchoolId('focused-school-fgc-abia');
                      handleDemoSignIn('teacher');
                    }}
                    disabled={isAuthLoading}
                    className="w-full relative flex items-center justify-between px-4 py-3 border border-stone-200 rounded-xl hover:border-[#1B4332] hover:bg-emerald-50/30 transition-all group cursor-pointer"
                  >
                    <div className="text-left">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs text-emerald-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase scale-90">
                          Form Teacher
                        </span>
                        <span className="font-semibold text-stone-800 text-sm">Mrs. Chioma Amadi</span>
                      </div>
                      <p className="text-stone-500 text-xs mt-0.5">{DEMO_TEACHER_EMAIL}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-[#1B4332] group-hover:translate-x-1 transition-all" />
                  </button>
                </div>
              </>
            )}

            <div className="mt-6 pt-4 border-t border-stone-100 flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  setShowAuthPortal(false);
                  setAuthError(null);
                }}
                className="text-xs font-mono font-bold text-[#1B4332] hover:text-[#143225] hover:underline flex items-center space-x-1.5 cursor-pointer"
              >
                <span>← Back to Homepage Info</span>
              </button>
            </div>

            <p className="text-center text-xs text-stone-400 mt-4 leading-relaxed max-w-xs mx-auto">
              Note: Database is fully isolated per school. No system data leaks occur across credentials.
            </p>
          </div>
        </div>
      </div>
    );
  }
}

if (!currentUser || !currentProfile || !currentSchool) {
  setTimeout(() => {
    setShowDashboard(false);
  }, 0);
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#FAF7F0]">
      <div className="text-center font-display">
        <ClipboardCheck className="mx-auto h-12 w-12 text-[#1B4332] animate-bounce" />
        <h2 className="mt-4 text-xl font-bold text-[#1B4332]">Redirecting to Portal...</h2>
      </div>
    </div>
  );
}

  // Loaded Application Frame Block
  return (
    <div className="min-h-screen bg-[#FAF7F0] text-stone-800 relative pb-16 flex flex-col">
      {/* 1. School Header banner */}
      <header className="bg-[#1B4332] text-white shadow-sm border-b-2 border-[#D4A017] shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          <div className="flex items-center space-x-2.5">
            {(currentSchool.badgeUrl || currentSchool.logoUrl) ? (
              <img 
                src={currentSchool.badgeUrl || currentSchool.logoUrl} 
                alt={`${currentSchool.name} Crest`} 
                className="h-8 w-8 object-contain rounded-lg bg-white/10 border border-white/20 p-0.5 shrink-0 shadow-3xs" 
              />
            ) : (
              <ClipboardCheck className="h-5 w-5 text-[#D4A017] shrink-0" />
            )}
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-sm sm:text-base font-display font-bold tracking-tight">
                  {currentSchool.name}
                </h1>
                {isOfflineMode ? (
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 border border-amber-500/30 text-amber-300 tracking-wider uppercase">
                    Sandbox
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 border border-emerald-500/30 text-[#4ade80] tracking-wider uppercase">
                    Live
                  </span>
                )}
              </div>
              <p className="text-emerald-100/90 text-[10px] mt-0.5 font-sans flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                Logged in: <strong className="ml-1 text-white">{currentProfile.full_name}</strong>
                <span className="mx-1">•</span>
                <span className="capitalize bg-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono text-amber-200">
                  {currentProfile.role}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {currentProfile.role === 'admin' && (
              <button
                id="btn-open-school-badge-settings"
                onClick={() => {
                  setBadgeInputUrl(currentSchool.badgeUrl || currentSchool.logoUrl || '');
                  setSchoolAddressInput(currentSchool.address || '');
                  setSchoolPhoneInput(currentSchool.phone || '');
                  setShowSchoolBadgeModal(true);
                }}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-[#D4A017]/20 hover:bg-[#D4A017]/30 border border-[#D4A017]/40 text-amber-200 cursor-pointer transition-all shrink-0"
                title="Upload or Change School Badge & Official Document Branding"
              >
                {(currentSchool.badgeUrl || currentSchool.logoUrl) ? (
                  <img src={currentSchool.badgeUrl || currentSchool.logoUrl} alt="Badge" className="h-3.5 w-3.5 object-contain rounded-xs" />
                ) : (
                  <Award className="h-3.5 w-3.5 text-[#D4A017]" />
                )}
                <span className="font-bold">School Badge</span>
              </button>
            )}

            {/* Term dropdown Selector */}
            <div className="flex items-center space-x-1.5 bg-stone-900/35 rounded-md p-0.5 px-1.5 border border-white/5">
              <span className="hidden lg:inline text-[9px] text-[#D4A017] font-mono tracking-wider uppercase">
                Term:
              </span>
              <select
                id="term-selection-dropdown"
                className="bg-transparent text-white font-semibold text-xs border-0 focus:ring-0 cursor-pointer pr-6 py-0.5 font-sans"
                value={currentTerm}
                onChange={(e) => setCurrentTerm(e.target.value)}
              >
                {currentSchool.terms.map(t => (
                  <option key={t} value={t} className="text-black bg-white">{t}</option>
                ))}
              </select>

              {currentProfile.role === 'admin' && (
                <button
                  onClick={() => {
                    setCalendarTab('label');
                    setShowAddTermModal(true);
                  }}
                  className="p-1 hover:bg-white/10 rounded text-amber-400 hover:text-white transition-colors"
                  title="Manage Academic Calendar Periods"
                >
                  <Calendar className="h-3.5 w-3.5" />
                </button>
              )}
            </div>



            {/* Logout button */}
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-red-900/30 hover:bg-red-800 border border-red-500/20 text-red-100 cursor-pointer transition-all shrink-0"
            >
              <LogOut className="h-3 w-3" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>

        </div>
      </header>

      {isSchoolLocked && (
        <div className="bg-gradient-to-r from-red-900 to-rose-950 text-white py-3 px-4 sm:px-6 shadow-md border-b-2 border-amber-500 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shrink-0 font-sans">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-tight">Academic Subscription Pending (₦20,000 NGN)</h3>
              <p className="text-[11px] text-rose-200 mt-0.5">
                Trial period for {currentSchool?.name} is complete. Termly activation is required to unlock register edit inputs and guest class teacher sign-ins.
              </p>
            </div>
          </div>
          {currentProfile?.role === 'admin' ? (
            <button
              onClick={() => {
                setPaymentTermTarget(currentTerm);
                setShowPaymentModal(true);
              }}
              className="px-3.5 py-1.5 bg-[#0BA4DB] hover:bg-[#098bb9] text-white text-xs font-bold rounded-lg shadow-sm border-0 cursor-pointer whitespace-nowrap transition-colors flex items-center space-x-1.5"
            >
              <span>Pay ₦20,000 via Paystack</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-red-950/80 border border-red-700/50 rounded text-red-300 uppercase font-bold tracking-wider leading-none">
              Admin Action Required
            </span>
          )}
        </div>
      )}

      {/* 1.5 Academic Term Countdown banner */}
      {currentSchool && (
        <TermCountdownBanner
          currentSchool={currentSchool}
          currentTerm={currentTerm}
          currentProfile={currentProfile}
          onOpenCalendarSettings={() => {
            setCalendarTab('dates');
            setShowAddTermModal(true);
          }}
        />
      )}

      {/* 2. System notifications / Status Toast */}
      <AnimatePresence>
        {statusFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className={`p-4 rounded-xl shadow-lg border flex items-start space-x-3 text-sm ${
              statusFeedback.type === 'err' 
                ? 'bg-red-50 text-red-950 border-red-200' 
                : statusFeedback.type === 'info' 
                  ? 'bg-amber-50 text-amber-950 border-amber-200' 
                  : 'bg-emerald-50 text-emerald-950 border-emerald-200'
            }`}>
              {statusFeedback.type === 'err' ? (
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              ) : statusFeedback.type === 'info' ? (
                <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{statusFeedback.type === 'err' ? 'Attention Required' : 'Success Operation'}</p>
                <p className="text-xs mt-0.5 opacity-80">{statusFeedback.msg}</p>
              </div>
              <button onClick={() => setStatusFeedback(null)} className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex-1 w-full flex flex-col md:flex-row gap-4">
        
        {/* SIDEBAR: CLASS SELECTOR MATRIX */}
        <section className="w-full md:w-56 shrink-0 flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-3xs">
            <h2 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center">
              <ClipboardCheck className="h-3.5 w-3.5 text-[#1B4332] mr-1" />
              Classrooms List
            </h2>
            
            {visibleClasses.length === 0 ? (
              <div className="text-center py-4 text-stone-400 text-xs leading-normal">
                {currentProfile.role === 'admin' 
                  ? 'No classes created yet. Setup JSS/SSS classrooms in Roster.'
                  : 'You have not been assigned to any classes yet.'}
              </div>
            ) : (
              <div className="space-y-1">
                {visibleClasses.map(cls => {
                  const assignedCount = students.filter(s => s.class_id === cls.id).length;
                  const isSelected = selectedClassId === cls.id;
                  
                  return (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left text-[11px] font-semibold transition-all ${
                        isSelected 
                          ? 'bg-[#1B4332] text-white shadow-2xs' 
                          : 'bg-stone-50 text-stone-700 hover:bg-stone-100/80 border border-stone-100'
                      }`}
                    >
                      <div className="truncate">
                        <span>{cls.name}</span>
                        {/* Display assignment indicators for admins */}
                        {currentProfile.role === 'admin' && (
                          <div className={`text-[9px] mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-stone-400'}`}>
                            {classAssignments.filter(a => a.class_id === cls.id).length} assigned
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        isSelected ? 'bg-white/20 text-[#D4A017]' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {assignedCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-stone-100/80 rounded-xl p-3 border border-stone-200/60 shadow-3xs">
            <h3 className="text-[10px] font-bold text-stone-600 uppercase tracking-wider flex items-center">
              <Info className="h-3.5 w-3.5 text-[#D4A017] mr-1" />
              Information Portal
            </h3>
            <p className="text-stone-500 text-[11px] leading-normal mt-1">
              Every student code is unique to their class. Type codes or tap convenience buttons to check logs instantly.
            </p>
          </div>
        </section>

        {/* MAIN BODY CONTENTS */}
        <section className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-stone-200 shadow-3xs overflow-hidden">
          
          {/* Tabs Navigation */}
          <div className="border-b border-stone-200 bg-stone-50/50 flex justify-between items-center px-2.5 sm:px-4">
            <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-0.5">
              <button
                onClick={() => setActiveTab('attendance')}
                className={`py-1.5 px-2 text-[11px] font-semibold border-b-2 hover:text-[#1B4332] whitespace-nowrap transition-all duration-150 ${
                  activeTab === 'attendance'
                    ? 'border-[#1B4332] text-[#1B4332] font-semibold'
                    : 'border-transparent text-stone-500'
                }`}
              >
                Mark Attendance
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`py-1.5 px-2 text-[11px] font-semibold border-b-2 hover:text-[#1B4332] whitespace-nowrap transition-all duration-150 ${
                  activeTab === 'reports'
                    ? 'border-[#1B4332] text-[#1B4332] font-semibold'
                    : 'border-transparent text-stone-500'
                }`}
              >
                Attendance Reports
              </button>
              <button
                onClick={() => setActiveTab('grades')}
                className={`py-1.5 px-2 text-[11px] font-semibold border-b-2 hover:text-[#1B4332] whitespace-nowrap transition-all duration-150 ${
                  activeTab === 'grades'
                    ? 'border-[#1B4332] text-[#1B4332] font-semibold'
                    : 'border-transparent text-stone-500'
                }`}
              >
                Academic Gradebook
              </button>
               {currentProfile.role === 'admin' && (
                 <button
                   onClick={() => setActiveTab('roster')}
                   className={`py-1.5 px-2 text-[11px] font-semibold border-b-2 hover:text-[#1B4332] whitespace-nowrap transition-all duration-150 ${
                     activeTab === 'roster'
                       ? 'border-[#1B4332] text-[#1B4332] font-semibold'
                       : 'border-transparent text-stone-500'
                   }`}
                 >
                   Roster & Assignments
                 </button>
               )}
               <button
                 onClick={() => setActiveTab('billing' as any)}
                 className={`py-1.5 px-2 text-[11px] font-semibold border-b-2 hover:text-[#1B4332] whitespace-nowrap transition-all duration-150 ${
                   activeTab === ('billing' as any)
                     ? 'border-[#1B4332] text-[#1B4332] font-semibold'
                     : 'border-transparent text-stone-500'
                 }`}
               >
                 Fees & School Ledger
               </button>
            </div>

            {selectedClassId && (
              <div className="hidden py-1 px-2 border border-stone-200 rounded bg-white sm:flex items-center font-mono text-[10px] text-stone-600 space-x-1">
                <Calendar className="h-3 w-3 text-[#1B4332]" />
                <span className="font-semibold">{currentDate}</span>
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 flex-1 flex flex-col">
            
            {/* NO ACTIVE CLASS SELECTED EMPTY STATE */}
            {!selectedClassId && (activeTab === 'attendance' || activeTab === 'reports' || activeTab === 'grades') ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto py-16">
                <ClipboardCheck className="h-14 w-14 text-stone-300 stroke-[1.5]" />
                <h3 className="text-lg font-display font-medium text-stone-800 mt-4">
                  No Classroom Selected
                </h3>
                <p className="text-stone-500 text-sm mt-1 mb-6">
                  Select a class from the list on the left to begin marking pupil attendance or generating CSV term spreadsheets.
                </p>
                {currentProfile.role === 'admin' && (
                  <form onSubmit={handleCreateClass} className="w-full flex gap-2">
                    <input
                      type="text"
                      className="flex-1 min-w-0 px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                      placeholder="e.g. JSS 3A"
                      required
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                    />
                    <button type="submit" className="bg-[#1B4332] text-white px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer">
                      Create Class
                    </button>
                  </form>
                )}
              </div>
            ) : (
              // FULLY SEPARATED TABS CONTENT
              <div className="flex-1 flex flex-col">
                
                {/* TAB 1: MARK ATTENDANCE */}
                {activeTab === 'attendance' && (
                  <div className="flex-1 flex flex-col gap-4">
                    
                    {/* Date and Toggle configurations block */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
                      
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {/* Input date handler */}
                        <div className="flex flex-col">
                          <label className="text-[10px] text-stone-500 font-bold tracking-wider uppercase mb-0.5">
                            Date of Registry
                          </label>
                          <input
                            type="date"
                            className="bg-white border border-stone-300 rounded-lg text-[11px] px-2 py-1 flex items-center font-bold text-stone-700 min-w-[130px]"
                            value={currentDate}
                            onChange={(e) => setCurrentDate(e.target.value)}
                          />
                        </div>

                        {/* On Time / Late code mode controls */}
                        <div className="flex flex-col">
                          <label className="text-[10px] text-stone-500 font-bold tracking-wider uppercase mb-0.5">
                            Check-in mode
                          </label>
                          <div className="flex bg-stone-200/60 p-0.5 rounded-lg border border-stone-200">
                            <button
                              onClick={() => setCodeMode('early')}
                              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md transition-all duration-150 ${
                                codeMode === 'early' 
                                  ? 'bg-[#1B4332] text-white shadow-2xs' 
                                  : 'text-stone-600 hover:text-[#1B4332]'
                              }`}
                            >
                              On Time
                            </button>
                            <button
                              onClick={() => setCodeMode('late')}
                              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md transition-all duration-150 ${
                                codeMode === 'late' 
                                  ? 'bg-amber-600 text-white shadow-2xs' 
                                  : 'text-stone-600 hover:text-amber-800'
                              }`}
                            >
                              Late
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Display class-wide metrics summary */}
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-stone-400">Total present</span>
                          <span className="text-stone-800 font-bold font-display text-xs">
                            {reportRows.filter(r => r.totalPresent > 0).length} / {activeClassStudents.length}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-stone-400">On Time</span>
                          <span className="text-emerald-700 font-bold font-display text-xs">
                            {activeClassRecords.filter(r => r.date === currentDate && r.status === 'early').length}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-stone-400">Late check-ins</span>
                          <span className="text-amber-600 font-bold font-display text-xs">
                            {activeClassRecords.filter(r => r.date === currentDate && r.status === 'late').length}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* LARGE CODE SUBMIT CARD */}
                    <div className="bg-[#1B4332]/5 border border-[#1B4332]/25 rounded-xl p-3 sm:p-4 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      <div className="md:max-w-md">
                        <div className="flex items-center space-x-1 text-[10px] text-[#1B4332] font-bold tracking-wider uppercase mb-0.5">
                          <Sparkles className="h-3 w-3 text-[#D4A017]" />
                          <span>Student Badging Registry</span>
                        </div>
                        <h3 className="text-sm font-display font-bold text-[#1B4332]">
                          Scan / Type Student Code
                        </h3>
                        <p className="text-[11px] text-stone-600 mt-0.5">
                          Type student's unique personal code and hit <kbd className="bg-stone-200 border border-stone-300 px-1 py-0.5 rounded text-[9px] font-mono font-bold">Enter</kbd> to mark them as <strong>{codeMode === 'early' ? 'On Time' : 'Late'}</strong> instantly.
                        </p>
                      </div>

                      {/* Submit form */}
                      <form onSubmit={handleMarkByCode} className="flex gap-1.5 w-full md:max-w-xs shrink-0 select-none">
                        <input
                          id="student-code-input"
                          ref={codeInputRef}
                          type="text"
                          required
                          placeholder="e.g. JSS3A-001"
                          className="flex-1 px-3 py-1.5 border border-stone-300 rounded-lg font-mono text-xs font-bold uppercase tracking-wider focus:outline-hidden focus:border-[#1B4332] focus:ring-1 focus:ring-[#1B4332]/20 bg-white text-stone-900"
                          value={codeInputValue}
                          onChange={(e) => setCodeInputValue(e.target.value)}
                        />
                        <button
                          type="submit"
                          className={`px-4.5 rounded-lg text-xs font-semibold text-white shadow-xs cursor-pointer flex items-center justify-center transition-all ${
                            codeMode === 'early'
                              ? 'bg-[#1B4332] hover:bg-[#143225]'
                              : 'bg-amber-600 hover:bg-amber-700'
                          }`}
                        >
                          Mark
                        </button>
                      </form>

                    </div>

                    {/* CURRENT DAY CLASS ROSTER TABLE */}
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-2 shrink-0">
                        <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center">
                          <Users className="h-3.5 w-3.5 text-[#1B4332] mr-1" />
                          Daily Class Roster ({activeClassStudents.length} Students)
                        </h4>
                        <span className="text-[10px] text-stone-400 font-mono">
                          Term: {currentTerm}
                        </span>
                      </div>

                      {activeClassStudents.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-10 border border-stone-200 border-dashed rounded-xl text-center p-4 bg-stone-50">
                          <Users className="h-8 w-8 text-stone-300 stroke-[1.5]" />
                          <h5 className="text-stone-700 font-display font-medium text-xs mt-2">
                            Classroom Roster Empty
                          </h5>
                          <p className="text-stone-400 text-[11px] mt-0.5 mb-3">
                            You haven't uploaded secondary school students here yet.
                          </p>
                          {currentProfile.role === 'admin' && (
                            <button
                              onClick={() => setActiveTab('roster')}
                              className="px-2.5 py-1 rounded-md bg-[#1B4332] text-white font-semibold text-[11px] transition hover:bg-[#143225] cursor-pointer"
                            >
                              Go to Roster Setup
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 border border-stone-200 rounded-xl overflow-y-auto max-h-[300px]">
                          <table className="min-w-full divide-y divide-stone-200">
                            <thead className="bg-stone-50 text-stone-500 text-[10px] uppercase font-bold tracking-wider sticky top-0 z-10">
                              <tr>
                                <th scope="col" className="px-3 py-1.5 text-left">Code Badge</th>
                                <th scope="col" className="px-3 py-1.5 text-left">Full Name</th>
                                <th scope="col" className="px-3 py-1.5 text-center">Checked Date Register</th>
                                <th scope="col" className="px-3 py-1.5 text-right">Registry Quick Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-stone-200 text-xs">
                              {activeClassStudents.map(student => {
                                const dayRecord = activeClassRecords.find(
                                  r => r.student_id === student.id && r.date === currentDate
                                );

                                return (
                                  <tr key={student.id} className="hover:bg-stone-50/50">
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                      <StudentCodeBadge code={student.code} />
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-stone-700">
                                      {student.name}
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap text-center">
                                      {dayRecord ? (
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                          dayRecord.status === 'early'
                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                            : 'bg-amber-50 text-amber-800 border border-amber-100'
                                        }`}>
                                          {dayRecord.status === 'early' ? (
                                            <Check className="h-3 w-3 mr-1" />
                                          ) : (
                                            <Clock className="h-3 w-3 mr-1" />
                                          )}
                                          Checked {dayRecord.status === 'early' ? 'Early' : 'Late'}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-400 border border-stone-200/50">
                                          Unmarked / Absent
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap text-right">
                                      {dayRecord ? (
                                        <button
                                          onClick={() => handleUndoMark(student.id)}
                                          className="text-red-600 hover:text-red-800 text-[11px] font-semibold flex items-center justify-end ml-auto space-x-1 hover:underline cursor-pointer"
                                        >
                                          <RotateCcw className="h-3 w-3" />
                                          <span>Undo mark</span>
                                        </button>
                                      ) : (
                                        <div className="flex justify-end gap-1">
                                          <button
                                            onClick={() => handleQuickMark(student.id, 'early')}
                                            className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 text-[10px] font-semibold cursor-pointer"
                                          >
                                            On Time
                                          </button>
                                          <button
                                            onClick={() => handleQuickMark(student.id, 'late')}
                                            className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-[10px] font-semibold cursor-pointer"
                                          >
                                            Late
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* TAB 2: REPORTS & ANALYSIS VIEW */}
                {activeTab === 'reports' && currentSchool?.tier === 'premium' && (
                  <div className="flex-1 flex flex-col gap-6">
                    
                    {/* CSV Export & Title panel */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50 p-4 rounded-xl border border-stone-100">
                      <div>
                        <h3 className="text-base font-display font-medium text-stone-800">
                          {activeClass?.name} Class Ledger Report
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                          Total Sessions evaluated: <strong>{sessionsHeldCount} active dates</strong> on {currentTerm} labels
                        </p>
                      </div>

                      {reportRows.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleExportCSV}
                            className="flex items-center space-x-1.5 bg-[#1B4332] text-white hover:bg-[#143225] py-2 px-4 rounded-lg font-semibold text-xs shadow-xs cursor-pointer transition"
                          >
                            <Download className="h-4 w-4" />
                            <span>Export CSV Registry</span>
                          </button>
                          <button
                            onClick={handleExportPDF}
                            className="flex items-center space-x-1.5 bg-[#D4A017] text-white hover:bg-[#B7870F] py-2 px-4 rounded-lg font-semibold text-xs shadow-xs cursor-pointer transition"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download PDF Report</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ANALYSIS TABLE */}
                    <div className="flex-1 flex flex-col min-h-0">
                      {reportRows.length === 0 ? (
                        <div className="text-center py-16 text-stone-400">
                          No reports available. Select a class or mark pupils in the Mark Attendance dashboard.
                        </div>
                      ) : (
                        <div className="border border-stone-200 rounded-2xl overflow-y-auto max-h-[400px]">
                          <table className="min-w-full divide-y divide-stone-200 text-sm">
                            <thead className="bg-stone-50 text-stone-500 text-2xs uppercase font-semibold tracking-wider sticky top-0">
                              <tr>
                                <th scope="col" className="px-4 py-3 text-left">Code Badge</th>
                                <th scope="col" className="px-4 py-3 text-left">Full Name</th>
                                <th scope="col" className="px-4 py-3 text-center">On Time</th>
                                <th scope="col" className="px-4 py-3 text-center">Late Records</th>
                                <th scope="col" className="px-4 py-3 text-center">Absences</th>
                                <th scope="col" className="px-4 py-3 text-center">Total Present</th>
                                <th scope="col" className="px-4 py-3 text-center">Attendance %</th>
                                <th scope="col" className="px-4 py-3 text-right">Rating Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-stone-200 text-stone-700">
                              {reportRows.map(row => (
                                <tr key={row.student.id} className="hover:bg-stone-50/50">
                                  <td className="px-4 py-3.5 whitespace-nowrap">
                                    <StudentCodeBadge code={row.student.code} />
                                  </td>
                                  <td className="px-4 py-3.5 whitespace-nowrap font-semibold">
                                    {row.student.name}
                                  </td>
                                  <td className="px-4 py-3.5 whitespace-nowrap text-center font-mono font-medium">
                                    {row.onTimeCount}
                                  </td>
                                  <td className="px-4 py-3.5 whitespace-nowrap text-center font-mono font-medium text-amber-700">
                                    {row.lateCount}
                                  </td>
                                  <td className="px-4 py-3.5 whitespace-nowrap text-center font-mono font-medium text-red-600">
                                    {row.absentCount}
                                  </td>
                                  <td className="px-4 py-3.5 whitespace-nowrap text-center font-mono font-bold">
                                    {row.totalPresent} / {row.sessionsHeld}
                                  </td>
                                  <td className="px-4 py-3.5 whitespace-nowrap text-center font-mono font-extrabold text-stone-900">
                                    {row.percentage}%
                                  </td>
                                  <td className="px-4 py-3.5 whitespace-nowrap text-right">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider ${
                                      row.rating === 'Excellent'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : row.rating === 'Pass'
                                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                          : 'bg-red-100 text-red-800 border border-red-200'
                                    }`}>
                                      {row.rating === 'Excellent' ? (
                                        <Award className="h-3 w-3 mr-1 text-emerald-700" />
                                      ) : null}
                                      {row.rating}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* RATINGS LEGEND / FOOTNOTE CARD */}
                    <div className="bg-stone-50 rounded-xl p-4 border border-stone-200/60 max-w-lg">
                      <h4 className="text-2xs uppercase tracking-wider font-semibold text-stone-600 mb-2">
                        Nigeria Academic Performance Legend
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-xs font-sans">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                          <span className="font-semibold">Excellent:</span>
                          <span className="text-stone-500 font-mono">≥ 90%</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
                          <span className="font-semibold">Pass Mark:</span>
                          <span className="text-stone-500 font-mono">70% – 89%</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                          <span className="font-semibold">Failure Limit:</span>
                          <span className="text-stone-500 font-mono">&lt; 70%</span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 3: ROSTER & ASSIGNMENTS SETUP (Admin Only) */}
                {activeTab === 'roster' && currentProfile.role === 'admin' && (
                  <div className="flex-1 flex flex-col gap-8">
                    
                    {lastGeneratedCredentials && (
                      <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-[#1B4332] uppercase tracking-wider flex items-center">
                            <Sparkles className="h-4 w-4 mr-1.5 text-amber-500 animate-pulse" />
                            🔑 Teacher Login Credentials Generated
                          </h4>
                          <p className="text-xs text-stone-600 leading-snug">
                            Login details for Mrs/Mr <strong>{lastGeneratedCredentials.name}</strong> are ready. Share these credentials with the teacher to grant access:
                          </p>
                          <div className="flex flex-wrap gap-4 pt-2 font-mono text-[11px] text-stone-705 bg-white/75 border border-emerald-100 p-3 rounded-xl mt-1">
                            <div><span className="font-bold text-[#1B4332]">Portal Email:</span> <code className="bg-[#1B4332]/5 px-2 py-0.5 rounded text-stone-800 font-medium">{lastGeneratedCredentials.email}</code></div>
                            <div><span className="font-bold text-[#1B4332]">Temporary Password:</span> <code className="bg-[#1B4332]/5 px-2 py-0.5 rounded text-stone-800 font-semibold">{lastGeneratedCredentials.pass}</code></div>
                          </div>
                        </div>
                        <button
                          onClick={() => setLastGeneratedCredentials(null)}
                          className="px-3 py-1.5 bg-white border border-stone-200 text-stone-600 hover:text-stone-800 font-semibold text-xs rounded-lg shadow-3xs cursor-pointer select-none transition"
                        >
                          Clear Notice
                        </button>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      
                      {/* 1. Classroom Manager & Teacher Creation */}
                      <div className="space-y-6">
                        
                        {/* Add Classroom Form */}
                        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 shadow-3xs">
                          <h3 className="text-xs font-semibold text-stone-600 uppercase tracking-widest mb-3 flex items-center">
                            <Plus className="h-4 w-4 text-[#1B4332] mr-1" />
                            Create School Classroom
                          </h3>
                          <form onSubmit={handleCreateClass} className="flex gap-2">
                            <input
                              type="text"
                              required
                              placeholder="e.g. SSS 1 Commerce"
                              className="flex-1 min-w-0 px-3 py-2 border border-stone-300 bg-white rounded-lg text-sm"
                              value={newClassName}
                              onChange={(e) => setNewClassName(e.target.value)}
                            />
                            <button
                              type="submit"
                              className="bg-[#1B4332] text-white hover:bg-[#143225] py-2 px-4 rounded-lg font-semibold text-xs cursor-pointer select-none"
                            >
                              Add Class
                            </button>
                          </form>
                        </div>

                        {/* Invite / Add and Create Teacher profiles */}
                        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 shadow-3xs">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-semibold text-stone-600 uppercase tracking-widest flex items-center">
                              <UserPlus className="h-4 w-4 text-[#1B4332] mr-1" />
                              School Teachers List
                            </h3>
                            <button
                              onClick={() => setShowAddTeacherModal(true)}
                              className="text-2xs bg-[#1B4332] border border-[#143225] text-white hover:bg-[#143225] py-1.5 px-3 rounded-lg font-bold cursor-pointer inline-flex items-center shadow-xs transition-all hover:scale-[1.03] active:scale-95 duration-100"
                            >
                              <Plus className="h-3 w-3 mr-1.5 text-amber-400" /> Add Teacher Profile
                            </button>
                          </div>

                          {allProfilesInSchool.filter(p => p.role === 'teacher').length === 0 ? (
                            <p className="text-stone-400 text-xs py-2 text-center leading-relaxed">
                              No teacher profiles added. Create temporary teacher accounts to assign them to classes!
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-[180px] overflow-y-auto border border-stone-200/50 rounded-xl bg-white p-2">
                              {allProfilesInSchool.filter(p => p.role === 'teacher').map(teacher => {
                                const teacherAssigns = classAssignments.filter(a => a.teacher_id === teacher.id);
                                
                                return (
                                  <div key={teacher.id} className="flex items-center justify-between py-2 px-3 odd:bg-stone-50 rounded-lg text-xs">
                                    <div className="space-y-0.5">
                                      <p className="font-semibold text-stone-800">{teacher.full_name}</p>
                                      <p className="text-stone-500 font-mono text-[10px] scale-95 origin-left">{teacher.email}</p>
                                      {teacher.generated_password && (
                                        <p className="text-[#1B4332] font-semibold font-mono text-[10px] scale-90 origin-left">
                                          Pwd: <span className="underline select-all bg-[#1B4332]/5 px-1 rounded">{teacher.generated_password}</span>
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-2xs bg-stone-100 border text-stone-600 px-2 py-0.5 rounded font-mono">
                                      {teacherAssigns.length} classes
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 1.2 Academic Calendar & Term Settings widget */}
                        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 shadow-3xs">
                          <h3 className="text-2xs font-bold text-stone-600 uppercase tracking-widest mb-1.5 flex items-center">
                            <Calendar className="h-4 w-4 text-[#1B4332] mr-1.5" />
                            Academic Calendar Manager
                          </h3>
                          <p className="text-xs text-stone-500 mb-4 leading-relaxed">
                            Control countdown periods, start/end months, and term configurations. Setting a completed calendar date locks all teacher scoring entries automatically.
                          </p>
                          <div id="calendar-widget-actions" className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCalendarTab('label');
                                setShowAddTermModal(true);
                              }}
                              className="px-3.5 py-2 bg-white hover:bg-stone-105 border border-stone-200 text-stone-700 font-semibold text-xs rounded-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs hover:border-[#1B4332]/30"
                            >
                              <Plus className="h-3.5 w-3.5 text-[#1B4332]" />
                              Add Term Label
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCalendarTab('dates');
                                if (currentSchool) {
                                  setCalendarSelectedTerm(currentTerm || currentSchool.terms[0] || '');
                                  const config = currentSchool.termConfigs?.[currentTerm || currentSchool.terms[0]];
                                  if (config) {
                                    setTermStartMonth(config.startMonth || 'January');
                                    setTermEndMonth(config.endMonth || 'April');
                                    setTermStartDate(config.startDate || '');
                                    setTermEndDate(config.endDate || '');
                                  } else {
                                    setTermStartMonth('January');
                                    setTermEndMonth('April');
                                    setTermStartDate('');
                                    setTermEndDate('');
                                  }
                                }
                                setShowAddTermModal(true);
                              }}
                              className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#143225] text-white font-semibold text-xs rounded-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                            >
                              <Sliders className="h-3.5 w-3.5 text-amber-350" />
                              Configure Countdown Dates
                            </button>
                          </div>
                        </div>

                      </div>

                      {/* 2. Form Teacher Assignments to selected class */}
                      {!selectedClassId ? (
                        <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 flex flex-col items-center justify-center text-center py-16">
                          <div className="p-3 bg-stone-100 text-stone-500 rounded-full mb-3">
                            <Briefcase className="h-6 w-6 text-[#1B4332]" />
                          </div>
                          <h4 className="font-semibold text-xs text-stone-700 uppercase tracking-wider">No Class Selected</h4>
                          <p className="text-2xs text-stone-500 max-w-xs mt-2 leading-relaxed">
                            Please select a classroom from the left sidebar to assign class teachers and manage child register credentials.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200">
                          <h3 className="text-xs font-semibold text-stone-600 uppercase tracking-widest mb-1.5 flex items-center">
                            <Briefcase className="h-4 w-4 text-[#1B4332] mr-1" />
                            Class Teacher Assignment
                          </h3>
                          <p className="text-xs text-stone-500 mb-4">
                            Assign or remove teacher security credentials for <strong>{activeClass?.name}</strong>.
                          </p>

                          <div className="space-y-4">
                            
                            {/* Currently assigned list */}
                            <div>
                              <span className="text-2xs font-semibold text-stone-500 uppercase tracking-wider block mb-2">
                                Currently Assigned to {activeClass?.name}
                              </span>
                              
                              {classAssignments.filter(a => a.class_id === selectedClassId).length === 0 ? (
                                <p className="text-2xs text-stone-400 py-3 bg-white text-center rounded-lg border border-dashed border-stone-200">
                                  No teachers assigned. Only school owners/admins can record registry check-ins now.
                                </p>
                              ) : (
                                <div className="space-y-1.5 font-sans">
                                  {classAssignments
                                    .filter(a => a.class_id === selectedClassId)
                                    .map(assign => {
                                      const teacher = allProfilesInSchool.find(p => p.id === assign.teacher_id);
                                      
                                      return (
                                        <div key={assign.id} className="flex items-center justify-between p-2.5 bg-white border border-stone-200 rounded-lg text-xs">
                                          <div className="truncate">
                                            <p className="font-semibold text-stone-800">{teacher?.full_name || 'Invited Teacher'}</p>
                                            <p className="text-stone-400 font-mono text-2xs truncate">{teacher?.email}</p>
                                          </div>
                                          <button
                                            onClick={() => handleRemoveTeacherFromClass(assign.teacher_id)}
                                            className="text-red-600 hover:text-red-800 text-xs font-semibold flex items-center space-x-0.5 px-2 py-1 rounded hover:bg-red-50 border border-transparent hover:border-red-100 transition cursor-pointer"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            <span className="hidden sm:inline">Revoke</span>
                                          </button>
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
                            </div>

                            {/* List of other available teachers */}
                            <div>
                              <span className="text-2xs font-semibold text-stone-500 uppercase tracking-wider block mb-2">
                                Assign More Teachers to {activeClass?.name}
                              </span>
                              
                              {allProfilesInSchool.filter(
                                p => p.role === 'teacher' && 
                                !classAssignments.some(a => a.class_id === selectedClassId && a.teacher_id === p.id)
                              ).length === 0 ? (
                                <p className="text-2xs text-stone-400 py-3 bg-white text-center rounded-lg border border-dashed border-stone-200">
                                  No other school teachers available. Add secondary profile first!
                                </p>
                              ) : (
                                <div className="space-y-1.5 font-sans max-h-[150px] overflow-y-auto">
                                  {allProfilesInSchool
                                    .filter(
                                      p => p.role === 'teacher' && 
                                      !classAssignments.some(a => a.class_id === selectedClassId && a.teacher_id === p.id)
                                    )
                                    .map(teacher => (
                                      <div key={teacher.id} className="flex items-center justify-between p-2.5 bg-white border border-stone-100 rounded-lg text-xs hover:border-[#1B4332]/40 transition">
                                        <div className="truncate pr-2">
                                          <p className="font-semibold text-stone-800">{teacher.full_name}</p>
                                          <p className="text-stone-400 text-2xs font-mono truncate">{teacher.email}</p>
                                        </div>
                                        <button
                                          onClick={() => handleAddTeacherToClass(teacher.id)}
                                          className="text-emerald-800 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-2xs font-semibold font-sans px-2.5 py-1 rounded cursor-pointer transition select-none"
                                        >
                                          Assign Access
                                        </button>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      )}

                    </div>

                    {/* 3. STUDENT MULTI-ROSTER MANAGER TABLES */}
                    {selectedClassId && (
                      <div className="border border-stone-200 rounded-2xl p-5 bg-white shadow-3xs">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4 mb-4">
                        <div>
                          <h3 className="text-base font-display font-medium text-stone-800 flex items-center">
                            <Users className="h-5 w-5 text-[#1B4332] mr-1.5" />
                            {activeClass?.name} Pupils Catalog
                          </h3>
                          <p className="text-xs text-stone-500 mt-0.5">
                            Manage individual rosters. In Nigerian registries, codes are automatically created sequentially below.
                          </p>
                        </div>

                        {/* Add student by name and email form */}
                        <div className="flex flex-col gap-2 w-full sm:max-w-2xl shrink-0">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <form onSubmit={handleAddStudent} className="flex flex-1 flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                required
                                placeholder="Pupil Legal Name"
                                className="flex-1 min-w-0 px-3 py-1.5 border border-stone-300 rounded-lg text-xs font-medium"
                                value={newStudentName}
                                onChange={(e) => setNewStudentName(e.target.value)}
                              />
                              <input
                                type="email"
                                placeholder="Email (Optional)"
                                className="flex-[#0.8] min-w-0 px-3 py-1.5 border border-stone-300 rounded-lg text-xs font-mono"
                                value={newStudentEmail}
                                onChange={(e) => setNewStudentEmail(e.target.value)}
                              />
                              <button
                                type="submit"
                                className="bg-[#1B4332] text-white hover:bg-[#143225] py-1.5 px-3 rounded-lg font-semibold text-xs cursor-pointer inline-flex items-center justify-center shrink-0"
                              >
                                <Plus className="h-3.5 w-3.5 mr-0.5" /> ADD
                              </button>
                            </form>
                            <button
                              type="button"
                              onClick={() => {
                                setNewStudentName('');
                                setNewStudentEmail('');
                                setNewStudentDetailName('');
                                setNewStudentDetailEmail('');
                                setNewStudentPhone('');
                                setNewStudentPassport('');
                                setNewStudentType('new');
                                setShowDetailStudentModal(true);
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#1B4332] hover:text-emerald-950 py-1.5 px-3 rounded-lg font-semibold text-xs cursor-pointer inline-flex items-center justify-center shrink-0 transition"
                              title="Register with passport, phone, student type, and first installment payment"
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" /> ADVANCED REGISTRATION
                            </button>
                          </div>

                          {/* Quick Reg Duplicate Warning Box */}
                          {(() => {
                            const dup = findDuplicateStudent(newStudentName, newStudentEmail);
                            if (dup) {
                              const dupClass = classes.find(c => c.id === dup.class_id)?.name || 'another class';
                              return (
                                <motion.div 
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-2xs text-[#7F5F00] leading-normal"
                                >
                                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold text-amber-800">Potential Duplicate Detected:</span> A pupil with similar credentials is already registered! <strong className="text-stone-800 font-semibold">{dup.name}</strong> is listed in <strong className="text-stone-800 font-semibold">{dupClass}</strong> with seq code <strong className="text-[#1B4332] font-mono font-bold bg-[#1B4332]/5 px-1 py-0.5 rounded">{dup.code}</strong>.
                                  </div>
                                </motion.div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>

                      {activeClassStudents.length === 0 ? (
                        <div className="text-center py-10 text-stone-400 text-sm">
                          No students in this class. Type name and click ADD to auto-generate unique JSS/SSS ID badge codes!
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-stone-200 text-sm">
                            <thead className="bg-stone-50 text-stone-500 text-2xs uppercase tracking-wider font-semibold">
                              <tr>
                                <th scope="col" className="px-4 py-2.5 text-left">Code ID Badge</th>
                                <th scope="col" className="px-4 py-2.5 text-left">Pupil Full Name</th>
                                <th scope="col" className="px-4 py-2.5 text-left">Email Address</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Roster Administration</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-stone-200">
                              {activeClassStudents.map(student => (
                                <tr key={student.id} className="hover:bg-stone-50/20">
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <StudentCodeBadge code={student.code} />
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-stone-800 font-sans">
                                    {student.name}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-stone-550 font-mono text-xs">
                                    {student.email || <span className="text-stone-400 italic">No email</span>}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right">
                                    <div className="flex justify-end gap-1.5 select-none">
                                      <button
                                        onClick={() => {
                                          setSelectedIdCardStudent(student);
                                          setIdCardSide('front');
                                          setShowIdCardModal(true);
                                        }}
                                        className="text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 text-xs font-semibold px-2.5 py-1 rounded cursor-pointer inline-flex items-center space-x-1 border border-transparent hover:border-emerald-200 transition"
                                        title="Generate and print School ID Card"
                                      >
                                        <Contact className="h-3.5 w-3.5" />
                                        <span>ID Card</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingStudent(student);
                                          setEditStudentName(student.name);
                                          setEditStudentEmail(student.email || '');
                                          setEditStudentPhone(student.phone || '');
                                          setEditStudentPassport(student.passportUrl || '');
                                          setEditStudentType(student.studentType || 'returning');
                                        }}
                                        className="text-blue-600 hover:text-blue-800 text-xs font-semibold px-2.5 py-1 rounded hover:bg-blue-50 cursor-pointer inline-flex items-center space-x-1 border border-transparent hover:border-blue-200 transition"
                                        title="Edit pupil"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        onClick={() => handleRemoveStudent(student.id, student.name)}
                                        className="text-red-500 hover:text-red-800 text-xs font-semibold px-2.5 py-1 rounded hover:bg-red-50 cursor-pointer inline-flex items-center space-x-1 border border-transparent hover:border-red-200 transition"
                                        title="Remove from roster"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>Remove</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      </div>
                    )}

                  </div>
                )}

                {/* TAB 4: ACADEMIC GRADEBOOK */}
                {activeTab === 'grades' && currentSchool?.tier === 'premium' && (
                  <GradesTab
                    isOfflineMode={isOfflineMode}
                    currentProfile={currentProfile}
                    currentSchool={currentSchool!}
                    selectedClassId={selectedClassId}
                    activeClass={activeClass}
                    classes={classes}
                    currentTerm={currentTerm}
                    students={students}
                    subjects={subjects}
                    assessmentConfigs={assessmentConfigs}
                    studentScores={studentScores}
                    setSubjects={setSubjects}
                    setAssessmentConfigs={setAssessmentConfigs}
                    setStudentScores={setStudentScores}
                    saveOfflineItem={saveOfflineItem}
                    statusFeedback={statusFeedback}
                    setStatusFeedback={setStatusFeedback}
                  />
                )}

                {/* TAB 5: BILLING & SUBSCRIPTIONS */}
                {activeTab === ('billing' as any) && currentSchool?.tier === 'premium' && (
                  <BillingTabPanel
                    currentSchool={currentSchool!}
                    currentTerm={currentTerm}
                    isSchoolLocked={isSchoolLocked}
                    onPaySubscription={handlePaySubscription}
                    showPaymentModal={showPaymentModal}
                    setShowPaymentModal={setShowPaymentModal}
                    paymentTermTarget={paymentTermTarget}
                    setPaymentTermTarget={setPaymentTermTarget}
                    paymentStep={paymentStep}
                    setPaymentStep={setPaymentStep}
                    paymentCardNumber={paymentCardNumber}
                    setPaymentCardNumber={setPaymentCardNumber}
                    paymentExpiry={paymentExpiry}
                    setPaymentCVV={setPaymentCVV}
                    paymentCVV={paymentCVV}

                    userRole={currentProfile.role}
                    students={students}
                    classes={classes}
                    termFeesConfigs={termFeesConfigs}
                    studentTermRegistrations={studentTermRegistrations}
                    isOfflineMode={isOfflineMode}
                    db={db}
                    saveOfflineItem={saveOfflineItem}
                    setStatusFeedback={setStatusFeedback}
                  />
                )}

                {/* LOCKED UPGRADE PAYWALL */}
                {currentSchool?.tier !== 'premium' && activeTab !== 'attendance' && activeTab !== 'roster' && (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-stone-200 shadow-3xs max-w-xl mx-auto text-center my-6">
                    <div className="p-4 bg-amber-500/10 text-[#D4A017] rounded-full mb-4 ring-8 ring-amber-500/5">
                      <Lock className="h-8 w-8 stroke-[2]" />
                    </div>
                    
                    <h3 className="text-xl font-display font-extrabold text-[#1B4332] tracking-tight">
                      Premium Plan Required
                    </h3>
                    
                    <p className="text-stone-500 text-xs mt-2 max-w-sm leading-relaxed">
                      Your school is currently registered on the <strong className="text-stone-700">Klaso Free Plan</strong>. 
                      Access to continuous gradebooks, installment ledgers, class teacher assignments, and spreadsheet reports are premium registry features.
                    </p>

                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 my-6 text-left space-y-2.5 max-w-sm w-full mx-auto">
                      <h4 className="text-3xs font-[#D4A017] font-bold text-stone-400 uppercase tracking-wider">Premium Advantages</h4>
                      <div className="flex items-start space-x-2 text-2xs text-[#1B4332]">
                        <span className="text-[#D4A017] font-bold">✔</span>
                        <span>Unlimited Ledger Reports (PDF/CSV download)</span>
                      </div>
                      <div className="flex items-start space-x-2 text-2xs text-[#1B4332]">
                        <span className="text-[#D4A017] font-bold">✔</span>
                        <span>Full Continuous Evaluation Gradebook (Tests/Exams)</span>
                      </div>
                      <div className="flex items-start space-x-2 text-2xs text-[#1B4332]">
                        <span className="text-[#D4A017] font-bold">✔</span>
                        <span>Tuition Installment Invoices Ledger Tracking</span>
                      </div>
                      <div className="flex items-start space-x-2 text-2xs text-[#1B4332]">
                        <span className="text-[#D4A017] font-bold">✔</span>
                        <span>Alphanumeric Student Codes Aligned with CBN Specs</span>
                      </div>
                    </div>

                    {currentProfile.role === 'admin' ? (
                      <button
                        onClick={async () => {
                          setPaymentTermTarget(currentTerm);
                          setShowPaymentModal(true);
                        }}
                        className="px-6 py-3 bg-[#0BA4DB] hover:bg-[#098bb9] text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer"
                      >
                        <span>Upgrade School via Paystack (₦20,000/term)</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="px-4 py-2.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-2xs font-mono uppercase tracking-wider font-bold">
                        Proprietor administrative action is required
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>
        </section>

      </main>

      {/* 3. MODALS CORNER SECTION */}
      {/* SCHOOL BADGE & BRANDING OVERLAY MODAL */}
      <AnimatePresence>
        {showSchoolBadgeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div aria-hidden="true" className="fixed inset-0 bg-stone-900/60 transition-opacity" onClick={() => setShowSchoolBadgeModal(false)}></div>

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl text-left shadow-2xl transform transition-all max-w-xl w-full max-h-[90vh] flex flex-col p-6 sm:p-7 border border-stone-200 relative z-10 overflow-y-auto font-sans"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-stone-150 pb-4 mb-5 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#1B4332]/10 rounded-xl text-[#1B4332]">
                    <Award className="h-6 w-6 text-[#1B4332]" />
                  </div>
                  <div>
                    <h3 className="text-base font-display font-bold text-stone-900">
                      School Badge & Official Crest
                    </h3>
                    <p className="text-3xs text-stone-500 font-medium mt-0.5">
                      Configured logo prints automatically on Report Cards, ID Badges, Invoices & Receipts.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSchoolBadgeModal(false)} 
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Badge Preview Box */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 mb-5 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border-2 border-[#1B4332]/20 bg-white p-1 flex items-center justify-center shadow-3xs shrink-0 overflow-hidden">
                  {badgeInputUrl ? (
                    <img src={badgeInputUrl} alt="School Crest Preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center text-stone-300 flex flex-col items-center">
                      <Award className="h-6 w-6" />
                      <span className="text-[7px] font-bold uppercase tracking-wider">No Badge</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-bold text-stone-800 text-sm">{currentSchool?.name}</div>
                  <div className="text-3xs text-stone-500 flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Live Document Synchronization Active
                  </div>
                  <p className="text-[10px] text-stone-400 leading-tight">
                    This emblem will appear at the header of all official academic portfolios, pupil ID cards, and proprietor billing receipts.
                  </p>
                </div>
              </div>

              {/* Section 1: Presets */}
              <div className="space-y-4">
                <div>
                  <label className="block text-3xs font-bold text-stone-600 uppercase tracking-wider mb-2">
                    Option A: Choose Pre-designed Official School Crest
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {PRESET_SCHOOL_BADGES.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setBadgeInputUrl(preset.url)}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 transition cursor-pointer ${
                          badgeInputUrl === preset.url
                            ? 'border-[#1B4332] bg-emerald-50/50 ring-2 ring-[#1B4332]/20'
                            : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        <img src={preset.url} alt={preset.name} className="w-10 h-10 object-contain" />
                        <span className="text-[9px] font-bold text-stone-700 leading-tight">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 2: Upload custom image */}
                <div>
                  <label className="block text-3xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                    Option B: Upload Custom Badge / Logo Image
                  </label>
                  <label className="flex items-center justify-center gap-2 border border-dashed border-stone-300 rounded-xl p-3 bg-stone-50 hover:bg-stone-100/80 transition cursor-pointer text-xs font-semibold text-stone-700">
                    <Upload className="h-4 w-4 text-[#1B4332]" />
                    <span>Upload Image File (PNG / JPG / SVG)</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            alert("Badge photo must be less than 2MB");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (reader.result) {
                              setBadgeInputUrl(reader.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Section 3: Paste URL */}
                <div>
                  <label className="block text-3xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Option C: Direct Image Web Link (URL)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={badgeInputUrl}
                      onChange={(e) => setBadgeInputUrl(e.target.value)}
                      placeholder="https://example.com/school-crest.png"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-[#1B4332]"
                    />
                    {badgeInputUrl && (
                      <button 
                        type="button"
                        onClick={() => setBadgeInputUrl('')}
                        className="absolute right-2 top-2 text-stone-400 hover:text-stone-600 text-xs"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Section 4: School Info Details */}
                <div className="border-t border-stone-150 pt-4 space-y-3">
                  <div className="text-2xs font-bold text-stone-700 uppercase tracking-wider">
                    School Document Letterhead Information
                  </div>

                  <div>
                    <label className="block text-3xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      School Official Address (Prints on Invoices & Reports)
                    </label>
                    <input
                      type="text"
                      value={schoolAddressInput}
                      onChange={(e) => setSchoolAddressInput(e.target.value)}
                      placeholder="e.g. 14 Academic Way, Umuahia, Abia State"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#1B4332]"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      School Contact Phone / Desk Number
                    </label>
                    <input
                      type="text"
                      value={schoolPhoneInput}
                      onChange={(e) => setSchoolPhoneInput(e.target.value)}
                      placeholder="e.g. +234 803 123 4567"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#1B4332]"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-stone-150 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSaveSchoolBadge('')}
                  className="px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                >
                  Remove Badge
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSchoolBadgeModal(false)}
                    className="px-4 py-2 border border-stone-300 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveSchoolBadge(badgeInputUrl)}
                    className="px-5 py-2 bg-[#1B4332] text-white font-bold rounded-xl text-xs hover:bg-[#143225] transition shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="h-4 w-4 text-[#D4A017]" />
                    <span>Save & Sync Branding</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* A. ADD TEACHER OVERLAY MODAL */}
      <AnimatePresence>
        {showAddTeacherModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              
              <div aria-hidden="true" className="fixed inset-0 bg-stone-900/60 transition-opacity" onClick={() => setShowAddTeacherModal(false)}></div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative z-50 inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full p-6 border border-stone-200"
              >
                <div className="flex items-start justify-between border-b border-stone-100 pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <UserPlus className="h-5 w-5 text-[#1B4332]" />
                    <h3 className="text-base font-display font-bold text-stone-900">
                      Add Teacher Profile
                    </h3>
                  </div>
                  <button onClick={() => setShowAddTeacherModal(false)} className="text-stone-400 hover:text-stone-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleAddNewTeacherProfile} className="space-y-4 font-sans">
                  <div>
                    <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      Teacher Legal Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mrs. Chioma Amadi"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                      value={newTeacherName}
                      onChange={(e) => setNewTeacherName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      Teacher Private Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. teacher.amadi@school.edu"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                      value={newTeacherEmail}
                      onChange={(e) => setNewTeacherEmail(e.target.value)}
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 text-2xs text-amber-900 leading-relaxed">
                    <strong>Self-Healing Portal active:</strong> Registered teachers can register their credentials directly by logging in on the Klaso home terminal with temporary passwords.
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => setShowAddTeacherModal(false)}
                      className="px-3 py-2 border border-stone-200 bg-white rounded-lg text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#1B4332] text-white hover:bg-[#143225] rounded-lg text-xs font-semibold scroll-py-1 select-none"
                    >
                      Establish Account
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* B. ADD TERM & CALENDAR MANAGEMENT OVERLAY MODAL */}
      <AnimatePresence>
        {showAddTermModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div aria-hidden="true" className="fixed inset-0 bg-stone-900/60 transition-opacity" onClick={() => setShowAddTermModal(false)}></div>

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl text-left shadow-xl transform transition-all max-w-lg w-full max-h-[90vh] flex flex-col p-6 border border-stone-200 relative z-10"
            >
              {/* Header - Fixed */}
              <div className="flex items-start justify-between border-b border-stone-100 pb-3 mb-4 shrink-0">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-[#1B4332]" />
                  <h3 className="text-base font-display font-bold text-stone-900">
                    Academic Calendar Manager
                  </h3>
                </div>
                <button onClick={() => setShowAddTermModal(false)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Sub tabs inside the Modal - Fixed */}
              <div className="flex border-b border-stone-100 mb-4 bg-stone-50/50 p-1 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setCalendarTab('label')}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    calendarTab === 'label'
                      ? 'bg-white text-[#1B4332] shadow-xs border border-stone-150'
                      : 'text-stone-500 hover:text-stone-850'
                  }`}
                >
                  Add Term Label
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarTab('dates')}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    calendarTab === 'dates'
                      ? 'bg-white text-[#1B4332] shadow-xs border border-stone-150'
                      : 'text-stone-500 hover:text-stone-850'
                  }`}
                >
                  Configure Period Dates
                </button>
              </div>

              {/* Scrollable Form Body Container with Generous Bottom Padding for Dropdown Clearances */}
              <div className="overflow-y-auto flex-1 pr-1 pb-16 space-y-4 scrollbar-thin">
                {calendarTab === 'label' ? (
                  <form onSubmit={handleAddTermLabel} className="space-y-4 font-sans text-sm">
                    <div>
                      <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                        Term Label Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. First Term 2026/2027"
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                        value={newTermName}
                        onChange={(e) => setNewTermName(e.target.value)}
                      />
                      <span className="text-3xs text-stone-400 mt-1 block">
                        Ensure specific, clear terms are generated for perfect school ledger alignments.
                      </span>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-4 border-t border-stone-100">
                      <button
                        type="button"
                        onClick={() => setShowAddTermModal(false)}
                        className="px-3 py-2 border border-stone-200 bg-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#1B4332] text-white hover:bg-[#143225] rounded-lg text-xs font-semibold select-none cursor-pointer"
                      >
                        Synchronize Term Label
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleUpdateTermConfig} className="space-y-4 font-sans text-sm">
                    <div>
                      <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                        Select Term Label to Configure
                      </label>
                      <select
                        value={calendarSelectedTerm}
                        onChange={(e) => handleCalendarTermChange(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white font-semibold cursor-pointer"
                      >
                        <option value="" disabled>-- Choose a term label --</option>
                        {currentSchool?.terms.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                          Academic Start Month
                        </label>
                        <select
                          value={termStartMonth}
                          onChange={(e) => setTermStartMonth(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white font-medium cursor-pointer"
                        >
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                          Academic End Month
                        </label>
                        <select
                          value={termEndMonth}
                          onChange={(e) => setTermEndMonth(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white font-medium cursor-pointer"
                        >
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                          Countdown Start Date
                        </label>
                        <input
                          type="date"
                          required
                          value={termStartDate}
                          onChange={(e) => setTermStartDate(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                          Countdown End Date
                        </label>
                        <input
                          type="date"
                          required
                          value={termEndDate}
                          onChange={(e) => setTermEndDate(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="mt-1">
                      <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                        Click on Calendar Grid to Highlight Range
                      </label>
                      <div className="border border-stone-200 rounded-xl p-1 bg-stone-50/50">
                        <VisualCalendarWidget
                          startDate={termStartDate}
                          endDate={termEndDate}
                          onChange={(start, end) => {
                            setTermStartDate(start);
                            setTermEndDate(end);
                          }}
                          readOnly={false}
                        />
                      </div>
                    </div>

                    <span className="text-3xs text-stone-500 mt-1 block leading-relaxed font-sans font-medium">
                      Entering start/end parameters activates real-time clock displays on both teacher and administrator portals. Finalized sessions lock teacher scoring automatically.
                    </span>

                    <div className="flex justify-end gap-2.5 pt-4 border-t border-stone-100">
                      <button
                        type="button"
                        onClick={() => setShowAddTermModal(false)}
                        className="px-3 py-2 border border-stone-200 bg-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!calendarSelectedTerm}
                        className={`px-4 py-2 bg-[#1B4332] text-white hover:bg-[#143225] rounded-lg text-xs font-semibold select-none cursor-pointer ${
                          !calendarSelectedTerm ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        Save Calendar Period
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* C. EDIT STUDENT DETAIL OVERLAY MODAL */}
      <AnimatePresence>
        {editingStudent && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              
              <div aria-hidden="true" className="fixed inset-0 bg-stone-900/60 transition-opacity" onClick={() => setEditingStudent(null)}></div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative z-50 inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full p-6 border border-stone-200"
              >
                <div className="flex items-start justify-between border-b border-stone-100 pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <Pencil className="h-5 w-5 text-[#1B4332]" />
                    <h3 className="text-base font-display font-bold text-stone-900">
                      Edit Pupil Profile
                    </h3>
                  </div>
                  <button onClick={() => setEditingStudent(null)} className="text-stone-400 hover:text-stone-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateStudent} className="space-y-4 font-sans">
                  <div>
                    <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      Sequential Code Badge (Read-Only)
                    </label>
                    <input
                      type="text"
                      disabled
                      className="w-full px-3 py-2 border border-stone-200 bg-stone-50 rounded-lg text-xs font-mono text-stone-500 cursor-not-allowed"
                      value={editingStudent.code}
                    />
                  </div>

                  <div>
                    <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      Pupil Full Legal Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chinedu Okafor"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                      value={editStudentName}
                      onChange={(e) => setEditStudentName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      Email address
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. student@school.edu"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                      value={editStudentEmail}
                      onChange={(e) => setEditStudentEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      Telephone / Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +234 803 123 4567"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                      value={editStudentPhone}
                      onChange={(e) => setEditStudentPhone(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      Student Type Designation
                    </label>
                    <div className="flex gap-4 mt-1">
                      <label className="flex items-center space-x-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                        <input
                          type="radio"
                          name="editStudentType"
                          value="new"
                          checked={editStudentType === 'new'}
                          onChange={() => setEditStudentType('new')}
                          className="text-[#1B4332] focus:ring-[#1B4332]"
                        />
                        <span>New Pupil</span>
                      </label>
                      <label className="flex items-center space-x-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                        <input
                          type="radio"
                          name="editStudentType"
                          value="returning"
                          checked={editStudentType === 'returning'}
                          onChange={() => setEditStudentType('returning')}
                          className="text-[#1B4332] focus:ring-[#1B4332]"
                        />
                        <span>Returning Pupil</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      Passport Photograph
                    </label>
                    <div 
                      onClick={() => {
                        if (!editStudentPassport) {
                          editStudentFileInputRef.current?.click();
                        }
                      }}
                      className={`mt-1 flex flex-col items-center gap-1.5 p-3.5 border-2 border-dashed border-stone-300 hover:border-[#1B4332] rounded-xl bg-stone-50/50 hover:bg-white transition relative ${!editStudentPassport ? 'cursor-pointer' : ''}`}
                    >
                      <input
                        ref={editStudentFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const read = new FileReader();
                            read.onloadend = () => setEditStudentPassport(read.result as string);
                            read.readAsDataURL(f);
                          }
                        }}
                        className="hidden"
                      />
                      {editStudentPassport ? (
                        <div className="flex flex-col items-center">
                          <img
                            src={editStudentPassport}
                            alt="Passport preview"
                            referrerPolicy="no-referrer"
                            className="h-16 w-16 object-cover rounded-full border border-stone-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditStudentPassport('');
                            }}
                            className="text-red-500 hover:text-red-700 text-3xs font-semibold mt-1 cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <p className="text-3xs text-stone-500 font-medium">Click to select file</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-4 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => setEditingStudent(null)}
                      className="px-3 py-2 border border-stone-200 bg-white rounded-lg text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#1B4332] text-white hover:bg-[#143225] rounded-lg text-xs font-semibold transition"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ADVANCED STUDENT DETAILED REGISTRATION OVERLAY */}
      <AnimatePresence>
        {showDetailStudentModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div aria-hidden="true" className="fixed inset-0 bg-stone-900/60 transition-opacity" onClick={() => setShowDetailStudentModal(false)}></div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative z-50 inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full p-6 border border-stone-200"
              >
                <div className="flex items-start justify-between border-b border-stone-100 pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <UserPlus className="h-5 w-5 text-[#1B4332]" />
                    <h3 className="text-base font-display font-bold text-stone-900">
                      Advanced Pupil Registration Form
                    </h3>
                  </div>
                  <button type="button" onClick={() => setShowDetailStudentModal(false)} className="text-stone-400 hover:text-stone-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fData = new FormData(e.currentTarget);
                    const name = (fData.get('name') as string || '').trim();
                    const email = (fData.get('email') as string || '').trim();
                    const phone = (fData.get('phone') as string || '').trim();
                    const studentType = (fData.get('studentType') as 'new' | 'returning') || 'new';
                    const targetClassId = fData.get('targetClassId') as string;
                    const registerCurrentTerm = fData.get('registerCurrentTerm') === 'true';
                    const firstInstallmentAmount = parseFloat(fData.get('firstInstallmentAmount') as string || '0') || 0;
                    const termNote = (fData.get('termNote') as string || '').trim();

                    // Check duplicate first
                    const duplicate = findDuplicateStudent(name, email, phone);
                    if (duplicate) {
                      const dupClass = classes.find(c => c.id === duplicate.class_id)?.name || 'another class';
                      const proceed = window.confirm(
                        `🚨 WARNING: DETECTED DUPLICATE PROFILE\n\n` +
                        `A student named "${duplicate.name}" is already registered in class "${dupClass}" [Code: ${duplicate.code}].\n\n` +
                        `Are you sure you want to register them anyway? This will result in duplicate record entries.`
                      );
                      if (!proceed) return;
                    }

                    // Call helper
                    await handleCreateDetailedStudent(
                      name,
                      email,
                      phone,
                      newStudentPassport,
                      studentType,
                      targetClassId,
                      registerCurrentTerm,
                      firstInstallmentAmount,
                      termNote
                    );

                    // Reset/close
                    setShowDetailStudentModal(false);
                    setNewStudentPassport('');
                    setNewStudentDetailName('');
                    setNewStudentDetailEmail('');
                    setNewStudentPhone('');
                  }}
                  className="space-y-4 font-sans"
                >
                  {/* Row 1: Legal Name */}
                  <div>
                    <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      Pupil Full Legal Name *
                    </label>
                    <input
                      name="name"
                      type="text"
                      required
                      placeholder="e.g. Sylvanus Obi"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium"
                      value={newStudentDetailName}
                      onChange={(e) => setNewStudentDetailName(e.target.value)}
                    />
                  </div>

                  {/* Detailed Reg Duplicate Warning Box */}
                  {(() => {
                    const dup = findDuplicateStudent(newStudentDetailName, newStudentDetailEmail, newStudentPhone);
                    if (dup) {
                      const dupClass = classes.find(c => c.id === dup.class_id)?.name || 'another class';
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-[#7F5F00] leading-normal"
                        >
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-amber-800">Duplicate Flag:</span> Pupil already registered!
                            <div className="mt-1 bg-white/70 p-2.5 rounded-lg border border-amber-200/60 text-stone-700 text-xs space-y-0.5">
                              <div><strong>Name:</strong> {dup.name}</div>
                              <div><strong>Room/Class:</strong> {dupClass}</div>
                              <div><strong>Assigned Code:</strong> <span className="font-mono text-[#1B4332] font-bold bg-[#1B4332]/5 px-1 py-0.5 rounded">{dup.code}</span></div>
                              {dup.email && <div><strong>Email:</strong> {dup.email}</div>}
                              {dup.phone && <div><strong>Phone:</strong> {dup.phone}</div>}
                            </div>
                            <p className="mt-1 text-2xs text-[#7F5F00]/80 font-medium">Please verify the roster details to confirm if this is a double registration.</p>
                          </div>
                        </motion.div>
                      );
                    }
                    return null;
                  })()}

                  {/* Row 2: Contact Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                        Email Address
                      </label>
                      <input
                        name="email"
                        type="email"
                        placeholder="e.g. obi@school.edu"
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                        value={newStudentDetailEmail}
                        onChange={(e) => setNewStudentDetailEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                        Emergency Contact Phone *
                      </label>
                      <input
                        name="phone"
                        type="tel"
                        required
                        placeholder="e.g. +234 803 445 1234"
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                        value={newStudentPhone}
                        onChange={(e) => setNewStudentPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 3: Class Assignment & Designation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                        Assigned Classroom *
                      </label>
                      <select
                        name="targetClassId"
                        defaultValue={selectedClassId || (classes[0]?.id || '')}
                        required
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white font-medium cursor-pointer"
                      >
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                        Student Classification
                      </label>
                      <select
                        name="studentType"
                        id="new_registration_student_type"
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white font-medium cursor-pointer"
                        onChange={() => {
                          const val = (document.getElementById('new_registration_student_type') as HTMLSelectElement)?.value;
                          setNewStudentType(val === 'new' ? 'new' : 'returning');
                        }}
                      >
                        <option value="new">New Student / Applicant</option>
                        <option value="returning">Returning Student</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Passport Photo Upload */}
                  <div>
                    <label className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                      Passport Photo Attachment
                    </label>
                    <div 
                      onClick={() => {
                        if (!newStudentPassport) {
                          newStudentFileInputRef.current?.click();
                        }
                      }}
                      className={`mt-1 flex flex-col items-center gap-1.5 p-4 border-2 border-dashed border-stone-300 hover:border-[#1B4332] rounded-xl bg-stone-50 hover:bg-white transition relative ${!newStudentPassport ? 'cursor-pointer' : ''}`}
                    >
                      <input
                        ref={newStudentFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const read = new FileReader();
                            read.onloadend = () => setNewStudentPassport(read.result as string);
                            read.readAsDataURL(f);
                          }
                        }}
                        className="hidden"
                      />
                      {newStudentPassport ? (
                        <div className="flex flex-col items-center">
                          <img
                            src={newStudentPassport}
                            alt="Passport Preview"
                            referrerPolicy="no-referrer"
                            className="h-20 w-20 object-cover rounded-full border border-stone-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewStudentPassport('');
                            }}
                            className="text-red-500 hover:text-red-700 text-3xs font-semibold mt-1 cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <p className="text-xs text-stone-600 font-semibold mb-1">Upload student passport</p>
                          <p className="text-3xs text-stone-400 font-medium font-sans">JPEG, PNG up to 2MB (click to select)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 5: Term Ledger & Immediate Billing Integration */}
                  <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <input
                          id="register_immediate_current_term"
                          name="registerCurrentTerm"
                          type="checkbox"
                          value="true"
                          defaultChecked={true}
                          className="h-3.5 w-3.5 rounded border-emerald-300 text-emerald-800 focus:ring-emerald-700 cursor-pointer"
                          onChange={(e) => {
                            const show = e.target.checked;
                            const el = document.getElementById('immediate_term_ledger_block');
                            if (el) el.style.display = show ? 'block' : 'none';
                          }}
                        />
                        <label htmlFor="register_immediate_current_term" className="text-xs font-semibold text-stone-800 cursor-pointer">
                          Activate Financial Record for {currentTerm}
                        </label>
                      </div>
                      <span className="text-3xs font-mono font-medium text-emerald-800 uppercase tracking-widest">ledger-auth</span>
                    </div>

                    <div id="immediate_term_ledger_block" className="space-y-3 border-t border-emerald-100 pt-3 row-term-billing">
                      <div className="flex items-center justify-between text-xs bg-[#1B4332]/5 px-2.5 py-1.5 rounded-lg border border-emerald-800/10">
                        <span className="text-stone-600 font-medium">Expected Academic Fee:</span>
                        <span className="font-mono font-bold text-emerald-950">
                          ₦{(
                            termFeesConfigs.find(f => f.term === currentTerm)?.[newStudentType === 'new' ? 'newStudentFee' : 'returningStudentFee'] || 
                            (newStudentType === 'new' ? 150000 : 100000)
                          ).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-3xs font-semibold text-stone-500 uppercase tracking-widest mb-1">
                            First Installment Downpayment (₦)
                          </label>
                          <input
                            name="firstInstallmentAmount"
                            type="number"
                            min="0"
                            placeholder="e.g. 50000"
                            className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs font-mono font-medium focus:ring-[#1B4332]"
                          />
                        </div>
                        <div>
                          <label className="block text-3xs font-semibold text-stone-500 uppercase tracking-widest mb-1">
                            Name Note / Term Note suffix
                          </label>
                          <input
                            name="termNote"
                            type="text"
                            placeholder="e.g. Scholar, Transferred"
                            className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-4 border-t border-stone-100 mt-4">
                    <button
                      type="button"
                      onClick={() => setShowDetailStudentModal(false)}
                      className="px-3.5 py-2 border border-stone-200 bg-white rounded-lg text-xs font-semibold cursor-pointer text-stone-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4.5 py-2 bg-[#1B4332] text-white hover:bg-[#143225] rounded-lg text-xs font-semibold select-none cursor-pointer transition shadow-xs"
                    >
                      Register and Enroll Pupil
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* D. SCHOOL ID CARD GENERATOR AND PRINT OVERLAY */}
      <AnimatePresence>
        {showIdCardModal && selectedIdCardStudent && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" id="id-card-print-root">
            {/* Scoped print style sheet */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body {
                  background: white !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .no-print-area {
                  display: none !important;
                }
                .id-cards-print-wrapper {
                  display: flex !important;
                  flex-direction: row !important;
                  justify-content: center !important;
                  gap: 30px !important;
                  padding: 40px !important;
                  background: white !important;
                  width: 100% !important;
                  height: auto !important;
                  position: absolute !important;
                  top: 0 !important;
                  left: 0 !important;
                }
                .id-card-viewport {
                  box-shadow: none !important;
                  border: 2px solid #e2e8f0 !important;
                  break-inside: avoid !important;
                }
              }
            `}} />

            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div 
                className="fixed inset-0 bg-stone-900/75 transition-opacity no-print-area" 
                onClick={() => setShowIdCardModal(false)}
              ></div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen no-print-area" aria-hidden="true">&#8203;</span>

              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative z-50 inline-block align-middle bg-zinc-100 rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle max-w-3xl w-full p-6 border border-stone-200"
              >
                {/* Modal Header Controls */}
                <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-5 no-print-area">
                  <div className="flex items-center space-x-2">
                    <Contact className="h-5 w-5 text-[#1B4332]" />
                    <div>
                      <h3 className="text-sm font-sans font-extrabold text-stone-900 leading-none">
                        Student ID Badge Portal
                      </h3>
                      <p className="text-3xs text-stone-500 font-medium font-sans uppercase tracking-wider mt-1">
                        Professional dual-sided card generator
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowIdCardModal(false)}
                    className="p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-200/50 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Subtitle / Tip bar */}
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl mb-5 flex items-start gap-2 text-2xs text-emerald-800 leading-normal no-print-area">
                  <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-900">School Klaso OS Compliance Badge:</span> Print this page directly using your office card printer. We have generated standard high-contrast dual portrait face overlays. Select portrait layout for plastic lamination layouts!
                  </div>
                </div>

                {/* Main Interface Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Side Tool Controls */}
                  <div className="md:col-span-4 space-y-4 no-print-area font-sans text-xs">
                    <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-3xs space-y-3.5">
                      <div className="text-[11px] font-bold text-stone-600 uppercase tracking-widest border-b border-stone-100 pb-1.5 flex justify-between items-center">
                        <span>Card Data Elements</span>
                        <span className="font-mono bg-emerald-50 text-[#1B4332] px-1 py-0.5 rounded text-4xs">verified</span>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-3xs font-bold text-stone-400 uppercase">Pupil Legal Name</span>
                        <div className="font-semibold text-stone-800 text-sm truncate">{selectedIdCardStudent.name}</div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-3xs font-bold text-stone-400 uppercase">Student Reg Code</span>
                        <div className="font-mono font-extrabold text-[#1B4332] text-xs bg-[#1B4332]/5 w-fit px-1.5 py-0.5 rounded-md">
                          {selectedIdCardStudent.code}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-3xs font-bold text-stone-400 uppercase">Assigned Class</span>
                        <div className="font-semibold text-stone-700">
                          {classes.find(c => c.id === selectedIdCardStudent.class_id)?.name || 'No Classroom'}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-3xs font-bold text-stone-400 uppercase">Contact Phone</span>
                        <div className="font-mono text-stone-600">{selectedIdCardStudent.phone || 'None Attached'}</div>
                      </div>

                      <div className="space-y-1.5 border-t border-stone-100 pt-2.5">
                        <span className="text-3xs font-bold text-stone-400 uppercase block mb-1">Upload Badge Passport</span>
                        <label className="flex items-center justify-center border border-dashed border-stone-300 rounded-lg p-2 hover:bg-stone-50 transition cursor-pointer text-3xs font-semibold text-stone-600">
                          <Plus className="h-3.5 w-3.5 mr-1 text-[#1B4332]" />
                          Replace Headshot Photo
                          <input 
                            type="file" 
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 2 * 1024 * 1024) {
                                  alert("Photo must be less than 2MB");
                                  return;
                                }
                                const r = new FileReader();
                                r.onload = async () => {
                                  const base64 = r.result as string;
                                  // Update student locally
                                  const updated = students.map(s => s.id === selectedIdCardStudent.id ? { ...s, passport: base64 } : s);
                                  // update remote/offline
                                  if (isOfflineMode) {
                                    saveOfflineItem('rc_students', updated);
                                    setStudents(updated);
                                    setSelectedIdCardStudent({ ...selectedIdCardStudent, passport: base64 });
                                  } else {
                                    try {
                                      await setDoc(doc(db, 'students', selectedIdCardStudent.id), { passport: base64 }, { merge: true });
                                      setStudents(updated);
                                      setSelectedIdCardStudent({ ...selectedIdCardStudent, passport: base64 });
                                    } catch (err: any) {
                                      alert("Could not persist passport: " + err.message);
                                    }
                                  }
                                };
                                r.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Print Action Trigger Buttons */}
                    <div className="space-y-2">
                      <button
                        onClick={() => window.print()}
                        className="w-full py-2.5 bg-[#1B4332] text-white hover:bg-[#143225] font-bold rounded-xl shadow-md cursor-pointer transition flex items-center justify-center space-x-1.5"
                      >
                        <Printer className="h-4 w-4 text-[#D4A017]" />
                        <span>Print High-Res Badges</span>
                      </button>
                      <button
                        onClick={() => {
                          setIdCardSide(prev => prev === 'front' ? 'back' : 'front');
                        }}
                        className="w-full py-2 border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-bold rounded-xl cursor-pointer transition flex items-center justify-center space-x-1.5 md:hidden"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Flip Side ({idCardSide === 'front' ? 'Back' : 'Front'})</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Side Visual Render Side-by-side or Flippable container */}
                  <div className="md:col-span-8 flex flex-col items-center justify-center gap-4 bg-stone-200/50 p-4 rounded-2xl border border-stone-300/40 relative">
                    <span className="absolute top-2.5 right-2.5 text-3xs font-mono font-bold bg-white/85 text-stone-500 border border-stone-150 px-2 py-0.5 rounded-full uppercase tracking-widest no-print-area">
                      Roster badge-eng.v1
                    </span>

                    {/* Double Badge Print Frame Layout */}
                    <div className="id-cards-print-wrapper flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
                      
                      {/* FRONT CARD SIDE VIEW */}
                      <div 
                        className={`id-card-viewport w-[265px] h-[390px] bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden relative font-sans flex flex-col justify-between shrink-0 select-none ${
                          idCardSide === 'back' ? 'hidden sm:flex' : 'flex'
                        }`}
                      >
                        {/* Header Section */}
                        <div className="bg-[#1B4332] text-white px-3.5 pt-3 pb-2.5 text-center relative border-b-2 border-[#D4A017]">
                          <div className="text-[10px] font-display font-extrabold uppercase tracking-wide truncate max-w-full leading-tight text-white flex items-center justify-center gap-1.5">
                            {(currentSchool?.badgeUrl || currentSchool?.logoUrl) ? (
                              <img 
                                src={currentSchool.badgeUrl || currentSchool.logoUrl} 
                                alt="Crest" 
                                className="h-4 w-4 object-contain rounded-xs bg-white/10 p-0.5 shrink-0" 
                              />
                            ) : (
                              <Sparkles className="h-3 w-3 text-[#D4A017] shrink-0" />
                            )}
                            <span className="truncate">{currentSchool?.name || 'Klaso Academy'}</span>
                          </div>
                          <div className="text-[7px] text-[#D4A017] font-sans font-bold uppercase tracking-widest leading-none mt-1">
                            Secondary School official register
                          </div>
                          
                          {/* Nigerian National Accent Band */}
                          <div className="absolute top-0 left-0 right-0 h-1 flex">
                            <div className="bg-emerald-600 flex-1"></div>
                            <div className="bg-white w-2 sm:w-3"></div>
                            <div className="bg-emerald-600 flex-1"></div>
                          </div>
                        </div>

                        {/* Card Content Core Body */}
                        <div className="p-4 flex flex-col items-center flex-1 justify-center space-y-3 relative overflow-hidden bg-radial from-stone-50 to-white">
                          
                          {/* Background faint watermark code */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
                            <Contact className="w-52 h-52 text-stone-900" />
                          </div>

                          {/* Passport Photo Frame container */}
                          <div className="relative">
                            <div className="w-24 h-28 bg-stone-100 rounded-lg border-2 border-[#1B4332]/25 shadow-xs overflow-hidden flex items-center justify-center bg-stone-50">
                              {selectedIdCardStudent.passport ? (
                                <img 
                                  src={selectedIdCardStudent.passport} 
                                  alt="Student Passport" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-1.5 text-center p-2">
                                  <Users className="w-8 h-8 text-stone-300 stroke-[1.5]" />
                                  <span className="text-[8px] text-stone-400 font-bold uppercase tracking-widest leading-none">NO PHOTO</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Student Type overlay indicator ribbon */}
                            <div className="absolute -bottom-1.5 -right-1">
                              <span className={`text-[7px] font-mono font-extrabold py-0.5 px-1.5 rounded-full text-white shadow-3xs uppercase tracking-wider ${
                                selectedIdCardStudent.studentType === 'new' 
                                  ? 'bg-amber-600 border border-amber-400' 
                                  : 'bg-[#1B4332] border border-emerald-500'
                              }`}>
                                {selectedIdCardStudent.studentType || 'returning'}
                              </span>
                            </div>
                          </div>

                          {/* Demographics Detail Area */}
                          <div className="text-center w-full z-10">
                            <div className="font-display font-black text-stone-900 text-sm tracking-tight leading-tight uppercase px-1 line-clamp-2 max-h-10">
                              {selectedIdCardStudent.name}
                            </div>
                            
                            {/* Class/Classroom designation tag */}
                            <div className="text-[#1B4332] text-[9px] font-extrabold tracking-wide uppercase mt-1 leading-none">
                              Class: {classes.find(c => c.id === selectedIdCardStudent.class_id)?.name || 'Unassigned'}
                            </div>
                          </div>

                          {/* Code and Expiry details inside a grid */}
                          <div className="grid grid-cols-2 gap-2 text-left w-full border-t border-stone-100 pt-2.5">
                            <div>
                              <div className="text-[6px] text-stone-400 uppercase tracking-widest font-extrabold">Student ID / Seq Code</div>
                              <div className="text-[10px] font-mono font-extrabold text-[#1B4332] mt-0.5">{selectedIdCardStudent.code}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[6px] text-stone-400 uppercase tracking-widest font-extrabold">Academic Term</div>
                              <div className="text-[9px] font-bold text-stone-700 mt-0.5 max-w-[100px] truncate leading-none ml-auto" title={currentTerm}>
                                {currentTerm.split(' ')[0]} {currentTerm.split(' ').slice(-1)[0]}
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* ID Flag Ribbon bottom bar */}
                        <div className="bg-stone-50 border-t border-stone-150 px-3 py-2 flex items-center justify-between text-left">
                          <div className="flex flex-col">
                            <span className="text-[6px] text-stone-400 uppercase tracking-wider font-extrabold">AUTHORITY SIGNATURE</span>
                            <span className="text-[10px] font-serif italic text-emerald-800 font-bold leading-none mt-0.5 tracking-tight">Principal Dr. Obi</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <span className="font-mono text-[7px] text-[#1B4332] font-black border border-[#1B4332]/30 rounded px-1 py-0.5 bg-emerald-50">RC-NGA</span>
                          </div>
                        </div>

                      </div>

                      {/* BACK CARD SIDE VIEW */}
                      <div 
                        className={`id-card-viewport w-[265px] h-[390px] bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden relative font-sans flex flex-col justify-between shrink-0 select-none ${
                          idCardSide === 'front' ? 'hidden sm:flex' : 'flex'
                        }`}
                      >
                        {/* Solid Green accent top block */}
                        <div className="bg-[#1B4332] h-4 w-full border-b border-[#D4A017]"></div>

                        {/* Body copy of the back terms and barcode */}
                        <div className="p-4 flex flex-col items-center justify-between flex-1 space-y-4 pt-5 bg-radial from-[#FAF7F0] to-white">
                          
                          {/* Top instructions block */}
                          <div className="w-full space-y-2 border-b border-stone-100 pb-3">
                            <span className="text-[8px] font-extrabold text-stone-850 uppercase tracking-wider block text-center">Identity Card Conditions</span>
                            <ol className="text-[6px] text-stone-500 list-decimal list-inside space-y-1 leading-normal pl-0.5">
                              <li>This badge is non-transferable and remains the official property of {currentSchool?.name || 'this institution'}.</li>
                              <li>The student must wear this identification placard conspicuously during school assemblies and daily classroom periods.</li>
                              <li>If misplaced or recovered, present the card immediately to the Admin or nearest Registry Desk.</li>
                              <li>Loss of badge entails a compliance re-issuance processing levy.</li>
                            </ol>
                          </div>

                          {/* Emergency Contact details */}
                          <div className="text-center w-full space-y-1">
                            <div className="text-[6.5px] text-stone-400 uppercase tracking-widest font-bold">In Emergency Cases, Call Parent</div>
                            <div className="text-xs font-mono font-extrabold text-[#1B4332] bg-emerald-55/10 px-2 py-1 rounded-md border border-emerald-150 inline-block font-sans">
                              {selectedIdCardStudent.phone || 'N/A: Not Configured'}
                            </div>
                            <div className="text-[6px] text-stone-400 leading-normal mt-1">
                              School Operating System Powered by Klaso Compliance
                            </div>
                          </div>

                          {/* Simulated high-fidelity Barcode vector generator */}
                          <div className="w-full flex flex-col items-center space-y-1.5 border-t border-stone-100 pt-3">
                            <div className="flex gap-[1.5px] items-stretch h-8">
                              {/* Custom pseudo-random high density barcode generator */}
                              {[1,3,1,1,2,3,1,2,1,1,4,1,3,1,2,1,1,3,1,2,4,1,1,2,3,1,2,1].map((w, idx) => (
                                <div 
                                  key={idx} 
                                  className="bg-stone-900 shrink-0" 
                                  style={{ width: `${w}px` }}
                                ></div>
                              ))}
                            </div>
                            <span className="font-mono text-[7px] text-stone-500 uppercase tracking-widest">
                              *ID-{selectedIdCardStudent.code}*
                            </span>
                          </div>

                        </div>

                        {/* Bottom security strip with Nigerian Green/White accent */}
                        <div className="bg-[#1B4332] text-white py-1.5 px-3 text-center text-[7px] font-bold font-mono tracking-widest flex items-center justify-between border-t border-[#D4A017]">
                          <span>DIGITAL STUDENT PASSPORT</span>
                          <span className="text-[#D4A017] uppercase">klaso os</span>
                        </div>

                      </div>

                    </div>
                  </div>

                </div>

              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* E. PAYSTACK PAYMENT MODAL */}
      {showPaymentModal && currentSchool && currentProfile && (
        <PaystackPaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          termToPay={paymentTermTarget || currentTerm}
          currentSchool={currentSchool}
          currentProfile={currentProfile}
          onPaymentComplete={async (record) => {
            await handlePaySubscription(paymentTermTarget || currentTerm, record);
          }}
        />
      )}

    </div>
  );
}

interface TermCountdownBannerProps {
  currentSchool: School | null;
  currentTerm: string;
  currentProfile: Profile | null;
  onOpenCalendarSettings: () => void;
}

function TermCountdownBanner({ currentSchool, currentTerm, currentProfile, onOpenCalendarSettings }: TermCountdownBannerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    status: 'upcoming' | 'active' | 'ended' | 'none';
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, status: 'none' });

  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    const config = currentSchool?.termConfigs?.[currentTerm];
    if (!config || !config.startDate || !config.endDate) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, status: 'none' });
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const start = new Date(config.startDate);
      const end = new Date(config.endDate);
      end.setHours(23, 59, 59, 999);

      if (now < start) {
        const diff = start.getTime() - now.getTime();
        const s = Math.floor(diff / 1000);
        setTimeLeft({
          days: Math.floor(s / 86400),
          hours: Math.floor((s % 86400) / 3600),
          minutes: Math.floor((s % 3600) / 60),
          seconds: s % 60,
          status: 'upcoming'
        });
      } else if (now >= start && now <= end) {
        const diff = end.getTime() - now.getTime();
        const s = Math.floor(diff / 1000);
        setTimeLeft({
          days: Math.floor(s / 86400),
          hours: Math.floor((s % 86400) / 3600),
          minutes: Math.floor((s % 3600) / 60),
          seconds: s % 60,
          status: 'active'
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, status: 'ended' });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentSchool, currentTerm]);

  const config = currentSchool?.termConfigs?.[currentTerm];

  if (!config) {
    return (
      <div id="school-term-lock-unconfigured" className="bg-stone-50 border-b border-stone-200 px-4 py-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-stone-400 animate-pulse" />
            <span className="font-medium font-sans">
              Academic Term Session: <strong className="text-stone-800">{currentTerm}</strong> (Period dates & start/end months not yet configured)
            </span>
          </div>
          {currentProfile?.role === 'admin' && (
            <button
              onClick={onOpenCalendarSettings}
              className="text-2xs font-extrabold uppercase tracking-wide text-[#1B4332] hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <span>Setup Term Calendar & Countdown</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="school-term-lock-active" className={`border-b px-4 py-3 sm:px-6 lg:px-8 transition-all ${
      timeLeft.status === 'upcoming'
        ? 'bg-blue-50/50 border-blue-100 text-blue-900'
        : timeLeft.status === 'active'
          ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900'
          : 'bg-rose-50/60 border-rose-100 text-rose-950'
    }`}>
      <div className="max-w-7xl mx-auto col-span-full">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {timeLeft.status === 'upcoming' ? (
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-850 font-mono text-3xs uppercase font-extrabold tracking-wider">Upcoming</span>
            ) : timeLeft.status === 'active' ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-850 font-mono text-3xs uppercase font-extrabold tracking-wider animate-pulse">Session Active</span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-850 font-mono text-3xs uppercase font-extrabold tracking-wider">Term Completed</span>
            )}
            <span className="font-medium font-sans text-stone-700">
              Term: <strong className="text-stone-900">{currentTerm}</strong> | Period months: <strong className="text-stone-850">{config.startMonth} to {config.endMonth}</strong>
            </span>
            {config.startDate && (
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className="px-2 py-1 bg-white hover:bg-stone-50 border border-stone-200 text-[#1B4332] text-3xs font-extrabold uppercase tracking-wide rounded-md flex items-center gap-1 cursor-pointer transition shadow-3xs"
              >
                <Calendar className="h-3 w-3 text-amber-500" />
                <span>{showGrid ? 'Hide Calendar' : 'Show Calendar'}</span>
              </button>
            )}
          </div>

          {timeLeft.status === 'none' ? null : timeLeft.status === 'ended' ? (
            <div className="flex items-center space-x-2 text-rose-900 font-medium font-sans">
              <Lock className="h-4 w-4 text-rose-600 shrink-0" />
              <span>Academic session closed. System automatically finalized compilations & locked teacher inputs. Override active for Admin.</span>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <span className="text-stone-500 font-medium font-sans">{timeLeft.status === 'upcoming' ? 'Session starts in:' : 'Scoring lock countdown:'}</span>
              <div className="flex items-center space-x-1 font-mono text-xs font-black text-stone-900">
                <span className="bg-stone-900 text-white px-1.5 py-0.5 rounded-md">{String(timeLeft.days).padStart(2, '0')}</span>
                <span className="text-stone-400">:</span>
                <span className="bg-stone-900 text-white px-1.5 py-0.5 rounded-md">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-stone-400">:</span>
                <span className="bg-[#1B4332] text-white px-1.5 py-0.5 rounded-md">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="text-[#1B4332] font-semibold">:</span>
                <span className="bg-[#1B4332] text-white px-1.5 py-0.5 rounded-md">{String(timeLeft.seconds).padStart(2, '0')}</span>
              </div>
              {currentProfile?.role === 'admin' && (
                <button
                  onClick={onOpenCalendarSettings}
                  className="ml-2 text-3xs font-extrabold uppercase tracking-widest text-[#1B4332] hover:underline cursor-pointer"
                >
                  Change
                </button>
              )}
            </div>
          )}
        </div>

        {/* Collapsible live highlighting monthly grid */}
        <AnimatePresence>
          {showGrid && config.startDate && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 overflow-hidden flex flex-col md:flex-row gap-5 border-t border-stone-250/20 pt-3"
            >
              <div className="max-w-xs w-full bg-white rounded-xl shadow-xs border border-stone-200">
                <VisualCalendarWidget
                  startDate={config.startDate}
                  endDate={config.endDate}
                  readOnly={true}
                />
              </div>
              <div className="flex-1 text-stone-600 bg-stone-50 p-4 rounded-xl border border-stone-200/60 leading-relaxed text-xs self-start">
                <h4 className="font-bold text-stone-800 text-2xs uppercase tracking-widest mb-1.5 flex items-center">
                  <Info className="h-4 w-4 text-[#1B4332] mr-1" />
                  Term Period Specifications
                </h4>
                <ul className="space-y-1 text-2xs">
                  <li>🗓️ <strong>Academic Coverage:</strong> {config.startMonth} to {config.endMonth}</li>
                  <li>🚀 <strong>Countdown Ingestion:</strong> {new Date(config.startDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</li>
                  <li>🔒 <strong>Final Closing Lock:</strong> {new Date(config.endDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</li>
                  <li className="pt-1.5 text-stone-500 italic">This synchronized schedule locks continuous assessment scores automatically across teacher checkposts to preserve gradebook integrity.</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ==========================================
// INTERACTIVE CLICK-TO-SELECT RANGE HIGHLIGHTER
// ==========================================
interface VisualCalendarWidgetProps {
  startDate: string;
  endDate: string;
  onChange?: (start: string, end: string) => void;
  readOnly?: boolean;
}

const MONTHS_MAP = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function VisualCalendarWidget({ startDate, endDate, onChange, readOnly = true }: VisualCalendarWidgetProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (startDate) return new Date(startDate).getMonth();
    return new Date().getMonth();
  });
  const [viewYear, setViewYear] = useState(() => {
    if (startDate) return new Date(startDate).getFullYear();
    return new Date().getFullYear();
  });

  // Track initial load set
  useEffect(() => {
    if (startDate && startDate.length === 10) {
      const parts = startDate.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setViewYear(y);
          setViewMonth(m);
        }
      }
    }
  }, [startDate ? startDate.slice(0, 7) : '']);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const monthLabel = `${MONTHS_MAP[viewMonth]} ${viewYear}`;

  const handleDayClick = (day: number) => {
    if (readOnly || !onChange) return;

    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;

    if (!startDate || (startDate && endDate)) {
      onChange(dateStr, '');
    } else {
      const startNum = Number(startDate.replace(/-/g, ''));
      const clickedNum = Number(dateStr.replace(/-/g, ''));
      if (clickedNum >= startNum) {
        onChange(startDate, dateStr);
      } else {
        onChange(dateStr, '');
      }
    }
  };

  const gridCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    gridCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    gridCells.push(d);
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-3xs w-full max-w-sm">
      <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-2">
        <span className="text-xs font-bold text-stone-800 font-display">{monthLabel}</span>
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded transition-all cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded transition-all cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-bold text-stone-400 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(w => <div key={w}>{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridCells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} />;
          }

          const pad = (n: number) => String(n).padStart(2, '0');
          const currentCellDateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
          
          const startNum = startDate ? Number(startDate.replace(/-/g, '')) : 0;
          const endNum = endDate ? Number(endDate.replace(/-/g, '')) : 0;
          const cellNum = Number(currentCellDateStr.replace(/-/g, ''));

          const isStart = startDate && currentCellDateStr === startDate;
          const isEnd = endDate && currentCellDateStr === endDate;
          const isInRange = startNum && endNum && cellNum > startNum && cellNum < endNum;

          let cellClass = "aspect-square flex flex-col items-center justify-center text-stone-700 hover:bg-stone-50 rounded text-2xs cursor-pointer font-medium font-mono relative transition-all";
          
          if (isStart) {
            cellClass = "aspect-square flex flex-col items-center justify-center bg-[#1B4332] text-white rounded font-bold text-2xs cursor-pointer font-mono ring-2 ring-emerald-500/20";
          } else if (isEnd) {
            cellClass = "aspect-square flex flex-col items-center justify-center bg-amber-500 text-white rounded font-bold text-2xs cursor-pointer font-mono ring-4 ring-amber-500/10";
          } else if (isInRange) {
            cellClass = "aspect-square flex flex-col items-center justify-center bg-emerald-50 text-emerald-800 hover:bg-[#1B4332]/10 rounded text-2xs cursor-pointer font-semibold font-mono";
          }

          const isToday = new Date().toLocaleDateString() === new Date(currentCellDateStr).toLocaleDateString();

          return (
            <button
              key={`day-${day}`}
              type="button"
              disabled={readOnly && !onChange}
              onClick={() => handleDayClick(day)}
              className={`${cellClass} ${isToday && !isStart && !isEnd ? 'border border-[#1B4332] text-[#1B4332] font-black' : ''}`}
            >
              <span>{day}</span>
              {isStart && <span className="absolute bottom-0 text-[5px] font-black text-white uppercase tracking-tighter">Start</span>}
              {isEnd && <span className="absolute bottom-0 text-[5px] font-black text-white uppercase tracking-tighter">End</span>}
            </button>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-3 pt-2 border-t border-stone-100 flex flex-wrap gap-x-3 gap-y-1 text-3xs font-medium text-stone-500 leading-snug">
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded bg-[#1B4332]" />
            <span>Click 1st: Start</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded bg-amber-500" />
            <span>Click 2nd: End</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-100" />
            <span>Range Highlighting Active</span>
          </div>
        </div>
      )}
    </div>
  );
}
