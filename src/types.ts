/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TermConfig {
  startMonth: string;
  endMonth: string;
  startDate: string;
  endDate: string;
}

export interface School {
  id: string;
  name: string;
  terms: string[];
  termConfigs?: Record<string, TermConfig>;
  created_at?: string | any;
  address?: string;
  phone?: string;
  contactEmail?: string;
  badgeUrl?: string;
  logoUrl?: string;
  paymentStatus?: Record<string, string>;
  subscriptionPayments?: SubscriptionPaymentRecord[];
  tier?: 'free' | 'premium';
}

export interface SubscriptionPaymentRecord {
  id: string;
  reference: string;
  amount: number;
  term: string;
  paid_at: string;
  channel: string;
  customer_email: string;
  status: 'success';
}

export interface Profile {
  id: string;
  school_id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'teacher';
  generated_password?: string;
  created_at?: string | any;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  created_at?: string | any;
}

export interface ClassTeacherAssignment {
  id: string; // classId_teacherId
  class_id: string;
  teacher_id: string;
  school_id: string;
  created_at?: string | any;
}

export interface Student {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  code: string; // e.g. "JSS3-001"
  email?: string;
  phone?: string;
  passportUrl?: string;
  studentType?: 'new' | 'returning'; // Default value: 'new' or 'returning'
  created_at?: string | any;
}

export interface TermFeesConfig {
  id: string; // `${school_id}_${term}`
  school_id: string;
  term: string;
  newStudentFee: number;
  returningStudentFee: number;
  created_at?: string;
}

export interface StudentTermRegistration {
  id: string; // `${school_id}_${term}_${student_id}`
  school_id: string;
  term: string;
  student_id: string;
  studentType: 'new' | 'returning';
  addedToNameNote?: string; // custom addition or suffix note to student name
  totalFee: number;
  paidAmount: number;
  status: 'unpaid' | 'partial' | 'paid';
  payments: Array<{
    id: string;
    date: string;
    amount: number;
    reference?: string;
    notes?: string;
  }>;
  created_at?: string;
}

export type AttendanceStatus = 'early' | 'late';

export interface AttendanceRecord {
  id: string; // studentId_term_date
  school_id: string;
  class_id: string;
  student_id: string;
  term: string; // e.g. "First Term 2025/2026"
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  marked_by: string; // teacher's Profile.id
  created_at?: string | any;
}

// For reports screen:
export interface StudentReportRow {
  student: Student;
  onTimeCount: number;
  lateCount: number;
  absentCount: number;
  totalPresent: number;
  sessionsHeld: number;
  percentage: number;
  rating: 'Excellent' | 'Pass' | 'Fail';
}

export interface Subject {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  created_at?: string | any;
}

export type AssessmentType = 'assignment' | 'test' | 'exam';

export interface AssessmentConfig {
  id: string; // unique ID
  school_id: string;
  class_id: string;
  subject_id: string;
  name: string; // e.g., "Assignment 1", "Midterm Test", "Exam"
  type: AssessmentType;
  max_score: number; // e.g. 10, 20, 30, 60
  created_at?: string | any;
}

export interface StudentScore {
  id: string; // schoolId_classId_subjectId_studentId_term_assessmentConfigId
  school_id: string;
  class_id: string;
  subject_id: string;
  student_id: string;
  term: string;
  assessment_config_id: string;
  score: number;
  created_at?: string | any;
}

