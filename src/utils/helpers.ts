/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudentReportRow } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Clean class name and pad with a 3-digit sequence.
 * E.g., "JSS 3A" -> prefix "JSS3A", seq 1 -> "JSS3A-001"
 */
export function generateStudentCode(className: string, currentCount: number): string {
  const prefix = className.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const seq = String(currentCount + 1).padStart(3, '0');
  return `${prefix}-${seq}`;
}

/**
 * Processes attendance records to calculate percentage, absences, and ratings.
 * Percentage: (On Time + Late) / total distinct sessions × 100.
 * Rating: Excellent (>= 90%), Pass (70% - 89%), Fail (< 70%).
 */
export function calculateStudentStats(
  student: any,
  records: any[],
  distinctDatesCount: number
): StudentReportRow {
  const studentRecords = records.filter(r => r.student_id === student.id);
  const onTimeCount = studentRecords.filter(r => r.status === 'early').length;
  const lateCount = studentRecords.filter(r => r.status === 'late').length;
  const totalPresent = onTimeCount + lateCount;
  
  const sessionsHeld = distinctDatesCount;
  const absentCount = Math.max(0, sessionsHeld - totalPresent);
  
  let percentage = 0;
  if (sessionsHeld > 0) {
    percentage = Math.round((totalPresent / sessionsHeld) * 100);
  }
  
  let rating: 'Excellent' | 'Pass' | 'Fail' = 'Fail';
  if (percentage >= 90) {
    rating = 'Excellent';
  } else if (percentage >= 70) {
    rating = 'Pass';
  }
  
  return {
    student,
    onTimeCount,
    lateCount,
    absentCount,
    totalPresent,
    sessionsHeld,
    percentage,
    rating,
  };
}

/**
 * Downloads a class's attendance data as CSV conforming to:
 * Filename pattern: [ClassName]_[Term]_attendance.csv
 */
export function downloadCSV(className: string, term: string, rows: StudentReportRow[]) {
  const headers = ['Code', 'Name', 'Sessions Held', 'On Time', 'Late', 'Total Present', 'Absent', 'Attendance %', 'Rating'];
  const csvRows = [headers.join(',')];
  
  for (const row of rows) {
    const values = [
      `"${row.student.code}"`,
      `"${row.student.name}"`,
      row.sessionsHeld,
      row.onTimeCount,
      row.lateCount,
      row.totalPresent,
      row.absentCount,
      `"${row.percentage}%"`,
      `"${row.rating}"`,
    ];
    csvRows.push(values.join(','));
  }
  
  const csvContent = '\ufeff' + csvRows.join('\n'); // Add UTF-8 BOM for Excel support
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  const formattedClassName = className.replace(/\s+/g, '_');
  const formattedTerm = term.replace(/[\s/]+/g, '_');
  link.setAttribute('download', `${formattedClassName}_${formattedTerm}_attendance.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads attendance reports as a highly polished PDF document.
 */
export function downloadPDF(schoolName: string, className: string, term: string, rows: StudentReportRow[], schoolLogo?: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Green brand color matching Klaso theme: #1B4332 -> rgb(27, 67, 50)
  // Accent golden color: #D4A017 -> rgb(212, 160, 23)

  // Add School Logo/Badge if available
  if (schoolLogo) {
    try {
      const format = schoolLogo.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(schoolLogo, format, 172, 10, 22, 22);
    } catch {
      // Fallback if image format not directly parsed by jsPDF
    }
  }

  // Document Title Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(27, 67, 50); // Deep brand green
  doc.text('Klaso Academic Registry Report', 14, 18);

  // Subtitle
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Official Student Record for: ${schoolName}`, 14, 25);

  // Golden brand separator line
  doc.setDrawColor(212, 160, 23);
  doc.setLineWidth(0.5);
  doc.line(14, 29, 196, 29);

  // School metadata grid block
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text('Classroom Category:', 14, 36);
  doc.setFont('Helvetica', 'normal');
  doc.text(className, 53, 36);

  doc.setFont('Helvetica', 'bold');
  doc.text('Academic Term Label:', 14, 42);
  doc.setFont('Helvetica', 'normal');
  doc.text(term, 53, 42);

  const sessionsHeld = rows[0]?.sessionsHeld ?? 0;
  doc.setFont('Helvetica', 'bold');
  doc.text('Distinct Sessions Held:', 14, 48);
  doc.setFont('Helvetica', 'normal');
  doc.text(`${sessionsHeld} active dates`, 53, 48);

  const todayStr = new Date().toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  doc.setFont('Helvetica', 'bold');
  doc.text('Generated On:', 120, 36);
  doc.setFont('Helvetica', 'normal');
  doc.text(todayStr, 148, 36);

  doc.setFont('Helvetica', 'bold');
  doc.text('Status:', 120, 42);
  doc.setFont('Helvetica', 'normal');
  doc.text('Synchronized Ledger', 148, 42);

  // Divider Line before table
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(14, 52, 196, 52);

  // Table Setup
  const headers = [['Code', 'Pupil Name', 'On Time', 'Late', 'Absent', 'Present', 'Attendance %', 'Rating']];
  const body = rows.map(r => [
    r.student.code,
    r.student.name,
    r.onTimeCount.toString(),
    r.lateCount.toString(),
    r.absentCount.toString(),
    `${r.totalPresent}/${r.sessionsHeld}`,
    `${r.percentage}%`,
    r.rating
  ]);

  autoTable(doc, {
    startY: 56,
    head: headers,
    body: body,
    theme: 'striped',
    headStyles: {
      fillColor: [27, 67, 50], // Klaso Brand Deep Green
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 25 },
      1: { fontStyle: 'bold', cellWidth: 45 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 20 }
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Klaso School Operating System • Page ${pageCount}`, 14, pageHeight - 10);
      doc.text('Nigeria Secondary Education Quality Standard Compliant', 115, pageHeight - 10);
    }
  });

  const formattedClassName = className.replace(/\s+/g, '_');
  const formattedTerm = term.replace(/[\s/]+/g, '_');
  doc.save(`${formattedClassName}_${formattedTerm}_attendance_report.pdf`);
}

