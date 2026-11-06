/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, setDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { School, Profile, Class, Student, AttendanceRecord } from '../types';

export const DEMO_ADMIN_EMAIL = 'mr.ogbuagu@school.edu';
export const DEMO_TEACHER_EMAIL = 'mrs.amadi@school.edu';
export const DEMO_PASSWORD = 'OgbuaguKlaso2026';

// Helper to check if database has any profiles inside
export async function isDatabaseSeeded(): Promise<boolean> {
  try {
    const q = query(collection(db, 'profiles'), limit(1)); // wait, limit is from firestore
    // let's just do a simple query
    const profilesSnap = await getDocs(collection(db, 'profiles'));
    return !profilesSnap.empty;
  } catch (e) {
    console.error('Check seed error:', e);
    return false;
  }
}

import { limit } from 'firebase/firestore';

export async function seedDemoDataForUser(userId: string, role: 'admin' | 'teacher', email: string): Promise<string> {
  try {
    // 1. Create a demo school
    const schoolId = 'focused-school-fgc-abia';
    const schoolRef = doc(db, 'schools', schoolId);
    
    const demoSchool: School = {
      id: schoolId,
      name: 'Federal Government College, Abia',
      terms: ['First Term 2025/2026', 'Second Term 2025/2026', 'Third Term 2025/2026'],
      created_at: new Date().toISOString(),
    };
    await setDoc(schoolRef, demoSchool);

    // 2. Create the targeted user profile
    const profileRef = doc(db, 'profiles', userId);
    const primaryProfile: Profile = {
      id: userId,
      school_id: schoolId,
      full_name: role === 'admin' ? 'Mr. Gamaliel Ogbuagu' : 'Mrs. Chioma Amadi',
      email: email,
      role: role,
      created_at: new Date().toISOString(),
    };
    await setDoc(profileRef, primaryProfile);

    // 3. Create the parallel profile to support role-swapping
    const secondaryUserId = role === 'admin' ? 'demo-teacher-uid-mrs-amadi' : 'demo-admin-uid-mr-ogbuagu';
    const secondaryEmail = role === 'admin' ? DEMO_TEACHER_EMAIL : DEMO_ADMIN_EMAIL;
    const secondaryRole = role === 'admin' ? 'teacher' : 'admin';
    const secondaryProfileRef = doc(db, 'profiles', secondaryUserId);
    
    // Check if secondary profile already exists
    const secondaryProfile: Profile = {
      id: secondaryUserId,
      school_id: schoolId,
      full_name: secondaryRole === 'admin' ? 'Mr. Gamaliel Ogbuagu' : 'Mrs. Chioma Amadi',
      email: secondaryEmail,
      role: secondaryRole,
      created_at: new Date().toISOString(),
    };
    await setDoc(secondaryProfileRef, secondaryProfile);

    // 4. We start with completely fresh and empty lists!
    // No default classes, students, assignments, subjects, configurations, or attendance records are generated.
    
    return schoolId;
  } catch (error) {
    console.error('Seeding process failed:', error);
    throw error;
  }
}
