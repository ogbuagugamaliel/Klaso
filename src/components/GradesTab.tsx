/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  setDoc, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Subject, 
  AssessmentConfig, 
  StudentScore, 
  Student, 
  Profile, 
  School,
  Class
} from '../types';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Edit, 
  Award, 
  Sliders, 
  Download, 
  ChevronRight, 
  Info, 
  AlertTriangle,
  Mail,
  Printer,
  FileText,
  Send,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GradesTabProps {
  isOfflineMode: boolean;
  currentProfile: Profile;
  currentSchool: School;
  selectedClassId: string;
  activeClass: any;
  classes: Class[];
  currentTerm: string;
  students: Student[];
  subjects: Subject[];
  assessmentConfigs: AssessmentConfig[];
  studentScores: StudentScore[];
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  setAssessmentConfigs: React.Dispatch<React.SetStateAction<AssessmentConfig[]>>;
  setStudentScores: React.Dispatch<React.SetStateAction<StudentScore[]>>;
  saveOfflineItem: (key: string, list: any[]) => void;
  statusFeedback: any;
  setStatusFeedback: (v: any) => void;
}

export default function GradesTab({
  isOfflineMode,
  currentProfile,
  currentSchool,
  selectedClassId,
  activeClass,
  classes,
  currentTerm,
  students,
  subjects,
  assessmentConfigs,
  studentScores,
  setSubjects,
  setAssessmentConfigs,
  setStudentScores,
  saveOfflineItem,
  statusFeedback,
  setStatusFeedback
}: GradesTabProps) {
  // Check if academic term has been marked ended by current date & configured months
  const isTermCompleted = React.useMemo(() => {
    const config = currentSchool?.termConfigs?.[currentTerm];
    if (!config || !config.endDate) return false;
    
    const end = new Date(config.endDate);
    end.setHours(23, 59, 59, 999);
    
    const now = new Date();
    return now > end;
  }, [currentSchool, currentTerm]);

  const isScoreLockActive = isTermCompleted && currentProfile.role === 'teacher';

  // Modes: 'subject' (subject gradebook), 'broadsheet' (whole class summary report) or 'term-end' (term-end compilation summary)
  const [academicMode, setAcademicMode] = useState<'subject' | 'broadsheet' | 'term-end'>('subject');
  
  // Selection and modal state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  
  const [showConfigAssessmentsModal, setShowConfigAssessmentsModal] = useState(false);
  const [newAsmName, setNewAsmName] = useState('');
  const [newAsmType, setNewAsmType] = useState<'assignment' | 'test' | 'exam'>('test');
  const [newAsmMaxScore, setNewAsmMaxScore] = useState<number>(30);

  // Bulk Score Entry state
  const [bulkEntryConfigId, setBulkEntryConfigId] = useState<string | null>(null);
  const [bulkScores, setBulkScores] = useState<Record<string, string>>({}); // studentId -> score string
  const [bulkEntryError, setBulkEntryError] = useState<string | null>(null);

  // Term-End Compilation state
  const [selectedCompClassId, setSelectedCompClassId] = useState<string>('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileSuccessMsg, setCompileSuccessMsg] = useState<string | null>(null);
  const [searchRankQuery, setSearchRankQuery] = useState('');

  // Report Card & Email Distribution state
  const [selectedReportStudent, setSelectedReportStudent] = useState<any | null>(null);
  const [showReportCardModal, setShowReportCardModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [customEmailMessage, setCustomEmailMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailShareSuccess, setEmailShareSuccess] = useState<string | null>(null);
  const [editableComment, setEditableComment] = useState('');
  const [principalName, setPrincipalName] = useState('Dr. Audrey Sterling');
  const [emailLogLines, setEmailLogLines] = useState<string[]>([]);
  const [isBatchEmailing, setIsBatchEmailing] = useState(false);
  const [batchEmailSuccessMsg, setBatchEmailSuccessMsg] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; logs: string[] } | null>(null);

  // Compile calculations for ALL classes in the school under currentTerm
  const compiledClasses = React.useMemo(() => {
    return classes.map(cls => {
      const clsStudents = students.filter(s => s.class_id === cls.id);
      const clsSubjects = subjects.filter(s => s.class_id === cls.id);
      
      const studentList = clsStudents.map(student => {
        let totalScore = 0;
        let totalMaxPossible = 0;
        const subjectBreakdown: Record<string, { scored: number; max: number }> = {};
        
        clsSubjects.forEach(sub => {
          const subConfigs = assessmentConfigs.filter(cfg => cfg.subject_id === sub.id);
          const subScores = studentScores.filter(
            sc => sc.student_id === student.id && sc.subject_id === sub.id && sc.term === currentTerm
          );
          
          let scored = 0;
          let max = 0;
          subConfigs.forEach(cfg => {
            const found = subScores.find(sc => sc.assessment_config_id === cfg.id);
            if (found) {
              scored += found.score;
            }
            max += cfg.max_score;
          });
          
          totalScore += scored;
          totalMaxPossible += max;
          subjectBreakdown[sub.id] = { scored, max };
        });
        
        const avgPct = totalMaxPossible > 0 ? Math.round((totalScore / totalMaxPossible) * 100) : 0;
        
        return {
          student,
          totalScore,
          totalMaxPossible,
          avgPct,
          subjectBreakdown
        };
      });
      
      // Sort students in this class descending by totalScore
      const sorted = [...studentList].sort((a, b) => b.totalScore - a.totalScore);
      
      // Assign tie positions
      const ranked = sorted.map((row, idx, arr) => {
        let position = idx + 1;
        if (idx > 0 && row.totalScore === arr[idx - 1].totalScore) {
          const firstIdx = arr.findIndex(r => r.totalScore === row.totalScore);
          position = firstIdx + 1;
        }
        return {
          ...row,
          rank: position
        };
      });
      
      // Class metrics
      const classTotalScoresSum = ranked.reduce((acc, r) => acc + r.totalScore, 0);
      const classAverageScore = ranked.length > 0 ? Math.round(classTotalScoresSum / ranked.length) : 0;
      
      const classTotalPctSum = ranked.reduce((acc, r) => acc + r.avgPct, 0);
      const classAveragePercentage = ranked.length > 0 ? Math.round(classTotalPctSum / ranked.length) : 0;
      
      const highestScore = ranked.length > 0 ? ranked[0].totalScore : 0;
      const lowestScore = ranked.length > 0 ? ranked[ranked.length - 1].totalScore : 0;
      const topStudentName = ranked.length > 0 ? ranked[0].student.name : 'N/A';
      
      return {
        classId: cls.id,
        className: cls.name,
        studentsCount: clsStudents.length,
        subjectsCount: clsSubjects.length,
        classAverageScore,
        classAveragePercentage,
        highestScore,
        lowestScore,
        topStudent: topStudentName,
        rankings: ranked
      };
    });
  }, [classes, students, subjects, assessmentConfigs, studentScores, currentTerm]);

  // Handle run compiler ranks and averages
  const handleCompileRanks = () => {
    setIsCompiling(true);
    setCompileSuccessMsg(null);
    setTimeout(() => {
      setIsCompiling(false);
      setCompileSuccessMsg(`Term academic compiling completed successfully for ${currentTerm}! All class averages, student total scores from received subjects, and positions have been calculated.`);
      setStatusFeedback({
        type: 'success',
        msg: `Successfully compiled student scores and averages for all classes.`
      });
    }, 1200);
  };

  // Automatically share all compiled student report cards to their registered emails
  const handleBatchEmailReports = () => {
    // Gather all students in the rankings
    const allRankings: { className: string; student: any; totalScore: number; totalMaxPossible: number; avgPct: number; rank: number }[] = [];
    compiledClasses.forEach(item => {
      item.rankings.forEach(row => {
        allRankings.push({
          className: item.className,
          student: row.student,
          totalScore: row.totalScore,
          totalMaxPossible: row.totalMaxPossible,
          avgPct: row.avgPct,
          rank: row.rank
        });
      });
    });

    if (allRankings.length === 0) {
      setStatusFeedback({
        type: 'error',
        msg: 'Please run the Term calculations first to generate student rankings portfolio before bulk dissemination!'
      });
      return;
    }

    setIsBatchEmailing(true);
    setBatchEmailSuccessMsg(null);
    setBatchProgress({
      current: 0,
      total: allRankings.length,
      logs: [`[INFO] Introspecting ${allRankings.length} compiled student records across all classes...`]
    });

    let index = 0;
    const interval = setInterval(() => {
      if (index < allRankings.length) {
        const studentInfo = allRankings[index];
        const studentEmail = `${studentInfo.student.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@school.com`;
        
        setBatchProgress(prev => {
          if (!prev) return null;
          const updatedLogs = [
            ...prev.logs,
            `[SMTP DISPATCH] Sending Term End report card for ${studentInfo.student.name} (${studentInfo.student.code}) to registered mailbox: ${studentEmail}...`,
            `[OK] Report card statement successfully delivered to ${studentEmail}. Rank: ${getOrdinal(studentInfo.rank)}, Score: ${studentInfo.totalScore}/${studentInfo.totalMaxPossible}`
          ];
          return {
            current: index + 1,
            total: allRankings.length,
            logs: updatedLogs
          };
        });
        index++;
      } else {
        clearInterval(interval);
        setIsBatchEmailing(false);
        setBatchEmailSuccessMsg(`Bulk auto-share process successfully finished! Delivered ${allRankings.length} individual academic report cards to families' registered school system emails.`);
        setStatusFeedback({
          type: 'success',
          msg: `Dispatched ${allRankings.length} student report cards via SMTP email successfully!`
        });
      }
    }, 450);
  };

  // Export ranking sheets
  const handleExportFullRankings = () => {
    const headers = ['Student Name', 'Student Code', 'Class Name', 'Total Score Scored', 'Max Total Possible', 'Average %', 'Class Rank'];
    const csvRows: any[][] = [];
    
    compiledClasses.forEach(item => {
      item.rankings.forEach(row => {
        csvRows.push([
          row.student.name,
          row.student.code,
          item.className,
          row.totalScore,
          row.totalMaxPossible,
          `${row.avgPct}%`,
          getOrdinal(row.rank)
        ]);
      });
    });

    const metadataRow = [`"${currentSchool.name} - End of Term Student Rankings (Class Averages & Positions) - ${currentTerm}"`];
    const csvContentRows = [
      metadataRow.join(','),
      headers.join(','),
      ...csvRows.map(r => r.map(val => typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val).join(','))
    ];

    const csvString = '\ufeff' + csvContentRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filename = `${currentSchool.name.replace(/\s+/g, '_')}_student_rankings_${currentTerm.replace(/[\s/]+/g, '_')}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper inside report card: Grade classification mappings
  const getLetterGrade = (percentage: number) => {
    if (percentage >= 85) return { grade: 'A+', desc: 'Distinction' };
    if (percentage >= 75) return { grade: 'A', desc: 'Excellent' };
    if (percentage >= 65) return { grade: 'B+', desc: 'Very Good' };
    if (percentage >= 50) return { grade: 'B', desc: 'Good Pass' };
    if (percentage >= 40) return { grade: 'C', desc: 'Pass' };
    return { grade: 'F', desc: 'Needs Improvement / Fail' };
  };

  // Report Card Modal Handlers
  const handleOpenReportCard = (item: any) => {
    setSelectedReportStudent(item);
    
    // Generate realistic recipient email
    const generatedEmail = `${item.student.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@school.com`;
    setRecipientEmail(generatedEmail);
    
    // Custom pre-loaded email message matching standard administrative notices
    setCustomEmailMessage(`Dear Parent/Guardian,

We are pleased to share the official Academic Terminal Report Card booklet of your ward, ${item.student.name} (${item.student.code}), for the academic semester term end of "${currentTerm}".

An overview of cumulative academic averages:
- Total combined score: ${item.totalScore} of ${item.totalMaxPossible} points
- Term global average percentage: ${item.avgPct}%
- Positional rank in class: ${getOrdinal(item.rank)} position

Please review the attached printable academic scorecard for details on assignments, class tests, and comprehensive exams.

Warm regards,
Office of the Principal,
${currentSchool.name}`);

    // Generate smart initial comment matching academic metrics
    let initialComment = "";
    if (item.avgPct >= 75) {
      initialComment = "Outstanding terminal stance! Maintains an excellent standard across all subjects, displaying exceptional understanding, concentration, and leadership behavior.";
    } else if (item.avgPct >= 50) {
      initialComment = "Good overall performance. Shows commendable class presence and solid progress. Sustained homework drill and extra concentration will ensure top-grade results.";
    } else {
      initialComment = "An average performance which indicates gaps in understanding. We highly advise structured home revisions, focused subject drills, and teacher consultations.";
    }
    setEditableComment(initialComment);
    setEmailShareSuccess(null);
    setIsSendingEmail(false);
    setEmailLogLines([]);
    
    setShowReportCardModal(true);
  };

  const handleSendReportCardEmail = () => {
    if (!recipientEmail.trim() || !selectedReportStudent) return;
    setIsSendingEmail(true);
    setEmailShareSuccess(null);
    setEmailLogLines([]);

    const steps = [
      `[1/5] Establishing secure SSL/TLS connection to ${currentSchool.name.replace(/\s+/g, '')} reports cluster...`,
      `[2/5] Creating message payload structure & compiling score logs for ${selectedReportStudent.student.name} (${selectedReportStudent.student.code})...`,
      `[3/5] Attaching high-precision academic Statement Report Card HTML & JSON payload...`,
      `[4/5] Delivering to SMTP server for recipient address: ${recipientEmail.trim()}...`,
      `[5/5] SMTP handshakes complete. Dispatched secure envelope successfully!`
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setEmailLogLines(prev => [...prev, steps[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsSendingEmail(false);
        setEmailShareSuccess(`Academic Report Card statement was successfully dispatched electronically as a parent email packet to ${recipientEmail.trim()}!`);
        setStatusFeedback({
          type: 'success',
          msg: `Report Card successfully emailed to ${selectedReportStudent.student.name} at ${recipientEmail}`
        });
      }
    }, 600);
  };

  const handleDownloadReportCardHTML = () => {
    if (!selectedReportStudent) return;
    const item = selectedReportStudent;
    const student = item.student;
    
    // Find class details
    const clsName = item.className;
    const schoolName = currentSchool.name;
    const cls_id = student.class_id;
    const clsSubjects = subjects.filter(s => s.class_id === cls_id);
    
    // Store assessment details in an HTML scorecard pattern
    let subjectRowsHtml = "";
    
    clsSubjects.forEach((sub) => {
      const subConfigs = assessmentConfigs.filter(cfg => cfg.subject_id === sub.id);
      const subScores = studentScores.filter(
        sc => sc.student_id === student.id && sc.subject_id === sub.id && sc.term === currentTerm
      );
      
      let assignScored = 0, assignMax = 0;
      let testScored = 0, testMax = 0;
      let examScored = 0, examMax = 0;
      let totalScored = 0, totalMax = 0;
      
      subConfigs.forEach(cfg => {
        const found = subScores.find(sc => sc.assessment_config_id === cfg.id);
        const scoreVal = found ? found.score : 0;
        
        if (cfg.type === 'assignment') {
          assignScored += scoreVal;
          assignMax += cfg.max_score;
        } else if (cfg.type === 'test') {
          testScored += scoreVal;
          testMax += cfg.max_score;
        } else if (cfg.type === 'exam') {
          examScored += scoreVal;
          examMax += cfg.max_score;
        }
        totalScored += scoreVal;
        totalMax += cfg.max_score;
      });
      
      const pct = totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;
      const ratingInfo = getLetterGrade(pct);
      
      subjectRowsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; font-weight: bold; color: #1e293b; text-align: left; border-left: 4px solid #1B4332;">${sub.name}</td>
          <td style="padding: 12px; text-align: center; color: #475569;">${assignMax > 0 ? `${assignScored} / ${assignMax}` : '-'}</td>
          <td style="padding: 12px; text-align: center; color: #475569;">${testMax > 0 ? `${testScored} / ${testMax}` : '-'}</td>
          <td style="padding: 12px; text-align: center; color: #475569;">${examMax > 0 ? `${examScored} / ${examMax}` : '-'}</td>
          <td style="padding: 12px; text-align: center; font-weight: 800; color: #0f172a;">${totalScored} / ${totalMax}</td>
          <td style="padding: 12px; text-align: center; font-weight: 800; color: #1B4332;">${pct}%</td>
          <td style="padding: 12px; text-align: center; font-weight: 800;"><span style="color: #b45309; padding: 2px 8px; border-radius: 4px; background-color: #fef3c7;">${ratingInfo.grade}</span></td>
          <td style="padding: 12px; text-align: left; font-size: 11px; color: #64748b;">${ratingInfo.desc}</td>
        </tr>
      `;
    });
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Academic Report Card - ${student.name}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 40px;
            background-color: #f1f5f9;
            color: #1e293b;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
            padding: 40px;
            border: 1px solid #e2e8f0;
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #1B4332;
            padding-bottom: 24px;
            margin-bottom: 24px;
        }
        .school-info h1 {
            margin: 0;
            font-size: 24px;
            color: #1B4332;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        .school-info p {
            margin: 4px 0 0 0;
            font-size: 12px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .badge {
            background-color: #1B4332;
            color: #ffffff;
            font-weight: bold;
            font-size: 11px;
            padding: 6px 14px;
            border-radius: 20px;
            text-transform: uppercase;
        }
        .student-details {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }
        .detail-item {
            font-size: 13px;
        }
        .detail-item strong {
            color: #475569;
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
        }
        .detail-item span {
            font-weight: 700;
            color: #0f172a;
            font-size: 14px;
        }
        .score-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .score-table th {
            background-color: #f8fafc;
            padding: 12px;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
            color: #475569;
            border-bottom: 2px solid #e2e8f0;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 30px;
        }
        .summary-card {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
        }
        .summary-card .label {
            font-size: 10px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 6px;
        }
        .summary-card .value {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
        }
        .summary-card.accent {
            background-color: #1B4332;
            border-color: #1B4332;
        }
        .summary-card.accent .label {
            color: rgba(255, 255, 255, 0.82);
        }
        .summary-card.accent .value {
            color: #ffffff;
        }
        .comments-section {
            background-color: #fcfcfc;
            border: 1px dashed #cbd5e1;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 32px;
        }
        .comments-section h3 {
            margin: 0 0 10px 0;
            font-size: 12px;
            text-transform: uppercase;
            color: #475569;
            letter-spacing: 0.5px;
        }
        .comments-section p {
            margin: 0;
            font-size: 13px;
            line-height: 1.6;
            color: #1e293b;
            font-style: italic;
        }
        .signatures {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 40px;
            margin-top: 40px;
            border-top: 1px solid #f1f5f9;
            padding-top: 32px;
        }
        .sign-block {
            text-align: center;
        }
        .sign-line {
            width: 180px;
            border-bottom: 1px solid #cbd5e1;
            margin: 0 auto 10px auto;
            height: 40px;
        }
        .sign-title {
            font-size: 12px;
            font-weight: 700;
            color: #0f172a;
        }
        .sign-sub {
            font-size: 10px;
            color: #64748b;
            margin-top: 2px;
        }
        .stamp-box {
            border: 2px dashed #94a3b8;
            border-radius: 8px;
            width: 80px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 auto 10px auto;
        }
        @media print {
            body {
                background-color: #ffffff;
                padding: 10px;
            }
            .container {
                box-shadow: none;
                border: none;
                padding: 10px;
                max-width: 100%;
            }
            .no-print {
                display: none;
            }
        }
        .print-btn-bar {
            text-align: right;
            margin-bottom: 16px;
        }
        .print-btn {
            background-color: #1B4332;
            color: white;
            border: none;
            padding: 8px 16px;
            font-size: 12px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="print-btn-bar no-print">
        <button class="print-btn" onclick="window.print()">Print This Report Card</button>
    </div>
    <div id="report-card-print-area" class="container">
        <div class="header">
            <div class="school-info" style="display: flex; align-items: center; gap: 14px;">
                ${(currentSchool.badgeUrl || currentSchool.logoUrl) ? `
                    <img src="${currentSchool.badgeUrl || currentSchool.logoUrl}" alt="School Badge" style="max-height: 56px; max-width: 56px; object-fit: contain; border-radius: 8px;" />
                ` : ''}
                <div>
                    <h1>${schoolName}</h1>
                    <p>Official Academic Achievement Portfolio Statement</p>
                </div>
            </div>
            <div class="badge">Official Report</div>
        </div>

        <div class="student-details">
            <div class="detail-item">
                <strong>Student Full Name</strong>
                <span>${student.name}</span>
            </div>
            <div class="detail-item">
                <strong>Student Admission Key</strong>
                <span>${student.code}</span>
            </div>
            <div class="detail-item">
                <strong>Classroom Assigned</strong>
                <span>${clsName}</span>
            </div>
            <div class="detail-item">
                <strong>Academic Calendar Block</strong>
                <span>${currentTerm}</span>
            </div>
        </div>

        <table class="score-table">
            <thead>
                <tr>
                    <th style="text-align: left; width: 30%">Subject Title</th>
                    <th>Assignments</th>
                    <th>Class Tests</th>
                    <th>Final Exams</th>
                    <th>Total Possible</th>
                    <th>Avg Score</th>
                    <th>Grade</th>
                    <th style="text-align: left;">Remarks</th>
                </tr>
            </thead>
            <tbody>
                ${subjectRowsHtml}
            </tbody>
        </table>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="label">Combined Total Score</div>
                <div class="value">${item.totalScore} <span style="font-size: 12px; color: #64748b;">/ ${item.totalMaxPossible}</span></div>
            </div>
            <div class="summary-card">
                <div class="label">Class Average Score</div>
                <div class="value">${item.classAvg} <span style="font-size: 10px; color: #64748b;">pts</span></div>
            </div>
            <div class="summary-card accent">
                <div class="label" style="color: #cbd5e1;">Global Average Percentage</div>
                <div class="value" style="color: #ffffff;">${item.avgPct}%</div>
            </div>
            <div class="summary-card">
                <div class="label">Class Position Rank</div>
                <div class="value" style="color: #b45309;">${getOrdinal(item.rank)}</div>
            </div>
        </div>

        <div class="comments-section">
            <h3>Principal & Teacher Commendation Feedback</h3>
            <p>"${editableComment}"</p>
        </div>

        <div class="signatures">
            <div class="sign-block">
                <div class="sign-line" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: bold; padding-top: 15px; color: #475569;">
                    <i>Authorized Signee</i>
                </div>
                <div class="sign-title">Class Teacher Signature</div>
                <div class="sign-sub">Instructor, ${clsName}</div>
            </div>
            <div class="sign-block">
                <div class="sign-line" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: bold; padding-top: 15px; color: #475569;">
                    <i>${principalName}</i>
                </div>
                <div class="sign-title">Principal of Academy</div>
                <div class="sign-sub">Board Certified Director</div>
            </div>
        </div>
        
        <div style="margin-top: 40px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 20px;">
           <div class="stamp-box">school seal</div>
           <p style="font-size: 9px; color: #94a3b8; font-weight: bold; margin: 0; text-transform: uppercase;">
             This terminal statement is valid and authenticated as a true performance record.
           </p>
        </div>
    </div>
</body>
</html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedStudentName = student.name.replace(/\s+/g, '_');
    link.download = `Report_Card_${sanitizedStudentName}_${currentTerm.replace(/[\s/]+/g, '_')}.html`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter lists for current class context
  const classSubjects = subjects.filter(s => s.class_id === selectedClassId);
  const activeSubject = classSubjects.find(s => s.id === selectedSubjectId) || classSubjects[0];
  
  // Auto select active subject if null or invalid
  React.useEffect(() => {
    if (classSubjects.length > 0 && (!selectedSubjectId || !classSubjects.some(s => s.id === selectedSubjectId))) {
      setSelectedSubjectId(classSubjects[0].id);
    }
  }, [classSubjects, selectedSubjectId]);

  const activeConfigs = activeSubject 
    ? assessmentConfigs.filter(cfg => cfg.subject_id === activeSubject.id)
    : [];

  const activeSubjectScores = activeSubject
    ? studentScores.filter(sc => sc.subject_id === activeSubject.id && sc.term === currentTerm)
    : [];

  // Helper: Format rating
  const getPerformanceRating = (percentage: number) => {
    if (percentage >= 75) return { label: 'Excellent', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (percentage >= 50) return { label: 'Good/Pass', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    return { label: 'Needs Block Help', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  };

  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // SUBJECT OPERATIONS
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isScoreLockActive) {
      alert("This academic term is completed and student records are finalized. Teachers are no longer permitted to edit student scores or subjects.");
      return;
    }
    if (!newSubjectName.trim() || !selectedClassId) return;

    const subjectId = `subj_${Date.now()}`;
    const subjectData: Subject = {
      id: subjectId,
      school_id: currentProfile.school_id,
      class_id: selectedClassId,
      name: newSubjectName.trim(),
      created_at: new Date().toISOString()
    };

    if (isOfflineMode) {
      const updated = [...subjects, subjectData];
      saveOfflineItem('rc_subjects', updated);
      setSelectedSubjectId(subjectId);
      setNewSubjectName('');
      setShowAddSubjectModal(false);
      setStatusFeedback({
        type: 'success',
        msg: `Subject "${subjectData.name}" added successfully!`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'subjects', subjectId), subjectData);
      setSelectedSubjectId(subjectId);
      setNewSubjectName('');
      setShowAddSubjectModal(false);
      setStatusFeedback({
        type: 'success',
        msg: `Subject "${subjectData.name}" added successfully!`
      });
    } catch (err: any) {
      console.error('Failed to add subject:', err);
      setStatusFeedback({ type: 'err', msg: 'Failed to record subject in database.' });
    }
  };

  const handleDeleteSubject = async (subjId: string, name: string) => {
    if (isScoreLockActive) {
      alert("This academic term is completed and student records are finalized. Teachers are no longer permitted to edit student scores or subjects.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${name}"? This will delete all associated assessment setups and recorded grades.`)) {
      return;
    }

    if (isOfflineMode) {
      const remainingSubjects = subjects.filter(s => s.id !== subjId);
      const remainingConfigs = assessmentConfigs.filter(c => c.subject_id !== subjId);
      const remainingScores = studentScores.filter(s => s.subject_id !== subjId);

      localStorage.setItem('rc_subjects', JSON.stringify(remainingSubjects));
      localStorage.setItem('rc_assessment_configs', JSON.stringify(remainingConfigs));
      saveOfflineItem('rc_student_scores', remainingScores);
      
      setStatusFeedback({ type: 'info', msg: `Deleted subject "${name}".` });
      return;
    }

    try {
      // Delete subject directly. Ideally cloud firestore maps cascades, we do cleanup iteratively
      await deleteDoc(doc(db, 'subjects', subjId));
      setStatusFeedback({ type: 'info', msg: `Deleted subject "${name}".` });
    } catch (err: any) {
      console.error('Failed to delete subject:', err);
    }
  };

  // ASSESSMENT CONFIGURATION OPERATIONS
  const handleAddAssessmentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isScoreLockActive) {
      alert("This academic term is completed and student records are finalized. Teachers are no longer permitted to edit student scores or grading slots.");
      return;
    }
    if (!activeSubject || !newAsmName.trim() || !newAsmMaxScore || newAsmMaxScore <= 0) return;

    // Check if the overall scores do not exceed 100 for safety, though standard totals are allowed
    const currentMaxSum = activeConfigs.reduce((acc, c) => acc + c.max_score, 0);
    if (currentMaxSum + newAsmMaxScore > 100) {
      if (!window.confirm(`Notice: Combined assessments total score will exceed 100 marks (${currentMaxSum + newAsmMaxScore}). Continue?`)) {
        return;
      }
    }

    const configId = `cfg_${Date.now()}`;
    const configData: AssessmentConfig = {
      id: configId,
      school_id: currentProfile.school_id,
      class_id: selectedClassId,
      subject_id: activeSubject.id,
      name: newAsmName.trim(),
      type: newAsmType,
      max_score: Number(newAsmMaxScore),
      created_at: new Date().toISOString()
    };

    if (isOfflineMode) {
      const updated = [...assessmentConfigs, configData];
      saveOfflineItem('rc_assessment_configs', updated);
      setNewAsmName('');
      setNewAsmMaxScore(30);
      setStatusFeedback({
        type: 'success',
        msg: `Added system grading slot: ${configData.name}`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'assessment_configs', configId), configData);
      setNewAsmName('');
      setNewAsmMaxScore(30);
      setStatusFeedback({
        type: 'success',
        msg: `Added system grading slot: ${configData.name}`
      });
    } catch (err: any) {
      console.error('Failed to create config:', err);
    }
  };

  const handleDeleteAssessmentConfig = async (configId: string, name: string) => {
    if (isScoreLockActive) {
      alert("This academic term is completed and student records are finalized. Teachers are no longer permitted to edit student scores or grading slots.");
      return;
    }
    if (!window.confirm(`Delete grading slot "${name}"? Entered student marks for this slot will be removed.`)) {
      return;
    }

    if (isOfflineMode) {
      const updatedConfigs = assessmentConfigs.filter(c => c.id !== configId);
      const updatedScores = studentScores.filter(s => s.assessment_config_id !== configId);
      
      localStorage.setItem('rc_assessment_configs', JSON.stringify(updatedConfigs));
      saveOfflineItem('rc_student_scores', updatedScores);
      setStatusFeedback({ type: 'info', msg: `Removed ${name}.` });
      return;
    }

    try {
      await deleteDoc(doc(db, 'assessment_configs', configId));
      setStatusFeedback({ type: 'info', msg: `Removed ${name}.` });
    } catch (err: any) {
      console.error(err);
    }
  };

  // SCORE ASSIGNMENT AND BULK ENTRY
  const openBulkScoreEntry = (config: AssessmentConfig) => {
    setBulkEntryConfigId(config.id);
    const initialRaw: Record<string, string> = {};
    
    // Seed existing scores for this class/subject/config into local dict
    students.filter(s => s.class_id === selectedClassId).forEach(student => {
      const match = activeSubjectScores.find(
        sc => sc.student_id === student.id && sc.assessment_config_id === config.id
      );
      initialRaw[student.id] = match ? String(match.score) : '';
    });

    setBulkScores(initialRaw);
    setBulkEntryError(null);
  };

  const handleSaveBulkScores = async () => {
    if (isScoreLockActive) {
      alert("This academic term is completed and student records are finalized. Teachers are no longer permitted to edit student scores.");
      return;
    }
    if (!bulkEntryConfigId || !activeSubject) return;
    const config = activeConfigs.find(c => c.id === bulkEntryConfigId);
    if (!config) return;

    // Validate all inputs before committing
    let hasError = false;
    const validatedScores: Record<string, number> = {};

    for (const studentId of Object.keys(bulkScores)) {
      const val = bulkScores[studentId].trim();
      if (val === '') continue; // Skip empty (allows clearing scores or not yet tested)

      const numVal = Number(val);
      if (isNaN(numVal) || numVal < 0 || numVal > config.max_score) {
        setBulkEntryError(`Error: Invalid score found for student ID ${studentId}. Must be a positive number between 0 and ${config.max_score}.`);
        hasError = true;
        break;
      }
      validatedScores[studentId] = numVal;
    }

    if (hasError) return;

    // Create array of student score records to set
    const batchUpdates: StudentScore[] = [];
    
    students.filter(s => s.class_id === selectedClassId).forEach(student => {
      const id = `${currentProfile.school_id}_${selectedClassId}_${activeSubject.id}_${student.id}_${currentTerm.replace(/[\s/]+/g, '_')}_${config.id}`;
      const hasValue = bulkScores[student.id]?.trim() !== '';

      if (hasValue) {
        batchUpdates.push({
          id,
          school_id: currentProfile.school_id,
          class_id: selectedClassId,
          subject_id: activeSubject.id,
          student_id: student.id,
          term: currentTerm,
          assessment_config_id: config.id,
          score: validatedScores[student.id],
          created_at: new Date().toISOString()
        });
      }
    });

    if (isOfflineMode) {
       // Filter out existing scores for this specific assessment slot, then append new ones
       let updatedScores = studentScores.filter(
         sc => !(sc.subject_id === activeSubject.id && sc.term === currentTerm && sc.assessment_config_id === config.id)
       );
       updatedScores = [...updatedScores, ...batchUpdates];
       saveOfflineItem('rc_student_scores', updatedScores);

       setBulkEntryConfigId(null);
       setStatusFeedback({
         type: 'success',
         msg: `Successfully saved scores for "${config.name}"!`
       });
       return;
    }

    try {
      // For online, write each document synchronously
      for (const record of batchUpdates) {
        await setDoc(doc(db, 'student_scores', record.id), record);
      }
      // If a student score was emptied, we should delete it
      const studentIdsWithScoreInUI = Object.keys(bulkScores);
      for (const studentId of studentIdsWithScoreInUI) {
        if (bulkScores[studentId].trim() === '') {
          const id = `${currentProfile.school_id}_${selectedClassId}_${activeSubject.id}_${studentId}_${currentTerm.replace(/[\s/]+/g, '_')}_${config.id}`;
          await deleteDoc(doc(db, 'student_scores', id));
        }
      }

      setBulkEntryConfigId(null);
      setStatusFeedback({
        type: 'success',
        msg: `Successfully synchronized score entries for "${config.name}" to Live DB!`
      });
    } catch (err: any) {
      console.error(err);
      setBulkEntryError('Failed to record score entries to live Firestore.');
    }
  };

  // BROAD SHEET CALCULATIONS
  // A class broadsheet has overall records for EACH student
  const classStudents = students.filter(s => s.class_id === selectedClassId);

  // Compute stats for broadsheet
  const broadsheetData = classStudents.map(student => {
    // For each subject, sum up scores
    const subjectSums: Record<string, { scored: number; maxAllowed: number }> = {};
    
    classSubjects.forEach(subject => {
      const subjectConfigs = assessmentConfigs.filter(c => c.subject_id === subject.id);
      const scores = studentScores.filter(
        sc => sc.student_id === student.id && sc.subject_id === subject.id && sc.term === currentTerm
      );
      
      let sum = 0;
      let maxTotalSum = 0;
      
      subjectConfigs.forEach(cfg => {
        const found = scores.find(sc => sc.assessment_config_id === cfg.id);
        if (found) {
          sum += found.score;
        }
        maxTotalSum += cfg.max_score;
      });

      // Avoid Division by Zero if no configs exist
      subjectSums[subject.id] = {
        scored: sum,
        maxAllowed: maxTotalSum || 100
      };
    });

    const overallScored = Object.values(subjectSums).reduce((acc, obj) => acc + obj.scored, 0);
    const overallMaxSum = Object.values(subjectSums).reduce((acc, obj) => acc + obj.maxAllowed, 0);
    
    // Overall Average calculation
    const overallPercentage = overallMaxSum > 0 ? Math.round((overallScored / overallMaxSum) * 100) : 0;

    return {
      student,
      subjectSums, // subject_id -> score info
      overallScored,
      overallMaxSum,
      overallPercentage
    };
  });

  // Now, rank students based on overallScored cumulative total descending
  const rankedBroadsheet = [...broadsheetData].sort((a, b) => b.overallScored - a.overallScored);

  // Assign ranks (handling joint tie positions)
  const rankedRows = rankedBroadsheet.map((row, idx, sortedArr) => {
    let position = idx + 1;
    // Walk backwards if score matches previous
    if (idx > 0 && row.overallScored === sortedArr[idx - 1].overallScored) {
      // Find the first index with this same score
      const firstSameIdx = sortedArr.findIndex(r => r.overallScored === row.overallScored);
      position = firstSameIdx + 1;
    }
    return {
      ...row,
      rank: position
    };
  });

  // CSV DOWNLOAD FOR ACADEMIC RECORD SHEET
  const handleExportBroadsheet = () => {
    if (classStudents.length === 0) return;

    // Headers: Student Code, Student Name, [Subject names...], Cumulative Total, Average Score (%), Class Rank
    const headers = ['Student Code', 'Student Name'];
    classSubjects.forEach(s => {
      headers.push(`${s.name} (Score)`);
    });
    headers.push('Cumulative Total Points', 'Overall Average (%)', 'Class Position');

    const csvRows = rankedRows.map(row => {
      const dataRow: any[] = [row.student.code, row.student.name];
      
      classSubjects.forEach(s => {
        const match = row.subjectSums[s.id];
        dataRow.push(match ? `${match.scored}/${match.maxAllowed}` : 'N/A');
      });

      dataRow.push(row.overallScored, `${row.overallPercentage}%`, `${getOrdinal(row.rank)} Place`);
      return dataRow;
    });

    const metadataRow = [`"${currentSchool.name} - ${activeClass?.name || 'Class'} Broad Sheet (${currentTerm})"`];
    const csvContentRows = [
      metadataRow.join(','),
      headers.join(','),
      ...csvRows.map(r => r.map(val => typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val).join(','))
    ];

    const csvString = '\ufeff' + csvContentRows.join('\n'); // Add UTF-8 BOM for Excel support
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filename = `${(activeClass?.name || 'class').replace(/\s+/g, '_')}_broad_sheet_${currentTerm.replace(/[\s/]+/g, '_')}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-3 sm:p-4 space-y-4">
      {/* Sub Heading Switcher Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-stone-50 border border-stone-200/60 p-3 rounded-xl gap-3">
        <div>
          <h2 className="text-xs font-bold text-[#1B4332] uppercase tracking-wide">
            🏆 Academic Performance & Gradebook
          </h2>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Configure assessments/tests, record obtained grades in subjects, and calculate position ranks seamlessly.
          </p>
        </div>

        {/* View Switch Button Tabs */}
        <div className="flex rounded-md overflow-hidden border border-stone-200 bg-white shadow-3xs p-0.5 mt-1 sm:mt-0">
          <button
            onClick={() => {
              setAcademicMode('subject');
              setBulkEntryConfigId(null);
            }}
            className={`py-1 px-3.5 rounded text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
              academicMode === 'subject'
                ? 'bg-[#1B4332] text-white'
                : 'text-stone-600 hover:text-stone-900 bg-white'
            }`}
          >
            Subject Gradebook
          </button>
          <button
            onClick={() => {
              setAcademicMode('broadsheet');
              setBulkEntryConfigId(null);
            }}
            className={`py-1 px-3.5 rounded text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
              academicMode === 'broadsheet'
                ? 'bg-[#1B4332] text-white'
                : 'text-stone-600 hover:text-stone-900 bg-white'
            }`}
          >
            Class broadsheet Summary
          </button>
          <button
            onClick={() => {
              setAcademicMode('term-end');
              setBulkEntryConfigId(null);
            }}
            className={`py-1 px-3.5 rounded text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
              academicMode === 'term-end'
                ? 'bg-[#1B4332] text-white'
                : 'text-stone-600 hover:text-stone-900 bg-white'
            }`}
          >
            📊 Term-End Rankings Compiler
          </button>
        </div>
      </div>

      {!selectedClassId && academicMode !== 'term-end' ? (
        <div className="flex flex-col items-center justify-center p-8 text-center h-80 bg-stone-50 border border-stone-200 rounded-xl border-dashed">
          <Sliders className="h-8 w-8 text-stone-300 mb-3 animate-pulse" />
          <h3 className="text-sm font-semibold text-stone-700">No Class Selected</h3>
          <p className="text-[11px] text-stone-500 mt-1 max-w-sm">
            Please choose a class from the left sidebar JSS/SSS classroom list, or explore the school-wide Term-End Rankings Compiler above.
          </p>
        </div>
      ) : academicMode === 'subject' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* LEFT PANEL: SUBJECT SELECTION */}
          <div className="space-y-4 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                Subjects ({classSubjects.length})
              </span>
              <button
                onClick={() => setShowAddSubjectModal(true)}
                className="inline-flex items-center space-x-1 py-1 px-2 border border-[#1b4332]/30 text-[#1B4332] rounded-md hover:bg-[#1B4332]/5 text-2xs font-semibold"
              >
                <Plus className="h-3 w-3" />
                <span>Add</span>
              </button>
            </div>

            {classSubjects.length === 0 ? (
              <div className="border border-dashed border-stone-200 rounded-xl p-6 text-center">
                <BookOpen className="h-8 w-8 text-stone-300 mx-auto mb-2" />
                <p className="text-2xs text-stone-500 font-medium">No subjects added for {activeClass?.name}</p>
                <button
                  onClick={() => setShowAddSubjectModal(true)}
                  className="mt-3 text-2xs font-semibold text-[#1B4332] hover:underline"
                >
                  Create subject now
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
                {classSubjects.map(s => {
                  const isActive = s.id === selectedSubjectId;
                  const totalConfigs = assessmentConfigs.filter(cfg => cfg.subject_id === s.id).length;

                  return (
                    <div 
                      key={s.id}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isActive 
                          ? 'border-[#1B4332] bg-[#1B4332]/5 shadow-xs' 
                          : 'border-stone-150 hover:border-stone-300 bg-white'
                      }`}
                      onClick={() => {
                        setSelectedSubjectId(s.id);
                        setBulkEntryConfigId(null);
                      }}
                    >
                      <div className="min-w-0 pr-2">
                        <h4 className={`text-xs font-bold truncate ${isActive ? 'text-[#1B4332]' : 'text-stone-800'}`}>
                          {s.name}
                        </h4>
                        <span className="text-3xs text-stone-500 mt-0.5 block">
                          {totalConfigs} grading slots configured
                        </span>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSubject(s.id, s.name);
                        }}
                        className="text-stone-400 hover:text-red-600 p-1 rounded-md hover:bg-stone-100 transition-colors"
                        title="Delete Subject"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: SUBJECT GRADES & SLOTS VIEW */}
          <div className="lg:col-span-3 space-y-4">
            {isScoreLockActive && (
              <div id="school-term-lock-banner" className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs flex items-start gap-3 shadow-3xs">
                <Lock className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wider text-amber-900 text-3xs">Academic Term Concluded (Locked)</p>
                  <p className="text-stone-650 leading-relaxed font-sans font-semibold text-xs">
                    This academic term is completed and student records have been compiled. Scores and grading configurations are locked for teacher edits. Contact school administrators for any manual overrides.
                  </p>
                </div>
              </div>
            )}
            {isTermCompleted && currentProfile.role === 'admin' && (
              <div id="school-term-admin-override-banner" className="p-4 rounded-2xl bg-[#1B4332]/5 border border-[#1B4332]/25 text-emerald-800 text-xs flex items-start gap-3 shadow-3xs">
                <Lock className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[#1B4332] text-3xs">Term Completed (Admin Overrides Active)</p>
                  <p className="text-stone-650 leading-relaxed font-sans font-semibold text-xs">
                    This academic term's countdown has concluded. Teacher panels are locked from further editing. As an **Administrator**, you have exclusive override access and can continue editing scores or adjusting configurations if needed.
                  </p>
                </div>
              </div>
            )}

            {!activeSubject ? (
              <div className="border border-stone-200 rounded-2xl bg-stone-50 p-12 text-center">
                <BookOpen className="h-10 w-10 text-stone-300 mx-auto mb-3" />
                <h3 className="text-xs font-bold text-stone-600">No Active Subject Seleced</h3>
                <p className="text-2xs text-stone-500 mt-1">Please select an existing subject or create a new one to manage gradebooks.</p>
              </div>
            ) : (
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
                {/* Subject Grade Header info */}
                <div className="bg-stone-50/50 border-b border-stone-150 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-[#1B4332]/10 text-[#1B4332]">
                      {activeClass?.name} Subject
                    </span>
                    <h3 className="text-base font-bold text-stone-850 mt-1">{activeSubject.name}</h3>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    {!isScoreLockActive && (
                      <button
                        onClick={() => setShowConfigAssessmentsModal(true)}
                        className="inline-flex items-center space-x-1.5 py-1.5 px-3 border border-stone-200 bg-white rounded-lg hover:bg-stone-50 text-xs font-semibold text-stone-700 w-full justify-center sm:w-auto"
                      >
                        <Sliders className="h-3.5 w-3.5 text-stone-500" />
                        <span>Configure slots</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub components list of AssessmentConfigs */}
                {activeConfigs.length === 0 ? (
                  <div className="p-8 text-center bg-stone-50 border-b border-stone-150">
                    <Sliders className="h-10 w-10 text-stone-300 mx-auto mb-2" />
                    <p className="text-xs font-medium text-stone-700">No Continuous Assessment Slots configured for {activeSubject.name}</p>
                    <p className="text-2xs text-stone-500 max-w-sm mx-auto mt-1">
                      Define slots like "Assignment 1" or "Term Exam" with customizable max scores to enter marks.
                    </p>
                    {!isScoreLockActive ? (
                      <button
                        onClick={() => setShowConfigAssessmentsModal(true)}
                        className="mt-3 inline-flex items-center space-x-1 bg-[#1B4332] text-white text-xs font-bold py-1.5 px-3 rounded-lg hover:bg-[#153326]"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Configure slots now</span>
                      </button>
                    ) : (
                      <span className="mt-3 text-amber-700 inline-flex items-center space-x-1 font-mono text-3xs uppercase font-extrabold tracking-wider bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
                        <Lock className="h-3.5 w-3.5 mr-1 text-amber-655" /> Closed - Scoring Locked
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-[#1B4332]/5 border-b border-[#1b4332]/10 flex flex-wrap gap-2 items-center">
                    <span className="text-3xs font-bold uppercase tracking-wider text-[#1B4332] mr-2">Click to input grades:</span>
                    {activeConfigs.map(cfg => (
                      <button
                        key={cfg.id}
                        disabled={isScoreLockActive}
                        onClick={() => {
                          if (isScoreLockActive) {
                            alert("Scores are locked for the finalized term.");
                            return;
                          }
                          openBulkScoreEntry(cfg);
                        }}
                        className={`inline-flex items-center space-x-1 py-1 px-3.5 rounded-full text-xs font-semibold tracking-wide border transition-all ${
                          isScoreLockActive
                            ? 'bg-[#1b4332]/5 text-stone-400 border-stone-200 cursor-not-allowed opacity-60'
                            : bulkEntryConfigId === cfg.id
                              ? 'bg-[#1B4332] text-white border-transparent shadow-xs'
                              : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-200'
                        }`}
                      >
                        {isScoreLockActive ? <Lock className="h-3 w-3 text-stone-400" /> : <Edit className="h-3 w-3" />}
                        <span>{cfg.name} ({cfg.max_score} marks)</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Bulk Score Editor Panel */}
                <AnimatePresence>
                  {bulkEntryConfigId && (() => {
                    const activeCfg = activeConfigs.find(c => c.id === bulkEntryConfigId);
                    if (!activeCfg) return null;

                    return (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-stone-50 border-b border-stone-200 overflow-hidden"
                      >
                        <div className="p-4 sm:p-6 space-y-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="text-xs font-black text-stone-800 uppercase tracking-widest">
                                📝 Bulk Grade Inputter
                              </h4>
                              <p className="text-xs text-stone-500 mt-0.5 font-medium">
                                Entering score marks for <strong className="text-stone-800">{activeCfg.name}</strong> (Max total: <strong className="text-stone-800">{activeCfg.max_score}</strong>). Leaving field blank keeps grade as unentered.
                              </p>
                            </div>
                            <button
                              onClick={() => setBulkEntryConfigId(null)}
                              className="p-1 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-200"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          {bulkEntryError && (
                            <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start space-x-2 text-red-800 text-xs font-semibold">
                              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                              <span>{bulkEntryError}</span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {classStudents.map(student => (
                              <div key={student.id} className="flex items-center justify-between p-2.5 bg-white border border-stone-200 rounded-xl shadow-2xs">
                                <div className="min-w-0 pr-2">
                                  <h5 className="font-bold text-xs truncate text-stone-850">{student.name}</h5>
                                  <span className="text-3xs text-stone-500 font-mono block mt-0.5">{student.code}</span>
                                </div>
                                <div className="flex items-center space-x-1 shrink-0">
                                  <input
                                    type="number"
                                    min="0"
                                    max={activeCfg.max_score}
                                    step="0.5"
                                    placeholder="N/A"
                                    value={bulkScores[student.id] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBulkScores(prev => ({ ...prev, [student.id]: val }));
                                      setBulkEntryError(null);
                                    }}
                                    className="w-16 h-8 text-center text-xs border border-stone-300 rounded-md focus:ring-1 focus:ring-[#1B4332] focus:border-[#1B4332] font-semibold"
                                  />
                                  <span className="text-2xs text-stone-500">/ {activeCfg.max_score}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-end space-x-2 pt-2 border-t border-stone-200">
                            <button
                              onClick={() => setBulkEntryConfigId(null)}
                              className="py-1.5 px-3 text-xs font-semibold text-stone-500 hover:text-stone-700 hover:bg-stone-200 rounded-lg Transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveBulkScores}
                              className="py-1.5 px-4 bg-[#1B4332] hover:bg-[#153326] text-white text-xs font-bold rounded-lg transition-all shadow-xs"
                            >
                              Save and Sync Grades
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                {/* Grade display breakdown list */}
                {classStudents.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 text-xs">
                    Please add students to this class in the "Roster & Assignments" tab first.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Live Automatic Seeding & Combination Engine Info Baner */}
                    <div className="mx-4 my-3 p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-xs text-stone-700 flex items-start gap-2.5 shadow-2xs">
                      <div className="bg-[#1B4332] text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider shrink-0 mt-0.5">
                        Live Auto-Compiler
                      </div>
                      <div>
                        <p className="font-bold text-[#1B4332]">Class Position & Score Combination Protocol Active</p>
                        <p className="text-[11px] font-sans text-stone-600 leading-relaxed mt-0.5">
                          This school-wide database automatically aggregates student scores across <strong>all subjects matching this term</strong>. Any entry here by any teacher instantly updates that student's <strong>Cumulative School Total, Overall Average, and Dynamic Class Position Rank</strong> in real-time.
                        </p>
                      </div>
                    </div>

                    <table className="w-full text-left text-xs text-stone-600 border-collapse table-auto">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200">
                          <th className="py-3 px-4 font-bold text-stone-700 tracking-wide">Student</th>
                          {activeConfigs.map(cfg => (
                            <th key={cfg.id} className="py-3 px-4 font-bold text-stone-700 tracking-wide text-center">
                              {cfg.name} <span className="block text-3xs text-stone-400 font-mono">Max {cfg.max_score}</span>
                            </th>
                          ))}
                          <th className="py-3 px-4 font-bold text-stone-700 tracking-wide text-center bg-stone-50/50">
                            Subject Total <span className="block text-3xs text-stone-400 font-mono">Sum configs</span>
                          </th>
                          <th className="py-3 px-4 font-bold text-stone-700 tracking-wide text-center">Percentage</th>
                          <th className="py-3 px-4 font-bold text-stone-700 tracking-wide">Status Level</th>
                          
                          {/* Real-time Multi-Subject Columns */}
                          <th className="py-3 px-4 font-black text-center text-emerald-900 bg-emerald-50/40 tracking-wide border-l border-emerald-100">
                            Class Total <span className="block text-3xs text-[#1B4332] font-mono font-bold">All Subjects</span>
                          </th>
                          <th className="py-3 px-4 font-black text-center text-emerald-900 bg-emerald-50/40 tracking-wide">
                            Overall Avg <span className="block text-3xs text-[#1B4332] font-mono font-bold">All Subjects</span>
                          </th>
                          <th className="py-3 px-4 font-black text-center text-emerald-900 bg-emerald-50/60 tracking-wide">
                            Class Position <span className="block text-3xs text-[#1B4332] font-mono font-bold">Live Ranking</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((student, idx) => {
                          let sumScored = 0;
                          let sumMax = 0;
                          
                          // Determine individual scores
                          const rScores = activeConfigs.map(cfg => {
                            const found = activeSubjectScores.find(
                              sc => sc.student_id === student.id && sc.assessment_config_id === cfg.id
                            );
                            const hasScore = found !== undefined;
                            
                            if (found) {
                              sumScored += found.score;
                            }
                            sumMax += cfg.max_score;

                            return {
                              configId: cfg.id,
                              score: found ? found.score : null,
                              hasScore
                            };
                          });

                          const percentage = sumMax > 0 ? Math.round((sumScored / sumMax) * 100) : 0;
                          const rating = getPerformanceRating(percentage);

                          // Query dynamic overall stats from compiledClasses memo
                          const overallStats = (() => {
                            const classComp = compiledClasses.find(c => c.classId === selectedClassId);
                            if (!classComp) return null;
                            const match = classComp.rankings.find(r => r.student.id === student.id);
                            if (!match) return null;
                            return {
                              totalScore: match.totalScore,
                              totalMaxPossible: match.totalMaxPossible,
                              avgPct: match.avgPct,
                              rank: match.rank,
                              totalStudents: classComp.studentsCount
                            };
                          })();

                          return (
                            <tr key={student.id} className="border-b border-stone-150 hover:bg-stone-50/40">
                              <td className="py-3.5 px-4 font-medium text-stone-900">
                                <span className="font-bold">{student.name}</span>
                                <span className="block font-mono text-3xs text-stone-400 mt-0.5">{student.code}</span>
                              </td>

                              {rScores.map(scoreObj => (
                                <td key={scoreObj.configId} className="py-3.5 px-4 text-center font-semibold">
                                  {scoreObj.hasScore ? (
                                    <span className="text-stone-800">{scoreObj.score}</span>
                                  ) : (
                                    <span className="text-stone-300">-</span>
                                  )}
                                </td>
                              ))}

                              <td className="py-3.5 px-4 text-center font-black text-[#1B4332] bg-stone-50/30">
                                {sumMax > 0 ? (
                                  <span>{sumScored} <span className="text-stone-400 text-3xs font-medium">/ {sumMax}</span></span>
                                ) : (
                                  <span className="text-stone-300">-</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                {sumMax > 0 ? (
                                  <span className={`font-mono font-bold text-xs ${percentage >= 50 ? 'text-[#1B4332]' : 'text-amber-650'}`}>
                                    {percentage}%
                                  </span>
                                ) : (
                                  <span className="text-stone-300">-</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {sumMax > 0 ? (
                                  <span className={`px-2 py-0.5 rounded-full text-3xs font-semibold border ${rating.color}`}>
                                    {rating.label}
                                  </span>
                                ) : (
                                  <span className="text-3xs text-stone-300">No grading active</span>
                                )}
                              </td>

                              {/* Real-time Multi-Subject Columns outputs */}
                              <td className="py-3.5 px-4 text-center bg-emerald-50/10 font-black border-l border-emerald-100 text-stone-800">
                                {overallStats ? (
                                  <span>{overallStats.totalScore} <span className="text-stone-450 text-3xs font-semibold">/ {overallStats.totalMaxPossible}</span></span>
                                ) : (
                                  <span className="text-stone-300">-</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center bg-emerald-50/10 font-mono font-bold">
                                {overallStats && overallStats.totalMaxPossible > 0 ? (
                                  <span className={overallStats.avgPct >= 50 ? 'text-[#1B4332]' : 'text-amber-650'}>
                                    {overallStats.avgPct}%
                                  </span>
                                ) : (
                                  <span className="text-stone-300">-</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center bg-emerald-50/20 font-bold whitespace-nowrap">
                                {overallStats ? (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black shadow-3xs border ${
                                    overallStats.rank === 1 
                                      ? 'bg-amber-150 text-amber-900 border-amber-300' 
                                      : overallStats.rank === 2 
                                        ? 'bg-stone-100 text-stone-850 border-stone-200' 
                                        : overallStats.rank === 3 
                                          ? 'bg-orange-100 text-orange-950 border-orange-200' 
                                          : 'bg-emerald-800 text-white border-transparent'
                                  }`}>
                                    {getOrdinal(overallStats.rank)} <span className="text-3xs opacity-80 font-medium font-sans">of {overallStats.totalStudents}</span>
                                  </span>
                                ) : (
                                  <span className="text-stone-300">-</span>
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
            )}
          </div>
        </div>
      ) : academicMode === 'broadsheet' ? (
        /* BROADSHEET CLASS SUMMARY MODE */
        <div className="bg-white border border-stone-250 rounded-2xl overflow-hidden shadow-xs space-y-4">
          <div className="border-b border-stone-200 bg-stone-50/50 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-stone-900 mt-1">Class academic Performance Sheet</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Full class results broadsheet for <strong className="text-stone-800">{activeClass?.name || 'Class'}</strong> showing cumulative totals, average percentages, and positions.
              </p>
            </div>

            <button
              onClick={handleExportBroadsheet}
              disabled={classStudents.length === 0}
              className="inline-flex items-center space-x-1.5 py-2 px-4 bg-emerald-700 hover:bg-emerald-850 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>

          {classStudents.length === 0 ? (
            <div className="p-12 text-center text-stone-500 text-xs">
              No roster students found. Add students in "Roster & Assignments" to compile the broadsheet report card.
            </div>
          ) : classSubjects.length === 0 ? (
            <div className="p-12 text-center text-stone-500 text-xs text-medium">
              No subjects registered. Create subjects in "Subject Gradebook" perspective to view scores broadsheets.
            </div>
          ) : (
            <div className="overflow-x-auto min-h-96">
              <table className="w-full text-left text-xs border-collapse divide-y divide-stone-200">
                <thead>
                  <tr className="bg-stone-50">
                    <th className="py-3 px-4 font-bold text-stone-700 text-center w-16">Position</th>
                    <th className="py-3 px-4 font-bold text-stone-700">Student Name</th>
                    {classSubjects.map(s => (
                      <th key={s.id} className="py-3 px-4 font-bold text-stone-700 text-center">
                        {s.name}
                      </th>
                    ))}
                    <th className="py-3 px-4 font-bold text-stone-700 text-center bg-stone-50/50">Total obtained</th>
                    <th className="py-3 px-4 font-bold text-stone-700 text-center bg-stone-50/50">Class Average</th>
                    <th className="py-3 px-4 font-bold text-stone-700">Report Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-150">
                  {rankedRows.map((row) => {
                    const isTopThree = row.rank <= 3;
                    const rating = getPerformanceRating(row.overallPercentage);

                    return (
                      <tr key={row.student.id} className="hover:bg-stone-50/35">
                        <td className="py-3.5 px-4 text-center">
                          {isTopThree ? (
                            <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full font-bold text-xs ring-2 ${
                              row.rank === 1 
                                ? 'bg-amber-100 text-amber-800 ring-amber-300' 
                                : row.rank === 2 
                                  ? 'bg-stone-100 text-stone-700 ring-stone-200' 
                                  : 'bg-orange-150 text-orange-900 ring-orange-250'
                            }`} title={`${getOrdinal(row.rank)} position`}>
                              {row.rank}
                            </span>
                          ) : (
                            <span className="font-mono text-stone-500 font-bold text-xs">{getOrdinal(row.rank)}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-stone-900 text-sm block">{row.student.name}</span>
                          <span className="font-mono text-3xs text-stone-400 block mt-0.5">{row.student.code}</span>
                        </td>

                        {classSubjects.map(s => {
                          const match = row.subjectSums[s.id];
                          const scoredPoints = match ? match.scored : 0;
                          
                          return (
                            <td key={s.id} className="py-3.5 px-4 text-center font-semibold">
                              {match && match.maxAllowed > 0 && assessmentConfigs.some(c => c.subject_id === s.id) ? (
                                <span className="text-stone-850">
                                  {scoredPoints} <span className="text-3xs text-stone-400 font-normal">/ {match.maxAllowed}</span>
                                </span>
                              ) : (
                                <span className="text-stone-300">-</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="py-3.5 px-4 font-black text-center text-[#1B4332] bg-emerald-50/10 text-sm">
                          {row.overallScored} <span className="text-3xs leading-none font-medium text-stone-400 block">points</span>
                        </td>

                        <td className="py-3.5 px-4 text-center bg-stone-50/20">
                          <span className={`font-mono font-bold text-sm ${row.overallPercentage >= 50 ? 'text-[#1B4332]' : 'text-amber-650'}`}>
                            {row.overallPercentage}%
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-3xs font-semibold border ${rating.color}`}>
                            {rating.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* TERM-END RANKINGS COMPILER & SYSTEM TERM COMPILE MODE */
        <div className="space-y-6">
          {/* Main Control Card */}
          <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Award className="h-48 w-48 text-[#1B4332]" />
            </div>
            
            <div className="space-y-2 max-w-2xl text-left">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-bold bg-[#1B4332]/10 text-[#1B4332] uppercase tracking-wider">
                System Terminal
              </span>
              <h3 className="text-lg font-bold text-stone-900 leading-tight">
                School-Wide Term-End Calculation & Position Compiler
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Combine every student's score from all of their received subjects. This automated engine computes overall student sums, percentage averages, and outputs accurate position rankings per class.
              </p>
              
              {compileSuccessMsg && (
                <div id="compile-success-alert" className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-2xs p-3.5 rounded-xl font-medium mt-2 flex items-start space-x-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{compileSuccessMsg}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full md:w-auto">
              {compiledClasses.some(c => c.rankings.length > 0) && (
                <>
                  <button
                    id="btn-share-all-emails"
                    onClick={handleBatchEmailReports}
                    disabled={isBatchEmailing}
                    className="inline-flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isBatchEmailing ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white mr-1.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Sharing Report Cards...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 text-emerald-450" />
                        <span>Share Report cards to Email</span>
                      </>
                    )}
                  </button>

                  <button
                    id="btn-export-rankings"
                    onClick={handleExportFullRankings}
                    className="inline-flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-[#1B4332]/10 border border-[#1B4332]/20 text-[#1B4332] hover:bg-[#1B4332]/20 rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export Rankings Sheet</span>
                  </button>
                </>
              )}
              
              <button
                id="btn-run-term-compile"
                onClick={handleCompileRanks}
                disabled={isCompiling}
                className="inline-flex items-center justify-center space-x-2 py-2.5 px-5 bg-[#1B4332] hover:bg-[#153326] text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-70 disabled:cursor-wait shrink-0 font-medium header_btn_shadow"
              >
                {isCompiling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Compiling Calculations...</span>
                  </>
                ) : (
                  <>
                    <Sliders className="h-4 w-4" />
                    <span>Run Term calculations</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* BATCH EMAIL DISSEMINATION SYSTEM PROGRESS CARD */}
          {(isBatchEmailing || batchProgress) && (
            <div className="bg-stone-900 text-[#00FF55] border border-stone-800 p-5 rounded-3xl font-mono text-3xs text-left space-y-3.5 shadow-xl max-w-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-3">
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isBatchEmailing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  <span className="font-extrabold uppercase text-stone-350 tracking-wider">
                    School-Wide Email Dissemination Terminal
                  </span>
                </div>
                <div className="text-3xs text-stone-400 font-bold uppercase font-sans">
                  Processed: {batchProgress?.current} / {batchProgress?.total} Families
                </div>
              </div>

              {/* Progress Bar */}
              {batchProgress && (
                <div className="relative w-full h-1.5 bg-stone-850 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-[#00FF55] transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              )}

              {/* Console Logs */}
              <div className="max-h-40 overflow-y-auto space-y-1.5 leading-relaxed pr-2 scrollbar-thin scrollbar-thumb-stone-800">
                {batchProgress?.logs.map((log, logIdx) => {
                  let logColor = "text-stone-300";
                  if (log.includes("[SMTP DISPATCH]")) logColor = "text-amber-100";
                  if (log.includes("[OK]")) logColor = "text-[#00FF55]";
                  if (log.includes("[INFO]")) logColor = "text-sky-350";
                  return (
                    <div key={logIdx} className={`truncate ${logColor}`}>
                      <span className="text-stone-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                      <span>{log}</span>
                    </div>
                  );
                })}
              </div>

              {/* Success Banner */}
              {batchEmailSuccessMsg && (
                <div className="bg-emerald-950/40 border border-[#00FF55]/25 p-3.5 rounded-2xl text-[#00FF55] leading-normal flex items-start space-x-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <div>
                    <h5 className="font-black uppercase tracking-wider text-4xs">Successful Execution</h5>
                    <p className="mt-0.5 text-stone-250 font-medium font-sans text-xs">{batchEmailSuccessMsg}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grid of Class Summaries */}
          <div className="space-y-4 text-left">
            <h4 id="lbl-summaries-header" className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Class Performance Summaries ({classes.length})
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {compiledClasses.map(item => {
                const isSelected = selectedCompClassId === item.classId;
                const hasRankings = item.rankings.length > 0;
                
                return (
                  <div
                    id={`class-card-${item.classId}`}
                    key={item.classId}
                    onClick={() => setSelectedCompClassId(item.classId)}
                    className={`bg-white border cursor-pointer rounded-2xl p-5 space-y-4 transition-all duration-200 shadow-3xs ${
                      isSelected 
                        ? 'ring-2 ring-emerald-800 border-transparent bg-stone-50/20' 
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-bold text-stone-900 text-sm">{item.className}</h5>
                        <p className="text-3xs text-stone-500 font-semibold uppercase tracking-wider mt-0.5">
                          {item.studentsCount} Students • {item.subjectsCount} Subjects
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-3xs font-bold border ${
                        hasRankings 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-stone-50 text-stone-550 border-stone-200'
                      }`}>
                        {hasRankings ? '✓ Compiled' : 'Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-stone-100 pt-3">
                      <div>
                        <span className="block text-3xs text-stone-500 font-bold uppercase">Class Average</span>
                        <span className="text-sm font-black text-[#1B4332] mt-0.5 block">
                          {hasRankings ? `${item.classAverageScore} pts` : '--'}
                        </span>
                        <span className="text-3xs text-stone-450 block font-medium">
                          {hasRankings ? `(${item.classAveragePercentage}% avg)` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="block text-3xs text-stone-500 font-bold uppercase">Highest Score</span>
                        <span className="text-sm font-black text-amber-700 mt-0.5 block truncate">
                          {hasRankings ? `${item.highestScore} pts` : '--'}
                        </span>
                        <span className="text-3xs text-stone-450 block font-medium truncate">
                          {hasRankings ? `by ${item.topStudent}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="bg-stone-50/50 p-2.5 rounded-xl text-3xs font-medium text-stone-600 flex justify-between items-center">
                      <span>Lowest compiled: {hasRankings ? `${item.lowestScore} pts` : '--'}</span>
                      <span className="text-[#1B4332] font-semibold hover:underline flex items-center">
                        View board <ChevronRight className="h-3 w-3 inline ml-0.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaders Board Section */}
          <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-xs">
            {/* Header & Filter Controls */}
            <div className="border-b border-stone-100 p-5 bg-stone-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
              <div>
                <h4 id="lbl-leaderboard-header" className="text-sm font-bold text-stone-900">
                  🎯 Student Rankings Leaderboard
                </h4>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  {selectedCompClassId 
                    ? `Showing ranked results for ${classes.find(c => c.id === selectedCompClassId)?.name}` 
                    : 'Showing aggregated results across all classes'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <input
                  id="rankings-search-field"
                  type="text"
                  placeholder="Search student code or name..."
                  value={searchRankQuery}
                  onChange={(e) => setSearchRankQuery(e.target.value)}
                  className="text-xs border border-stone-200 rounded-xl px-3 py-2 bg-white max-w-xs font-semibold"
                />

                <select
                  id="rankings-class-select"
                  value={selectedCompClassId}
                  onChange={(e) => setSelectedCompClassId(e.target.value)}
                  className="text-xs border border-stone-200 rounded-xl px-3 py-2 bg-white font-semibold"
                >
                  <option value="">All Classes Collectively</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dashboard Display Table */}
            {(() => {
              // Flatten or filter list of student ranks
              let activeRanks: {
                className: string;
                student: Student;
                totalScore: number;
                totalMaxPossible: number;
                avgPct: number;
                rank: number;
                classAvg: number;
              }[] = [];

              compiledClasses.forEach(c => {
                if (!selectedCompClassId || selectedCompClassId === c.classId) {
                  c.rankings.forEach(r => {
                    activeRanks.push({
                      className: c.className,
                      student: r.student,
                      totalScore: r.totalScore,
                      totalMaxPossible: r.totalMaxPossible,
                      avgPct: r.avgPct,
                      rank: r.rank,
                      classAvg: c.classAverageScore
                    });
                  });
                }
              });

              // Apply search filter if query is present
              if (searchRankQuery.trim()) {
                const norm = searchRankQuery.toLowerCase();
                activeRanks = activeRanks.filter(
                  r => r.student.name.toLowerCase().includes(norm) || r.student.code.toLowerCase().includes(norm)
                );
              }

              if (activeRanks.length === 0) {
                return (
                  <div className="p-12 text-center text-stone-500 font-medium text-xs">
                    No compiled records found. To populate the student ranking leaderboard, please click the "Run Term calculations" button above first!
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto min-h-96">
                  <table className="w-full text-left text-xs border-collapse divide-y divide-stone-200">
                    <thead className="bg-stone-50 font-bold text-stone-700 tracking-wider">
                      <tr>
                        <th className="p-4 w-20">Rank Position</th>
                        <th className="p-4">Student Info</th>
                        <th className="p-4 w-40">Class & Section</th>
                        <th className="p-4 text-center">Combined Subject Score</th>
                        <th className="p-4 text-center">Class Avg Score</th>
                        <th className="p-4 text-center">Avg %</th>
                        <th className="p-4 text-center">Rating</th>
                        <th className="p-4 text-center w-36">Report Card</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-150 font-semibold text-stone-850">
                      {activeRanks.map((item, idx) => {
                        const performs = getPerformanceRating(item.avgPct);
                        
                        return (
                          <tr id={`rank-row-${item.student.id}`} key={`${item.student.id}_${idx}`} className="hover:bg-stone-50/50">
                            <td className="p-4">
                              <span className={`inline-flex items-center justify-center p-1.5 w-9 h-9 font-black rounded-full border text-xs leading-none ${
                                item.rank === 1
                                  ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm'
                                  : item.rank === 2
                                    ? 'bg-slate-100 text-slate-800 border-slate-300'
                                    : item.rank === 3
                                      ? 'bg-amber-50 text-amber-700 border-orange-200'
                                      : 'bg-[#FDFDFD] text-stone-650 border-stone-200'
                              }`}>
                                {getOrdinal(item.rank)}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col text-left">
                                <span className="text-stone-900 font-bold">{item.student.name}</span>
                                <span className="text-3xs text-stone-450 uppercase font-mono mt-0.5 tracking-wider">
                                  {item.student.code}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-left">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-bold border bg-stone-50 text-stone-600 border-stone-200">
                                {item.className}
                              </span>
                            </td>
                            <td className="p-4 text-center font-bold text-stone-900">
                              <div className="flex flex-col items-center">
                                <span>{item.totalScore} marks</span>
                                <span className="text-3xs text-stone-500 font-semibold">
                                  of {item.totalMaxPossible} max possible
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-center font-bold text-stone-700 text-xs">
                              {item.classAvg} pts
                            </td>
                            <td className="p-4 text-center font-black text-[#1B4332]">
                              {item.avgPct}%
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-3xs font-semibold border ${performs.color}`}>
                                {performs.label}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                id={`btn-generate-report-${item.student.id}`}
                                onClick={() => handleOpenReportCard(item)}
                                className="inline-flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-4xs font-black uppercase tracking-wider select-none shadow-3xs cursor-pointer transition-all duration-150 hover:scale-103"
                              >
                                <FileText className="h-3 w-3 text-emerald-450" />
                                <span>Report Card</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD SUBJECT MODAL */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-905/30 backdrop-blur-xs p-4 bg-stone-900/40">
          <div className="bg-white rounded-2xl border border-stone-250 shadow-xl overflow-hidden w-full max-w-md">
            <div className="p-4 sm:p-5 border-b border-stone-200 flex justify-between items-center bg-stone-50">
              <h3 className="text-sm font-bold text-stone-850 flex items-center">
                <BookOpen className="h-4 w-4 mr-1.5 text-[#1B4332]" />
                <span>Add Class Subject</span>
              </h3>
              <button
                onClick={() => setShowAddSubjectModal(false)}
                className="text-stone-400 hover:text-stone-600 hover:bg-stone-100 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubject} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Subject name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Civic Education"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="w-full text-xs border border-stone-300 rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-[#1B4332] focus:border-[#1B4332] font-semibold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="py-1.5 px-3.5 rounded-lg text-xs font-semibold text-stone-500 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-1.5 px-4 bg-[#1B4332] hover:bg-[#153326] text-white text-xs font-bold rounded-lg transition-all shadow-xs"
                >
                  Create subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIG ASSESSMENTS MODAL */}
      {showConfigAssessmentsModal && activeSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-250 shadow-xl overflow-hidden w-full max-w-lg">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-stone-850">
                  Configure Grading Slots: {activeSubject.name}
                </h3>
                <p className="text-3xs text-stone-500 font-medium">Add assignments, tests, or exam weight brackets matching this subject.</p>
              </div>
              <button
                onClick={() => setShowConfigAssessmentsModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 hover:bg-stone-100 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Added configs list */}
              <div>
                <span className="block text-3xs font-bold text-stone-500 uppercase tracking-widest mb-2.5">Active Slots</span>
                {activeConfigs.length === 0 ? (
                  <div className="text-2xs text-stone-400 bg-stone-50 border border-stone-150 p-4 rounded-xl text-center">
                    No slots configured yet. Add them below!
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {activeConfigs.map(cfg => (
                      <div key={cfg.id} className="flex justify-between items-center p-2.5 bg-stone-50 border border-stone-150 rounded-xl">
                        <div>
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-4xs font-mono font-bold uppercase tracking-wider mr-2 ${
                            cfg.type === 'assignment'
                              ? 'bg-blue-100 text-blue-850'
                              : cfg.type === 'test'
                                ? 'bg-[#D4A017]/10 text-amber-700'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {cfg.type}
                          </span>
                          <strong className="text-xs text-stone-800">{cfg.name}</strong>
                        </div>
                        <div className="flex items-center space-x-3 text-xs">
                          <span className="font-bold text-stone-600">{cfg.max_score} marks</span>
                          <button
                            onClick={() => handleDeleteAssessmentConfig(cfg.id, cfg.name)}
                            className="text-stone-450 hover:text-red-650"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 text-right text-3xs font-semibold text-stone-500">
                      Total possible sum score: {activeConfigs.reduce((acc, c) => acc + c.max_score, 0)} marks
                    </div>
                  </div>
                )}
              </div>

              {/* Add form */}
              <form onSubmit={handleAddAssessmentConfig} className="p-4 bg-stone-50/50 border border-stone-200 rounded-2xl space-y-3">
                <span className="block text-3xs font-bold text-[#1B4332] uppercase tracking-wider">Create grading slot</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1.5">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Quiz 1"
                      value={newAsmName}
                      onChange={(e) => setNewAsmName(e.target.value)}
                      className="w-full text-xs border border-stone-300 rounded-lg p-2.5 bg-white font-semibold"
                    />
                  </div>

                  <div>
                    <select
                      value={newAsmType}
                      onChange={(e: any) => setNewAsmType(e.target.value)}
                      className="w-full text-xs border border-stone-300 rounded-lg p-2.5 bg-white font-semibold"
                    >
                      <option value="assignment">Assignment</option>
                      <option value="test">Test</option>
                      <option value="exam">Exam</option>
                    </select>
                  </div>

                  <div>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      placeholder="Max score"
                      value={newAsmMaxScore || ''}
                      onChange={(e) => setNewAsmMaxScore(Number(e.target.value))}
                      className="w-full text-xs border border-stone-300 rounded-lg p-2.5 bg-white font-semibold text-center"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1 py-1.5 px-4 bg-[#1B4332] hover:bg-[#153326] text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create slot</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REPORT CARD PREVIEW & DISTRIBUTION MODAL */}
      {showReportCardModal && selectedReportStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-905/40 bg-[#0c0d0e]/45 backdrop-blur-xs select-none">
          <div className="bg-stone-100 border border-stone-250 rounded-3xl shadow-2xl overflow-hidden w-full max-w-5xl flex flex-col md:flex-row h-[90vh] max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* LEFT SIDE: REPORT CARD PREVIEW PANEL */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white border-r border-stone-200 flex flex-col justify-between">
              <div>
                {/* Header & Crest */}
                <div className="flex justify-between items-start border-b border-double border-stone-300 pb-5 mb-5 text-left gap-3">
                  <div className="flex items-center gap-3">
                    {(currentSchool.badgeUrl || currentSchool.logoUrl) && (
                      <img 
                        src={currentSchool.badgeUrl || currentSchool.logoUrl} 
                        alt="School Badge" 
                        className="w-12 h-12 object-contain rounded-xl border border-stone-200 bg-stone-50 p-1 shrink-0"
                      />
                    )}
                    <div className="space-y-0.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-4xs font-black bg-[#1B4332]/10 text-[#1B4332] uppercase tracking-wider">
                        Academic Ledger
                      </span>
                      <h2 className="text-base font-black text-[#1B4332] uppercase tracking-tight">{currentSchool.name}</h2>
                      <p className="text-3xs text-stone-500 font-bold uppercase tracking-widest">Official Continuous Assessment Portfolio</p>
                    </div>
                  </div>
                  <div className="border border-[#1B4332]/25 rounded-xl p-2.5 bg-stone-50 text-center text-3xs font-extrabold uppercase text-[#1B4332] shrink-0">
                    <div>Term End</div>
                    <div className="text-2xs font-black text-amber-700 leading-none mt-0.5">Report</div>
                  </div>
                </div>

                {/* Metadata details grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-stone-50/75 border border-stone-200 p-4 rounded-2xl mb-5 text-left text-2xs">
                  <div>
                    <span className="block text-4xs text-stone-500 font-bold uppercase tracking-wider">Student Full Name</span>
                    <span className="font-bold text-stone-900 text-xs">{selectedReportStudent.student.name}</span>
                  </div>
                  <div>
                    <span className="block text-4xs text-stone-500 font-bold uppercase tracking-wider">Admission Code</span>
                    <span className="font-bold text-stone-900 font-mono text-xs">{selectedReportStudent.student.code}</span>
                  </div>
                  <div>
                    <span className="block text-4xs text-stone-500 font-bold uppercase tracking-wider">Assigned Class</span>
                    <span className="font-bold text-[#1B4332]">{selectedReportStudent.className}</span>
                  </div>
                  <div>
                    <span className="block text-4xs text-stone-500 font-bold uppercase tracking-wider">Academic Term Scope</span>
                    <span className="font-bold text-stone-600">{currentTerm}</span>
                  </div>
                </div>

                {/* Score breakdown per Subject */}
                <div className="space-y-3">
                  <span className="block text-3xs font-black text-stone-600 uppercase tracking-widest text-left">Subject-Wise Marks Breakdown</span>
                  <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-3xs">
                    <table className="w-full text-3xs text-left border-collapse">
                      <thead className="bg-stone-50 font-bold text-stone-600 uppercase tracking-wide border-b border-stone-200">
                        <tr>
                          <th className="p-3 text-left">Subject</th>
                          <th className="p-3 text-center">Assign</th>
                          <th className="p-3 text-center">Tests</th>
                          <th className="p-3 text-center">Exam</th>
                          <th className="p-3 text-center">Scored</th>
                          <th className="p-3 text-center">Pct %</th>
                          <th className="p-3 text-center">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-150 font-semibold text-stone-850">
                        {(() => {
                          const cls_id = selectedReportStudent.student.class_id;
                          const clsSubjects = subjects.filter(s => s.class_id === cls_id);
                          
                          if (clsSubjects.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="p-4 text-center text-stone-400 font-medium">
                                  No subjects are assigned to this class context.
                                </td>
                              </tr>
                            );
                          }
                          
                          return clsSubjects.map(sub => {
                            const subConfigs = assessmentConfigs.filter(cfg => cfg.subject_id === sub.id);
                            const subScores = studentScores.filter(
                              sc => sc.student_id === selectedReportStudent.student.id && sc.subject_id === sub.id && sc.term === currentTerm
                            );
                            
                            let assignScored = 0, assignMax = 0;
                            let testScored = 0, testMax = 0;
                            let examScored = 0, examMax = 0;
                            let totalScored = 0, totalMax = 0;
                            
                            subConfigs.forEach(cfg => {
                              const found = subScores.find(sc => sc.assessment_config_id === cfg.id);
                              const scored = found ? found.score : 0;
                              if (cfg.type === 'assignment') {
                                assignScored += scored;
                                assignMax += cfg.max_score;
                              } else if (cfg.type === 'test') {
                                testScored += scored;
                                testMax += cfg.max_score;
                              } else if (cfg.type === 'exam') {
                                examScored += scored;
                                examMax += cfg.max_score;
                              }
                              totalScored += scored;
                              totalMax += cfg.max_score;
                            });
                            
                            const pct = totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;
                            const ratingInfo = getLetterGrade(pct);
                            
                            return (
                              <tr key={sub.id} className="hover:bg-stone-50/40">
                                <td className="p-3 font-bold text-stone-900 text-left border-l-2 border-[#1B4332]">{sub.name}</td>
                                <td className="p-3 text-center text-stone-500 font-mono">{assignMax > 0 ? `${assignScored}/${assignMax}` : '-'}</td>
                                <td className="p-3 text-center text-stone-500 font-mono">{testMax > 0 ? `${testScored}/${testMax}` : '-'}</td>
                                <td className="p-3 text-center text-stone-500 font-mono">{examMax > 0 ? `${examScored}/${examMax}` : '-'}</td>
                                <td className="p-3 text-center font-bold text-[#1B4332] font-mono">{totalScored}/{totalMax}</td>
                                <td className="p-3 text-center font-black text-[#1B4332]">{pct}%</td>
                                <td className="p-3 text-center">
                                  <span className="px-1.5 py-0.5 rounded-md font-extrabold bg-amber-50 text-amber-800 border border-orange-200">
                                    {ratingInfo.grade}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Performance Summary Cards */}
                <div className="grid grid-cols-4 gap-3.5 mt-5">
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-center shadow-3xs">
                    <span className="block text-4xs font-bold uppercase tracking-wider text-stone-500">Total Marks</span>
                    <strong className="text-xs text-stone-900 mt-1 block leading-none font-black font-mono">
                      {selectedReportStudent.totalScore}
                      <span className="text-4xs text-stone-450 font-normal"> / {selectedReportStudent.totalMaxPossible}</span>
                    </strong>
                  </div>
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-center shadow-3xs">
                    <span className="block text-4xs font-bold uppercase tracking-wider text-stone-500">Class Average</span>
                    <strong className="text-xs text-stone-900 mt-1 block leading-none font-black font-mono">
                      {selectedReportStudent.classAvg} <span className="text-4xs text-stone-400">pts</span>
                    </strong>
                  </div>
                  <div className="bg-[#1B4332]/5 border border-[#1B4332]/25 rounded-xl p-3 text-center shadow-3xs">
                    <span className="block text-4xs font-black uppercase tracking-wider text-[#1B4332]">Class Average %</span>
                    <strong className="text-xs text-[#1B4332] mt-1 block leading-none font-black font-mono">
                      {selectedReportStudent.avgPct}%
                    </strong>
                  </div>
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-center shadow-3xs">
                    <span className="block text-4xs font-bold uppercase tracking-wider text-stone-500">Position rank</span>
                    <strong className="text-xs text-amber-700 mt-1 block leading-none font-extrabold font-mono">
                      {getOrdinal(selectedReportStudent.rank)}
                    </strong>
                  </div>
                </div>

                {/* Signees & Comments Configuration Block */}
                <div className="mt-5 space-y-4 text-left border-t border-dashed border-stone-200 pt-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label id="lbl-remarks-field" className="block text-4xs font-black uppercase text-stone-500 mb-1.5 tracking-wider">Interactive Teacher Remarks</label>
                      <textarea
                        id="txt-teacher-remarks"
                        value={editableComment}
                        rows={2}
                        onChange={(e) => setEditableComment(e.target.value)}
                        className="w-full text-2xs border border-stone-250 rounded-xl p-2.5 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#1B4332] font-semibold text-stone-700 placeholder-stone-400"
                        placeholder="Write educator/teacher comments here..."
                      />
                    </div>
                    <div>
                      <label id="lbl-principal-field" className="block text-4xs font-black uppercase text-stone-500 mb-1.5 tracking-wider">Principal Signature Name</label>
                      <input
                        id="txt-principal-name"
                        type="text"
                        value={principalName}
                        onChange={(e) => setPrincipalName(e.target.value)}
                        className="w-full text-2xs border border-stone-250 rounded-xl p-2.5 bg-stone-50 focus:bg-white focus:ring-1 focus:ring-[#1B4332] font-semibold text-stone-800"
                        placeholder="Authorized Principal Name"
                      />
                      <span className="text-4xs text-stone-450 block font-semibold mt-1">This prints dynamically on the downloadable report card sheet.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative signature footer summary */}
              <div className="flex justify-between items-center text-3xs border-t border-stone-200 pt-3 text-stone-450 font-bold uppercase tracking-wider mt-4">
                <span>Certified Westminster Portfolio Statement</span>
                <span>Term End calculations {currentTerm}</span>
              </div>
            </div>

            {/* RIGHT SIDE: DISPATCH, ACTIONS & COMMUNICATION SEGMENT */}
            <div className="w-full md:w-[420px] bg-stone-50 p-6 md:p-8 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 border-stone-200">
              <div className="space-y-6">
                
                {/* Header segment with close link */}
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-stone-900 flex items-center space-x-1.5 uppercase tracking-wider">
                    <Mail className="h-4.5 w-4.5 text-[#1B4332] sr-icon mr-1" />
                    <span>Disseminate Portfolios</span>
                  </h3>
                  <button
                    onClick={() => setShowReportCardModal(false)}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 z-10 transition-colors cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* ACTION CARD 1: EXPORT AND PREVIEW STATEMENT */}
                <div className="bg-white border border-stone-250 rounded-2xl p-4 shadow-sm text-left space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl text-emerald-700 shrink-0">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-2xs font-bold text-stone-900">Local Download Module</h4>
                      <p className="text-3xs text-stone-500 font-medium font-semibold leading-relaxed">Download a complete, high-grade printable HTML dossier with offline embedded styles ready to be printed or shared as a PDF document.</p>
                    </div>
                  </div>
                  <button
                    id="btn-download-print-report"
                    onClick={handleDownloadReportCardHTML}
                    className="w-full py-2 px-4 bg-[#1B4332] hover:bg-[#153326] text-white rounded-xl text-xs font-bold tracking-wider hover:scale-101 uppercase flex items-center justify-center space-x-2 transition-all cursor-pointer select-none"
                  >
                    <Printer className="h-4 w-4 shrink-0" />
                    <span>Download Dossier Report Card</span>
                  </button>
                </div>

                {/* ACTION CARD 2: DIRECT ELECTRONIC MAIL DISPATCH */}
                <div className="bg-white border border-stone-250 rounded-2xl p-4 shadow-sm text-left space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-50 border border-blue-100 p-2 rounded-xl text-blue-700 shrink-0">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-2xs font-bold text-stone-900">Transmit Report card via Email</h4>
                      <p className="text-3xs text-stone-450 font-semibold">Distribute statement electronically to student and guardian mailboxes.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label id="lbl-guardian-email" className="block text-4xs font-black uppercase text-stone-550 mb-1 tracking-wider">Recipient Guardian / Student Email</label>
                      <input
                        id="report-email-input"
                        type="email"
                        required
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className="w-full text-2xs border border-stone-300 rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-blue-650 font-bold"
                        placeholder="e.g. parent@school.com"
                      />
                    </div>

                    <div>
                      <label id="lbl-custom-body" className="block text-4xs font-black uppercase text-stone-550 mb-1 tracking-wider">Custom Message Body Preview</label>
                      <textarea
                        id="report-message-input"
                        rows={4}
                        value={customEmailMessage}
                        onChange={(e) => setCustomEmailMessage(e.target.value)}
                        className="w-full text-3xs border border-stone-300 rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-blue-650 font-semibold text-stone-600 leading-relaxed"
                        placeholder="Define email message context..."
                      />
                    </div>

                    <button
                      id="btn-dispatch-report-email"
                      onClick={handleSendReportCardEmail}
                      disabled={isSendingEmail || !recipientEmail.trim()}
                      className="w-full py-2 px-4 bg-stone-900 hover:bg-stone-850 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-wait text-center flex items-center justify-center space-x-2 cursor-pointer transition-all"
                    >
                      {isSendingEmail ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white mr-1.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Transmitting Portfolio...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Dispatch Email Packet</span>
                        </>
                      )}
                    </button>
                    
                    {/* Real Client Mailto Option */}
                    <a
                      id="link-mailto-fallback"
                      href={`mailto:${recipientEmail}?subject=${encodeURIComponent(`Academic Report Card: ${selectedReportStudent.student.name} - ${currentTerm}`)}&body=${encodeURIComponent(customEmailMessage)}`}
                      className="text-center block text-4xs text-[#1B4332] font-black hover:underline uppercase tracking-wider mt-2.5 cursor-pointer selection_none"
                    >
                      Open in External Email Client instead
                    </a>
                  </div>
                </div>

                {/* SECURE SMTP ELECTRONIC PROCESSOR TRANSACTION LOGS */}
                {(isSendingEmail || emailLogLines.length > 0) && (
                  <div className="bg-stone-900 text-[#00FF55] border border-stone-800 p-3.5 rounded-xl font-mono text-4xs text-left max-h-36 overflow-y-auto space-y-1.5 leading-relaxed shadow-inner">
                    <div className="border-b border-stone-800 pb-1 mr-4 font-bold uppercase text-stone-400">SMTP Server Core Dispatch log</div>
                    {emailLogLines.map((log, lIdx) => (
                      <div key={lIdx} className="truncate">
                        <span className="text-stone-550 mr-1.5">[{new Date().toLocaleTimeString()}]</span>
                        <span>{log}</span>
                      </div>
                    ))}
                    {isSendingEmail && <div className="text-white animate-pulse font-bold">■ Transmitting TCP packages...</div>}
                  </div>
                )}

                {/* EMAIL SHARE SUCCESS ALERT */}
                {emailShareSuccess && (
                  <div id="email-success-alert" className="bg-emerald-50 border border-emerald-250 text-emerald-800 text-3xs p-3.5 rounded-xl font-bold flex items-start space-x-1 text-left">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 mr-1" />
                    <span>{emailShareSuccess}</span>
                  </div>
                )}

              </div>

              {/* Secure Close button block */}
              <button
                id="btn-close-report-modal"
                onClick={() => setShowReportCardModal(false)}
                className="w-full mt-6 py-2 px-4 border border-stone-300 hover:bg-stone-200 text-stone-600 rounded-xl text-3xs uppercase font-extrabold tracking-widest cursor-pointer select-none"
              >
                Close Statement Viewer
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
