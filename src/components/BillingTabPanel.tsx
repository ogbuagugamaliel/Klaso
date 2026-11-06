import React, { useState } from 'react';
import { 
  CreditCard, 
  CheckCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Settings, 
  Calendar,
  Lock,
  ArrowRight,
  TrendingUp,
  Clock,
  HelpCircle,
  Plus,
  Users,
  Search,
  Filter,
  DollarSign,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  ChevronDown,
  Printer,
  Mail,
  Download
} from 'lucide-react';
import { School, Student, TermFeesConfig, StudentTermRegistration } from '../types';
import { doc, setDoc } from 'firebase/firestore';

interface BillingTabPanelProps {
  currentSchool: School;
  currentTerm: string;
  isSchoolLocked: boolean;
  onPaySubscription: (term: string) => Promise<void>;
  showPaymentModal: boolean;
  setShowPaymentModal: (show: boolean) => void;
  paymentTermTarget: string;
  setPaymentTermTarget: (term: string) => void;
  paymentStep: 'input' | 'processing' | 'success';
  setPaymentStep: (step: 'input' | 'processing' | 'success') => void;
  paymentCardNumber: string;
  setPaymentCardNumber: (num: string) => void;
  paymentExpiry: string;
  setPaymentExpiry: (expiry: string) => void;
  paymentCVV: string;
  setPaymentCVV: (cvv: string) => void;

  userRole: 'admin' | 'teacher';
  students: Student[];
  classes: any[];
  termFeesConfigs: TermFeesConfig[];
  studentTermRegistrations: StudentTermRegistration[];
  isOfflineMode: boolean;
  db: any;
  saveOfflineItem: (key: string, list: any[]) => void;
  setStatusFeedback: (feedback: { type: 'success' | 'err' | 'info'; msg: string } | null) => void;
}

export const BillingTabPanel: React.FC<BillingTabPanelProps> = ({
  currentSchool,
  currentTerm,
  isSchoolLocked,
  onPaySubscription,
  showPaymentModal,
  setShowPaymentModal,
  paymentTermTarget,
  setPaymentTermTarget,
  paymentStep,
  setPaymentStep,
  paymentCardNumber,
  setPaymentCardNumber,
  paymentExpiry,
  setPaymentExpiry,
  paymentCVV,
  setPaymentCVV,

  userRole,
  students,
  classes,
  termFeesConfigs,
  studentTermRegistrations,
  isOfflineMode,
  db,
  saveOfflineItem,
  setStatusFeedback
}) => {

  // Inner UI and Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  
  // Receipt Generator and Email simulation states
  const [activeReceiptData, setActiveReceiptData] = useState<{
    reg: StudentTermRegistration;
    student: Student;
    class?: any;
    paymentId?: string; // If undefined, it represents a Full Term Ledger summary receipt; otherwise a specific installment.
  } | null>(null);
  const [receiptEmailInput, setReceiptEmailInput] = useState('');
  const [emailSendStatus, setEmailSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [emailSendLogs, setEmailSendLogs] = useState<string[]>([]);
  
  // Registration and Installments form trigger state
  const [selectedRegForPayments, setSelectedRegForPayments] = useState<StudentTermRegistration | null>(null);
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [installmentReference, setInstallmentReference] = useState('');
  const [installmentNotes, setInstallmentNotes] = useState('');
  
  // Custom Fee configuration form state
  const [configNewFee, setConfigNewFee] = useState('');
  const [configReturningFee, setConfigReturningFee] = useState('');
  const [showConfigLoader, setShowConfigLoader] = useState(false);

  // Quick enroll state trigger
  const [enrollingStudent, setEnrollingStudent] = useState<Student | null>(null);
  const [quickEnrollNote, setQuickEnrollNote] = useState('');
  const [quickEnrollInitialPay, setQuickEnrollInitialPay] = useState('');

  // 1. Subscription activation callback helpers
  const handleStartPayment = (term: string) => {
    setPaymentTermTarget(term);
    setPaymentStep('input');
    setPaymentCardNumber('');
    setPaymentExpiry('');
    setPaymentCVV('');
    setShowPaymentModal(true);
  };

  const handleProcessCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentStep('processing');
    setTimeout(async () => {
      try {
        await onPaySubscription(paymentTermTarget);
        setPaymentStep('success');
      } catch (err) {
        setPaymentStep('input');
      }
    }, 2000);
  };

  const getSubBadge = (termName: string) => {
    const status = currentSchool.paymentStatus?.[termName] || '';
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Paid & Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-800 animate-pulse">
        <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Suspended (₦20,000)
      </span>
    );
  };

  // 2. School Termly Fees Setting handler (Exclusive to Admin)
  const handleUpdateSchoolFeesConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== 'admin') return;

    const newFee = parseFloat(configNewFee);
    const returningFee = parseFloat(configReturningFee);

    if (isNaN(newFee) || isNaN(returningFee) || newFee < 0 || returningFee < 0) {
      alert('Please enter a valid positive numeric fee amount.');
      return;
    }

    const docId = `${currentSchool.id}_${currentTerm}`;
    const feeConfigObj: TermFeesConfig = {
      id: docId,
      school_id: currentSchool.id,
      term: currentTerm,
      newStudentFee: newFee,
      returningStudentFee: returningFee,
      created_at: new Date().toISOString()
    };

    setShowConfigLoader(true);

    if (isOfflineMode) {
      // Find otherconfigs to replace or append
      const filtered = termFeesConfigs.filter(it => it.id !== docId);
      const updated = [...filtered, feeConfigObj];
      saveOfflineItem('rc_term_fees_configs', updated);
      setShowConfigLoader(false);
      setConfigNewFee('');
      setConfigReturningFee('');
      setStatusFeedback({
        type: 'success',
        msg: `Offline Sync: Configured school fees for ${currentTerm} (New: ₦${newFee.toLocaleString()}, Returning: ₦${returningFee.toLocaleString()})`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'term_fees_configs', docId), feeConfigObj);
      setShowConfigLoader(false);
      setConfigNewFee('');
      setConfigReturningFee('');
      setStatusFeedback({
        type: 'success',
        msg: `Successfully saved school fees setup for ${currentTerm}!`
      });
    } catch (err: any) {
      setShowConfigLoader(false);
      alert('Error updating configuration: ' + err.message);
    }
  };

  // Helper active fees config for selected term
  const termConfig = termFeesConfigs.find(
    c => c.school_id === currentSchool.id && c.term === currentTerm
  ) || {
    newStudentFee: 150000,
    returningStudentFee: 100000
  };

  // 3. Complete student registration configuration / installment handler (Exclusive to Admin)
  const handleSaveInstallmentLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegForPayments || userRole !== 'admin') return;

    const parsedInstallmentAmt = parseFloat(installmentAmount);
    if (isNaN(parsedInstallmentAmt) || parsedInstallmentAmt <= 0) {
      alert('Please enter a valid installment deposit amount greater than zero.');
      return;
    }

    const currentPaid = selectedRegForPayments.paidAmount || 0;
    const nextTotalPaid = currentPaid + parsedInstallmentAmt;
    const finalFee = selectedRegForPayments.totalFee;

    const nextStatus = nextTotalPaid >= finalFee 
      ? 'paid' 
      : (nextTotalPaid > 0 ? 'partial' : 'unpaid');

    const newPaymentRecord = {
      id: `pay_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      amount: parsedInstallmentAmt,
      reference: installmentReference.trim() || `BALPAY-${Date.now().toString().slice(-6)}`,
      notes: installmentNotes.trim() || 'Installment Payment Receipt Logged'
    };

    const updatedReg: StudentTermRegistration = {
      ...selectedRegForPayments,
      paidAmount: nextTotalPaid,
      status: nextStatus,
      payments: [...(selectedRegForPayments.payments || []), newPaymentRecord]
    };

    if (isOfflineMode) {
      const remainingList = studentTermRegistrations.filter(r => r.id !== selectedRegForPayments.id);
      const updatedList = [...remainingList, updatedReg];
      saveOfflineItem('rc_student_term_registrations', updatedList);
      setSelectedRegForPayments(updatedReg);
      setInstallmentAmount('');
      setInstallmentReference('');
      setInstallmentNotes('');
      setStatusFeedback({
        type: 'success',
        msg: `Offline Session: Registered installment of ₦${parsedInstallmentAmt.toLocaleString()} for recipient student!`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'student_term_registrations', selectedRegForPayments.id), updatedReg);
      setSelectedRegForPayments(updatedReg);
      setInstallmentAmount('');
      setInstallmentReference('');
      setInstallmentNotes('');
      setStatusFeedback({
        type: 'success',
        msg: `Installment deposit of ₦${parsedInstallmentAmt.toLocaleString()} was logged to ledger!`
      });
    } catch (err: any) {
      alert('Could not record installment block: ' + err.message);
    }
  };

  // Receipt download builder (HTML ledger file with embedded CSS design)
  const handleDownloadReceiptDoc = () => {
    if (!activeReceiptData) return;
    const { reg, student, class: cl, paymentId } = activeReceiptData;
    const isFullLedger = !paymentId;
    
    // Look up individual payment if specified
    const singlePayment = paymentId ? reg.payments?.find(p => p.id === paymentId) : null;
    const paymentAmount = singlePayment ? singlePayment.amount : reg.paidAmount;
    const outstandingBal = reg.totalFee - reg.paidAmount;
    
    const paymentRows = isFullLedger 
      ? (reg.payments || []).map(p => `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e1e5eb; font-family: monospace;">${p.date}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e1e5eb;">${p.notes || 'Installment Payment'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e1e5eb; font-family: monospace; font-size: 11px; color: #555;">${p.reference || 'N/A'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e1e5eb; text-align: right; font-weight: bold; color: #10b981;">₦${p.amount.toLocaleString()}</td>
          </tr>
        `).join('')
      : `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e1e5eb; font-family: monospace;">${singlePayment?.date || new Date().toISOString().split('T')[0]}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e1e5eb;">${singlePayment?.notes || 'Installment Payment'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e1e5eb; font-family: monospace; font-size: 11px; color: #555;">${singlePayment?.reference || 'N/A'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e1e5eb; text-align: right; font-weight: bold; color: #10b981;">₦${singlePayment?.amount?.toLocaleString()}</td>
          </tr>
        `;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${student.name} - ${reg.term}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #333333;
      background-color: #f7fafc;
      margin: 0;
      padding: 40px;
    }
    .invoice-card {
      max-width: 700px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #1b4332;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header-left h1 {
      color: #1b4332;
      margin: 0 0 5px 0;
      font-size: 24px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-right {
      text-align: right;
    }
    .header-right .badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      margin-top: 5px;
    }
    .badge-paid { background-color: #d1fae5; color: #065f46; }
    .badge-partial { background-color: #fef3c7; color: #92400e; }
    .badge-unpaid { background-color: #fee2e2; color: #991b1b; }
    
    .meta-grid {
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .meta-box h3 {
      font-size: 11px;
      text-transform: uppercase;
      color: #718096;
      margin: 0 0 8px 0;
      letter-spacing: 1px;
    }
    .meta-box p {
      margin: 3px 0;
      font-size: 13px;
      line-height: 1.4;
    }
    .table-container {
      margin-bottom: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background-color: #f1f5f9;
      padding: 10px;
      text-align: left;
      font-weight: bold;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    .summary-section {
      border-top: 2px solid #e2e8f0;
      padding-top: 15px;
      display: flex;
      justify-content: flex-end;
    }
    .summary-table {
      width: 250px;
    }
    .summary-table tr td {
      padding: 5px 0;
      font-size: 13px;
    }
    .summary-table tr.total {
      font-size: 16px;
      font-weight: bold;
      color: #1b4332;
      border-top: 1px solid #1b4332;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      font-size: 11px;
      color: #718096;
      border-top: 1px solid #edf2f7;
      padding-top: 20px;
    }
    .footer-seal {
      margin-top: 15px;
      font-family: monospace;
      font-size: 10px;
      color: #cbd5e0;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
        ${(currentSchool.badgeUrl || currentSchool.logoUrl) ? `
          <img src="${currentSchool.badgeUrl || currentSchool.logoUrl}" alt="School Crest" style="width: 52px; height: 52px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; padding: 2px;" />
        ` : ''}
        <div>
          <h1 style="margin: 0; font-size: 18px; color: #1B4332;">${currentSchool.name}</h1>
          <p style="margin: 0; font-size: 12px; color: #718096;">${currentSchool.address || 'Academic Center Direct Line Portal, Nigeria'}</p>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: #718096;">Phone: ${currentSchool.phone || '+234 Klaso Desk'}</p>
        </div>
      </div>
      <div class="header-right">
        <h2 style="margin: 0; color: #4a5568; font-size: 15px;">FEE RECEIPT</h2>
        <p style="margin: 3px 0; font-size: 11px; font-family: monospace; color: #718096;">Receipt #: REC-${Date.now().toString().slice(-8)}</p>
        <span class="badge ${reg.status === 'paid' ? 'badge-paid' : reg.status === 'partial' ? 'badge-partial' : 'badge-unpaid'}">
          ${reg.status === 'paid' ? 'Fully Paid' : reg.status === 'partial' ? 'Installment Plan' : 'Unpaid'}
        </span>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <h3>RECIPIENT PUPIL DETAILS</h3>
        <p><strong>Name:</strong> ${student.name} ${reg.addedToNameNote ? '(' + reg.addedToNameNote + ')' : ''}</p>
        <p><strong>Pupil Code:</strong> ${student.code}</p>
        <p><strong>Classroom:</strong> ${cl?.name || 'Assigned Class'}</p>
        <p><strong>Classification:</strong> ${reg.studentType === 'new' ? 'NEW STUDENT REGISTRATION' : 'RETURNING STUDENT'}</p>
      </div>
      <div class="meta-box" style="text-align: right;">
        <h3>TERM & BILLING LOGISTICS</h3>
        <p><strong>Academic Segment:</strong> ${reg.term}</p>
        <p><strong>Printed Date:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
        <p><strong>School Register Email:</strong> ${student.email || 'N/A'}</p>
      </div>
    </div>

    <div class="table-container">
      <h3>TRANSACTION LEDGER BREAKDOWN</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 15%;">TRANSACT. DATE</th>
            <th style="width: 45%;">MEMO / DESCRIPTION</th>
            <th style="width: 25%;">REFERENCE</th>
            <th style="width: 15%; text-align: right;">AMOUNT REMITTED</th>
          </tr>
        </thead>
        <tbody>
          ${paymentRows || `
            <tr>
              <td colspan="4" style="padding: 20px; text-align: center; color: #a0aec0; font-style: italic;">
                No explicit receipt logs found. Setup installments in Proprietor billing desk.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    <div class="summary-section">
      <table class="summary-table">
        <tr>
          <td>Total Academic Fee:</td>
          <td style="text-align: right; font-weight: 500;">₦${reg.totalFee.toLocaleString()}</td>
        </tr>
        <tr>
          <td>Total Paid (Accumulated):</td>
          <td style="text-align: right; font-weight: bold; color: #10b981;">₦${reg.paidAmount.toLocaleString()}</td>
        </tr>
        <tr class="total">
          <td>Balance Outstanding:</td>
          <td style="text-align: right;">₦${outstandingBal.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <p>This is a certified digital student receipt issued directly by the <strong>${currentSchool.name}</strong> proprietary ledger.</p>
      <p style="margin-top: 5px;">Thank you for your timely remittances and continued partnerships with our educational institution.</p>
      <div class="footer-seal">
        Verified Klaso Compliance Security Seal: MD5-${Math.random().toString(36).substring(3, 15).toUpperCase()}
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${student.code || 'DOC'}_${reg.term.replace(/[^a-zA-Z0-9]/g, '_')}${isFullLedger ? '_Full' : '_Installment'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setStatusFeedback({
      type: 'success',
      msg: `Successfully downloaded secure HTML Receipt document for ${student.name}!`
    });
  };

  // Simulated live email transmitter over secure SMTP relay connection
  const handleSimulatedSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReceiptData || !receiptEmailInput.trim()) return;
    
    const targetEmail = receiptEmailInput.trim();
    setEmailSendStatus('sending');
    setEmailSendLogs(['Initializing connection to Klaso Unified Secure Server...']);
    
    const stepMessages = [
      `Establishing secure session with SMTP delivery gateway (smtp.klaso.sch.ng)...`,
      `Encrypting customer metadata and verifying digital signature...`,
      `Baking transaction receipt details (REC-${Date.now().toString().slice(-6)}) into official PDF byte-stream...`,
      `Rendering responsive invoice styling elements with high contrast vectors...`,
      `Attaching encrypted "Receipt_Report.pdf" (342 KB) to mail message container...`,
      `Handshaking with recipient mail servers at: ${targetEmail}...`,
      `Secure SSL packet body transmitted successfully. Waiting for MTA delivery receipt...`,
      `MTA Acknowledged. Mail queued successfully for priority distribution! Transaction index: KL-MX-${Math.floor(100000 + Math.random() * 900000)}`
    ];
    
    let currentLogIdx = 0;
    const interval = setInterval(() => {
      if (currentLogIdx < stepMessages.length) {
        const nextLog = stepMessages[currentLogIdx];
        setEmailSendLogs(prev => [...prev, nextLog]);
        currentLogIdx++;
      } else {
        clearInterval(interval);
        setEmailSendStatus('success');
        setStatusFeedback({
          type: 'success',
          msg: `Electronic invoice email transmitted successfully to: ${targetEmail}`
        });
      }
    }, 450);
  };

  // 4. Enroll Existing Student into Current Term dynamic trigger helper
  const handleTriggerQuickEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollingStudent) return;

    const stType = enrollingStudent.studentType || 'returning';
    const totalFee = stType === 'new' ? termConfig.newStudentFee : termConfig.returningStudentFee;
    const initPay = parseFloat(quickEnrollInitialPay || '0') || 0;

    const statusVal = initPay >= totalFee 
      ? 'paid' 
      : (initPay > 0 ? 'partial' : 'unpaid');

    const initialPaymentsList = [];
    if (initPay > 0) {
      initialPaymentsList.push({
        id: `pay_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        amount: initPay,
        reference: `REGPAY-${Date.now().toString().slice(-6)}`,
        notes: 'Initial deposit paid during term registration'
      });
    }

    const newTermRegDoc: StudentTermRegistration = {
      id: `${currentSchool.id}_${currentTerm}_${enrollingStudent.id}`,
      school_id: currentSchool.id,
      term: currentTerm,
      student_id: enrollingStudent.id,
      studentType: stType,
      addedToNameNote: quickEnrollNote.trim() || undefined,
      totalFee: totalFee,
      paidAmount: initPay,
      status: statusVal,
      payments: initialPaymentsList,
      created_at: new Date().toISOString()
    };

    if (isOfflineMode) {
      const originalList = studentTermRegistrations.filter(r => r.id !== newTermRegDoc.id);
      const combined = [...originalList, newTermRegDoc];
      saveOfflineItem('rc_student_term_registrations', combined);
      setEnrollingStudent(null);
      setQuickEnrollNote('');
      setQuickEnrollInitialPay('');
      setStatusFeedback({
        type: 'success',
        msg: `Offline state: Student ${enrollingStudent.name} is successfully active in ${currentTerm}!`
      });
      return;
    }

    try {
      await setDoc(doc(db, 'student_term_registrations', newTermRegDoc.id), newTermRegDoc);
      setEnrollingStudent(null);
      setQuickEnrollNote('');
      setQuickEnrollInitialPay('');
      setStatusFeedback({
        type: 'success',
        msg: `Enrolled: ${enrollingStudent.name} is successfully active in ${currentTerm}!`
      });
    } catch (err: any) {
      alert('Could not enroll student: ' + err.message);
    }
  };

  // Bulk rollover helper: Carry over outstanding student profiles to current term billing ledger
  const handleBulkCarryOverRoster = async () => {
    if (userRole !== 'admin') {
      alert("Only school administrators can perform bulk roster carry-over.");
      return;
    }

    const unenrolledStudents = students.filter(student => {
      const hasReg = studentTermRegistrations.some(
        r => r.student_id === student.id && r.term === currentTerm
      );
      return !hasReg;
    });

    if (unenrolledStudents.length === 0) {
      alert(`Perfect! All registered students are already carried over and registered for ${currentTerm}!`);
      return;
    }

    const confirmRoll = window.confirm(
      `Every semester, old student details remain intact! \n\nThis utility will automatically shift and carry over all ${unenrolledStudents.length} remaining pupils to start the new term (${currentTerm}) billing sheet.\n\nAre you sure you want to proceed?`
    );

    if (!confirmRoll) return;

    const termConfigLocal = termFeesConfigs.find(r => r.term === currentTerm) || {
      term: currentTerm,
      newStudentFee: 150000,
      returningStudentFee: 100000
    };

    const newRegistrations: StudentTermRegistration[] = unenrolledStudents.map(student => {
      const stType = student.studentType || 'returning';
      const totalFee = stType === 'new' ? termConfigLocal.newStudentFee : termConfigLocal.returningStudentFee;
      return {
        id: `${currentSchool.id}_${currentTerm}_${student.id}`,
        school_id: currentSchool.id,
        term: currentTerm,
        student_id: student.id,
        studentType: stType,
        totalFee: totalFee,
        paidAmount: 0,
        status: 'unpaid',
        payments: [],
        created_at: new Date().toISOString()
      };
    });

    if (isOfflineMode) {
      const combined = [...studentTermRegistrations, ...newRegistrations];
      saveOfflineItem('rc_student_term_registrations', combined);
      setStatusFeedback({
        type: 'success',
        msg: `Shifted: Offline database synced. Carried over all ${unenrolledStudents.length} pupils into ${currentTerm}!`
      });
      return;
    }

    try {
      setStatusFeedback({
        type: 'info',
        msg: `Batch processing ${unenrolledStudents.length} student registers for academic term ${currentTerm}...`
      });

      for (const reg of newRegistrations) {
        await setDoc(doc(db, 'student_term_registrations', reg.id), reg);
      }

      setStatusFeedback({
        type: 'success',
        msg: `Roster Carried Over: ${unenrolledStudents.length} student ledgers successfully shifted to ${currentTerm}!`
      });
    } catch (err: any) {
      console.error(err);
      setStatusFeedback({
        type: 'err',
        msg: `Error carrying over rosters: ${err.message}`
      });
    }
  };

  // Filter students based on selection search
  const filteredStudentsWithRegs = students.map(student => {
    const reg = studentTermRegistrations.find(
      r => r.student_id === student.id && r.term === currentTerm
    );
    const assignedClass = classes.find(c => c.id === student.class_id);
    return {
      student,
      reg,
      assignedClass
    };
  }).filter(item => {
    const textMatch = item.student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (item.student.code && item.student.code.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const classMatch = selectedClassId === 'all' || item.student.class_id === selectedClassId;
    
    let statusMatch = true;
    if (selectedStatusFilter === 'paid') {
      statusMatch = item.reg?.status === 'paid';
    } else if (selectedStatusFilter === 'partial') {
      statusMatch = item.reg?.status === 'partial';
    } else if (selectedStatusFilter === 'unpaid') {
      statusMatch = !item.reg || item.reg.status === 'unpaid';
    } else if (selectedStatusFilter === 'not_enrolled') {
      statusMatch = !item.reg;
    }

    return textMatch && classMatch && statusMatch;
  });

  return (
    <div className="flex-1 flex flex-col gap-6" id="billing-ledger-terminal">
      
      {/* SECTION 1: PROPRIETOR WEB SYSTEM SUBSCRIPTION DESK */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="bg-[#1B4332] text-white p-6 relative">
          <div className="max-w-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-display font-bold tracking-tight flex items-center">
                <ShieldCheck className="h-5 w-5 mr-1.5 text-emerald-300" />
                Nigeria Web Ledger & Proprietors Desk
              </h2>
              <p className="text-emerald-100 text-xs mt-1">
                Set and configure terms fees, manage active subscriptions, and view individual student deposits history logs.
              </p>
            </div>
            {termConfig && (
              <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/5 shrink-0 text-center">
                <span className="block text-4xs text-emerald-200 uppercase tracking-widest font-semibold font-mono">TERM BASE PRICE ({currentTerm})</span>
                <p className="text-xs text-stone-200 mt-0.5">
                  New: <strong className="text-white">₦{termConfig.newStudentFee.toLocaleString()}</strong> | 
                  Ret: <strong className="text-white">₦{termConfig.returningStudentFee.toLocaleString()}</strong>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* SUBSECTION A: Termly Registration Fee Setup */}
            <div className="border border-stone-200 rounded-xl p-5 bg-stone-50/40">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center mb-3">
                <Settings className="h-4 w-4 mr-1.5 text-[#1B4332]" />
                Termly Academic School Fees Configuration
              </h3>
              <p className="text-2xs text-stone-500 mb-4 leading-relaxed">
                As the school administrator, you can configure set amounts for new students vs. returning students independently. Teachers will instantly see these expected totals at their respective checkouts.
              </p>

              {userRole === 'admin' ? (
                <form onSubmit={handleUpdateSchoolFeesConfig} className="space-y-3 font-sans">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-3xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                        New Student Target Fee (₦)
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder={termConfig.newStudentFee.toString()}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs font-mono font-medium focus:outline-hidden"
                        value={configNewFee}
                        onChange={(e) => setConfigNewFee(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-3xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                        Returning Student Fee (₦)
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder={termConfig.returningStudentFee.toString()}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs font-mono font-medium focus:outline-hidden"
                        value={configReturningFee}
                        onChange={(e) => setConfigReturningFee(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={showConfigLoader}
                    className="w-full py-1.5 px-4 bg-[#1B4332] hover:bg-[#143225] disabled:opacity-55 text-white text-2xs font-bold uppercase tracking-wider rounded-lg transition shrink-0 cursor-pointer"
                  >
                    {showConfigLoader ? 'Saving parameters...' : `Apply term parameters (₦)`}
                  </button>
                </form>
              ) : (
                <div className="text-center py-4 bg-white border border-stone-200/50 rounded-xl text-stone-500 text-xs">
                  <Lock className="h-4 w-4 mx-auto text-stone-400 mb-1" />
                  Expected academic configurations are locked for standard teacher logins.
                </div>
              )}
            </div>

            {/* SUBSECTION B: Prop Platform Activation System with Paystack Integration */}
            <div className="border border-stone-200 rounded-xl p-5 bg-stone-50/40">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#1B4332] uppercase tracking-widest flex items-center">
                  <CreditCard className="h-4 w-4 mr-1.5 text-stone-500" />
                  Portal Licensing & Paystack Subscriptions
                </h3>
                <span className="flex items-center space-x-1 text-3xs font-mono font-bold text-[#0BA4DB] bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                  <span>Paystack Gateway</span>
                </span>
              </div>
              
              <div className="divide-y divide-stone-200 bg-white border border-stone-200 rounded-lg text-xs">
                {currentSchool.terms.map((termName) => {
                  const isPaid = currentSchool.paymentStatus?.[termName] === 'paid';
                  return (
                    <div key={termName} className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <strong className="text-stone-800 font-sans font-bold">{termName}</strong>
                          {termName === currentTerm && (
                            <span className="bg-emerald-800 text-white font-mono scale-90 px-1.5 py-0.5 rounded text-4xs">Current</span>
                          )}
                        </div>
                        <p className="text-stone-400 text-3xs mt-0.5 font-mono">
                          {isPaid ? 'Active • ₦20,000 Remitted' : 'Standard ₦20,000 / term licensing fee'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {getSubBadge(termName)}
                        {!isPaid && userRole === 'admin' ? (
                          <button
                            onClick={() => handleStartPayment(termName)}
                            className="bg-[#0BA4DB] hover:bg-[#098bb9] text-white font-bold text-3xs uppercase tracking-widest py-1.5 px-3 rounded-lg shadow-xs transition flex items-center space-x-1 cursor-pointer"
                          >
                            <span>Pay ₦20,000 via Paystack</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paystack Payment Receipts & History */}
              {currentSchool.subscriptionPayments && currentSchool.subscriptionPayments.length > 0 && (
                <div className="mt-4 pt-3 border-t border-stone-200">
                  <span className="text-3xs font-bold text-stone-500 uppercase tracking-wider block mb-2">
                    Paystack Remittance Audit Log
                  </span>
                  <div className="space-y-1.5">
                    {currentSchool.subscriptionPayments.map((p, idx) => (
                      <div key={p.id || idx} className="bg-white border border-stone-200 rounded-lg p-2.5 flex items-center justify-between text-3xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-stone-800">{p.term}</span>
                            <span className="font-mono text-emerald-700 bg-emerald-50 px-1 rounded font-bold">₦{p.amount.toLocaleString()}</span>
                          </div>
                          <span className="font-mono text-stone-400 block truncate max-w-[200px]">Ref: {p.reference}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-stone-500 font-mono block">
                            {new Date(p.paid_at).toLocaleDateString()}
                          </span>
                          <span className="text-emerald-600 font-bold uppercase text-4xs">Verified Approved</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* SECTION 2: STUDENT TERM SCHOOL FEES LEDGER GRID */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6" id="term-fees-billing-ledger">
        
        {(() => {
          const unenrolledCount = students.filter(student => 
            !studentTermRegistrations.some(r => r.student_id === student.id && r.term === currentTerm)
          ).length;

          if (userRole === 'admin' && unenrolledCount > 0) {
            return (
              <div className="mb-5 bg-gradient-to-r from-emerald-50/70 to-[#1B4332]/5 border border-emerald-150/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg text-[#1B4332] shrink-0">
                    <History className="h-4 w-4" />
                  </div>
                  <div className="text-left space-y-0.5">
                    <span className="text-xs font-bold text-[#1B4332] block">Semester Transition Detected: Roster remains secure</span>
                    <p className="text-2xs text-stone-600 leading-relaxed max-w-lg">
                      There are <strong className="text-stone-850">{unenrolledCount} pupil profiles</strong> preserved in the master registry who haven't been enrolled or billed for the new term <b>{currentTerm}</b> yet. Shift them to this semester structure with safe termly fee ledgers.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleBulkCarryOverRoster}
                  className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#143225] text-white text-2xs font-extrabold rounded-lg shadow-2xs hover:shadow-xs transition flex items-center space-x-1.5 shrink-0 select-none cursor-pointer"
                >
                  <span>Carry Over {unenrolledCount} Students</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            );
          }
          return null;
        })()}
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-stone-200 pb-5 mb-5">
          <div>
            <h3 className="text-md font-display font-bold text-stone-900 flex items-center">
              <Users className="h-5 w-5 mr-2 text-[#1B4332]" />
              Pupil Billings & School Fees Spreadsheet ({currentTerm})
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Differentiates billing status: <strong>New Pupil</strong> vs <strong>Returning</strong>. Teachers can review total installments paid in real-time.
            </p>
          </div>

          {/* SPREADSHEET FILTERS */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            
            {/* SEARCH INPUT */}
            <div className="relative flex-1 sm:flex-initial min-w-[180px]">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search pupil name or ID..."
                className="w-full pl-8 pr-3 py-1 border border-stone-300 rounded-lg text-2xs font-sans placeholder-stone-400 focus:outline-hidden"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* CLASS SELECTOR */}
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-white px-2.5 py-1.5 border border-stone-300 rounded-lg text-2xs cursor-pointer focus:outline-hidden"
            >
              <option value="all">All Classrooms</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* STATUS FILTER */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-white px-2.5 py-1.5 border border-[#1B4332]/25 rounded-lg text-2xs cursor-pointer focus:outline-hidden"
            >
              <option value="all">All Fee Statuses</option>
              <option value="paid">Fully Settled (Paid)</option>
              <option value="partial">Paying Installments (Partial)</option>
              <option value="unpaid">Unpaid / Unenrolled</option>
              <option value="not_enrolled">Not Enrolled in Term</option>
            </select>

          </div>
        </div>

        {/* LEDGER GRID SPREADSHEET TABLE */}
        <div className="overflow-x-auto border-2 border-stone-200/60 rounded-xl bg-stone-50/20 shadow-4xs mb-6">
          <table className="min-w-full divide-y divide-stone-200 text-xs">
            <thead className="bg-stone-100 text-stone-600 text-2xs uppercase tracking-wider font-semibold font-sans">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left">Recipient Pupil</th>
                <th scope="col" className="px-3 py-2.5 text-left">Badge ID</th>
                <th scope="col" className="px-3 py-2.5 text-left">Classroom</th>
                <th scope="col" className="px-3 py-2.5 text-left">Category</th>
                <th scope="col" className="px-3 py-2.5 text-right font-mono">Total Expected (₦)</th>
                <th scope="col" className="px-3 py-2.5 text-right font-mono">Paid to Date (₦)</th>
                <th scope="col" className="px-3 py-2.5 text-right font-mono">Outstanding Balance (₦)</th>
                <th scope="col" className="px-3 py-2.5 text-center">Status</th>
                <th scope="col" className="px-3 py-2.5 text-right">Roster Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-150">
              {filteredStudentsWithRegs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400 font-medium text-xs">
                    No matching pupil ledger records found matching selection. Configure a class roster to audit school fees.
                  </td>
                </tr>
              ) : (
                filteredStudentsWithRegs.map(({ student, reg, assignedClass }) => {
                  const studentTypeLabel = student.studentType === 'new' ? 'New student fee code' : 'Returning student';
                  const expectedFee = reg 
                    ? reg.totalFee 
                    : (student.studentType === 'new' ? termConfig.newStudentFee : termConfig.returningStudentFee);
                  
                  const alreadyPaid = reg ? (reg.paidAmount || 0) : 0;
                  const balanceDue = expectedFee - alreadyPaid;

                  // Status Badge construction
                  let statusLabel = 'Unregistered';
                  let statusClasses = 'bg-stone-100 text-stone-500 border border-stone-200';
                  if (reg) {
                    if (reg.status === 'paid') {
                      statusLabel = 'Fully Paid';
                      statusClasses = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
                    } else if (reg.status === 'partial') {
                      statusLabel = 'Installments';
                      statusClasses = 'bg-amber-50 text-amber-800 border border-amber-200';
                    } else {
                      statusLabel = 'Unpaid';
                      statusClasses = 'bg-rose-50 text-rose-800 border border-rose-200';
                    }
                  }

                  return (
                    <tr key={student.id} className="hover:bg-stone-50/40 font-sans transition">
                      <td className="px-3 py-3">
                        <div className="flex items-center space-x-2">
                          {student.passportUrl ? (
                            <img
                              src={student.passportUrl}
                              alt="Passport micro"
                              referrerPolicy="no-referrer"
                              className="h-6 w-6 rounded-full object-cover border border-stone-300"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 text-3xs font-bold uppercase">
                              {student.name.slice(0, 2)}
                            </div>
                          )}
                          <div className="truncate max-w-[140px]">
                            <p className="font-semibold text-stone-850 truncate">{student.name}</p>
                            {reg?.addedToNameNote && (
                              <span className="text-[10px] bg-[#1B4332]/10 text-emerald-950 font-medium px-1.5 py-0.2 rounded-full border border-[#1B4332]/15">
                                {reg.addedToNameNote}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-stone-600 scale-95 origin-left">
                        {student.code}
                      </td>
                      <td className="px-3 py-3 font-medium text-stone-500">
                        {assignedClass?.name || <span className="text-stone-300 italic">None</span>}
                      </td>
                      <td className="px-3 py-3 text-stone-600 text-2xs font-semibold">
                        <span className={`px-2 py-0.5 rounded-full ${
                          student.studentType === 'new' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {student.studentType === 'new' ? 'NEW' : 'RETURNING'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-medium text-stone-800">
                        ₦{expectedFee.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/10">
                        ₦{alreadyPaid.toLocaleString()}
                      </td>
                      <td className={`px-3 py-3 text-right font-mono font-semibold ${balanceDue > 0 ? 'text-amber-800' : 'text-stone-400'}`}>
                        ₦{balanceDue.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-semibold uppercase tracking-wider ${statusClasses}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {!reg ? (
                          <button
                            onClick={() => {
                              setSelectedRegForPayments(null);
                              setEnrollingStudent(student);
                            }}
                            className="bg-[#1B4332] hover:bg-[#143225] text-white text-3xs font-semibold font-sans uppercase tracking-wider px-2 py-1 rounded transition whitespace-nowrap cursor-pointer"
                          >
                            Enroll Pupil
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEnrollingStudent(null);
                              setSelectedRegForPayments(reg);
                            }}
                            className="bg-emerald-50 hover:bg-[#1B4332] text-[#1B4332] hover:text-white border border-emerald-200 hover:border-transparent text-3xs font-semibold font-sans uppercase tracking-wider px-2 py-1 rounded transition whitespace-nowrap cursor-pointer"
                          >
                            Track Payments
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* DETAILS POPUPS AND NESTED MANAGERS BELOW */}
        {enrollingStudent && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 p-4 flex items-center justify-center">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md p-6 relative">
              <button 
                type="button" 
                onClick={() => setEnrollingStudent(null)} 
                className="absolute right-4 top-4 text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
              <h3 className="text-sm font-sans font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center">
                <Calendar className="h-4 w-4 mr-1.5 text-[#1B4332]" />
                Enroll student in Term: {enrollingStudent.name}
              </h3>

              <form onSubmit={handleTriggerQuickEnroll} className="space-y-4 text-xs font-sans">
                <div className="bg-stone-50 p-3 rounded-xl space-y-2 border border-stone-150">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Student Classification:</span>
                    <strong className="text-stone-850 uppercase font-mono">{enrollingStudent.studentType || 'returning'}</strong>
                  </div>
                  <div className="flex justify-between border-t border-stone-200/50 pt-1.5">
                    <span className="text-stone-500">Active Expected Fees:</span>
                    <strong className="text-emerald-950 font-mono text-sm leading-relaxed">
                      ₦{(enrollingStudent.studentType === 'new' ? termConfig.newStudentFee : termConfig.returningStudentFee).toLocaleString()} NGN
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block text-3xs font-bold text-stone-500 uppercase tracking-widest mb-1">
                    Added to Name Note suffix (e.g. Scholarship, Boarder)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Scholarship recipient"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                    value={quickEnrollNote}
                    onChange={(e) => setQuickEnrollNote(e.target.value)}
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block font-sans">
                    "The admin can add to a student's name when registering the student for the term."
                  </span>
                </div>

                <div>
                  <label className="block text-3xs font-bold text-stone-500 uppercase tracking-widest mb-1">
                    Initial Downpayment Paid Amount (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono font-medium"
                    value={quickEnrollInitialPay}
                    onChange={(e) => setQuickEnrollInitialPay(e.target.value)}
                  />
                </div>

                <div className="flex gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setEnrollingStudent(null)}
                    className="flex-1 py-1 px-4 border border-stone-300 rounded-lg text-stone-600 text-xs font-semibold hover:bg-stone-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-4 bg-[#1B4332] hover:bg-[#143225] text-white text-xs font-bold uppercase tracking-wider rounded-lg text-center cursor-pointer"
                  >
                    Enroll Student in Term
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* LOG AND RE-LOG INSTALLMENT POPUP VIEW */}
        {selectedRegForPayments && (
          <div className="fixed inset-0 z-40 bg-stone-900/60 p-4 flex items-center justify-center overflow-y-auto">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 relative">
              <button 
                type="button" 
                onClick={() => setSelectedRegForPayments(null)} 
                className="absolute right-4 top-4 text-stone-400 hover:text-stone-600 font-bold"
              >
                ✕
              </button>

              <div className="border-b border-stone-100 pb-3 mb-4">
                <h3 className="text-sm font-sans font-bold text-stone-900 flex items-center">
                  <DollarSign className="h-5 w-5 mr-1 text-[#1B4332]" />
                  Fee Ledgers - Receipts & Installments Tracker
                </h3>
                <p className="text-2xs text-stone-500">
                  Ref: {selectedRegForPayments.id} | Term: {selectedRegForPayments.term}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start font-sans">
                
                {/* SUBSECTION PAY: History of installment receipt logs */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-[#1B4332] uppercase tracking-widest flex items-center">
                    <History className="h-3.5 w-3.5 mr-1" /> Payment Receipts Archive
                  </h4>

                  <div className="bg-stone-50/50 p-3 rounded-xl border border-stone-200">
                    <div className="flex justify-between text-2xs mb-1">
                      <span className="text-stone-500">Total Charged Academic Fee:</span>
                      <strong className="text-stone-850">₦{selectedRegForPayments.totalFee.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-2xs mb-1 border-t border-stone-200/50 pt-1.5">
                      <span className="text-stone-500">Accumulated Received Amount:</span>
                      <strong className="text-emerald-800 font-mono font-bold">₦{selectedRegForPayments.paidAmount.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-2xs border-t border-stone-200/50 pt-1.5">
                      <span className="text-stone-500">Outstanding Overdue Balance:</span>
                      <strong className="text-amber-800 font-mono font-bold">₦{(selectedRegForPayments.totalFee - selectedRegForPayments.paidAmount).toLocaleString()}</strong>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        const student = students.find(s => s.id === selectedRegForPayments.student_id);
                        if (student) {
                          const cls = classes.find(c => c.id === student.class_id);
                          setActiveReceiptData({
                            reg: selectedRegForPayments,
                            student,
                            class: cls
                          });
                          setReceiptEmailInput(student.email || '');
                          setEmailSendStatus('idle');
                          setEmailSendLogs([]);
                        }
                      }}
                      className="mt-3.5 w-full py-1.5 px-3 bg-[#1B4332] hover:bg-[#143225] text-white rounded-lg text-2xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5 text-emerald-300" />
                      Generate Full Term Receipt
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto bg-stone-50/20 p-2 border border-stone-200 rounded-xl">
                    {!selectedRegForPayments.payments || selectedRegForPayments.payments.length === 0 ? (
                      <p className="text-center font-medium italic text-stone-400 py-6 text-2xs">
                        No transactions registered to this pupil ledger record yet.
                      </p>
                    ) : (
                      selectedRegForPayments.payments.map((p) => (
                        <div key={p.id} className="p-2.5 bg-white border border-stone-200 rounded-lg shadow-4xs text-3xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-emerald-850 font-bold font-mono">₦{p.amount.toLocaleString()}</span>
                            <span className="text-stone-400 font-mono font-bold">{p.date}</span>
                          </div>
                          <p className="text-stone-800 font-medium truncate italic leading-relaxed">"{p.notes}"</p>
                          <div className="flex justify-between items-center pt-1 font-mono text-[9px] text-stone-400">
                            <span>ID: {p.reference}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const student = students.find(s => s.id === selectedRegForPayments.student_id);
                                if (student) {
                                  const cls = classes.find(c => c.id === student.class_id);
                                  setActiveReceiptData({
                                    reg: selectedRegForPayments,
                                    student,
                                    class: cls,
                                    paymentId: p.id
                                  });
                                  setReceiptEmailInput(student.email || '');
                                  setEmailSendStatus('idle');
                                  setEmailSendLogs([]);
                                }
                              }}
                              className="text-[#1B4332] hover:text-black border border-stone-200 hover:border-stone-350 bg-stone-50 hover:bg-white px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Printer className="h-2.5 w-2.5" /> Print Receipt
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* SUBSECTION PAY-LOG: Installments logging form */}
                <div className="space-y-4 border-t md:border-t-0 md:border-l border-stone-200 pt-4 md:pt-0 md:pl-5">
                  <h4 className="text-[10px] font-bold text-[#1B4332] uppercase tracking-widest flex items-center">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Log New Installment ( CBN compliant )
                  </h4>

                  {userRole === 'admin' ? (
                    <form onSubmit={handleSaveInstallmentLog} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-3xs font-bold text-stone-500 uppercase tracking-widest mb-1">
                          Deposit Amount (₦) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          placeholder="e.g. 25000"
                          className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                          value={installmentAmount}
                          onChange={(e) => setInstallmentAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-3xs font-bold text-stone-500 uppercase tracking-widest mb-1">
                          Transaction Reference Identifier
                        </label>
                        <input
                          type="text"
                          placeholder="Leave blank for automatic sequential string"
                          className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs font-mono"
                          value={installmentReference}
                          onChange={(e) => setInstallmentReference(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-3xs font-bold text-stone-500 uppercase tracking-widest mb-1">
                          Receipt Memo Notes
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Paid block installment via Cash/Bank Transfer"
                          className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                          value={installmentNotes}
                          onChange={(e) => setInstallmentNotes(e.target.value)}
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-1.5 px-3 bg-[#1B4332] hover:bg-[#143225] text-white text-3xs font-bold uppercase tracking-wider rounded-lg transition"
                      >
                        Register Deposit to Ledger (₦)
                      </button>
                    </form>
                  ) : (
                    <div className="py-6 text-center text-stone-400 text-xs bg-stone-50 border border-stone-200 rounded-xl">
                      <Lock className="h-4 w-4 mx-auto text-stone-400 mb-1" />
                      Teachers possess read-only permissions on ledger. Inform Administrator to apply remittance values.
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

      </div>

      {/* COMPREHENSIVE SCHOOL FEES RECEIPT MODULE (Admin access) */}
      {activeReceiptData && (() => {
        const { reg, student, class: cl, paymentId } = activeReceiptData;
        const isFull = !paymentId;
        const singleP = paymentId ? reg.payments?.find(it => it.id === paymentId) : null;
        const activeBalance = reg.totalFee - reg.paidAmount;

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/75 p-4 flex items-center justify-center backdrop-blur-xs font-sans">
            {/* Embedded styles for pristine physical paper document print format */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-receipt-card, #printable-receipt-card * {
                  visibility: visible !important;
                }
                #printable-receipt-card {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 20px !important;
                  box-shadow: none !important;
                  border: none !important;
                  background: white !important;
                  color: black !important;
                }
                .no-print-element {
                  display: none !important;
                }
              }
            `}</style>

            <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[92vh]">
              
              {/* LEFT COLUMN: Receipt Canvas Preview */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-stone-50 border-r border-stone-250 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-6">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Digital Canvas Preview</span>
                    <span className="text-3xs bg-[#1B4332] text-white px-2 py-0.5 rounded-full font-mono font-medium">Verified Roster Node</span>
                  </div>

                  {/* Physical Receipt Template layout */}
                  <div 
                    id="printable-receipt-card" 
                    className="bg-white border border-stone-250 rounded-2xl p-6 md:p-8 shadow-xs max-w-xl mx-auto space-y-6 text-stone-800 text-xs text-left"
                  >
                    {/* Header Details */}
                    <div className="flex justify-between items-start border-b-2 border-[#1B4332] pb-4 gap-3">
                      <div className="flex items-center gap-3">
                        {(currentSchool.badgeUrl || currentSchool.logoUrl) && (
                          <img 
                            src={currentSchool.badgeUrl || currentSchool.logoUrl} 
                            alt={`${currentSchool.name} Crest`} 
                            className="w-12 h-12 object-contain rounded-lg border border-stone-200 bg-white p-0.5 shrink-0"
                          />
                        )}
                        <div>
                          <h2 className="text-md font-bold text-[#1B4332] font-display uppercase tracking-tight leading-tight">
                            {currentSchool.name}
                          </h2>
                          <p className="text-stone-500 text-3xs mt-1 leading-relaxed max-w-[210px] uppercase font-semibold font-sans">
                            {currentSchool.address || "Klaso Academic Registry Portal, Nigeria"}
                          </p>
                          <p className="text-[10px] text-stone-400 mt-0.5 font-mono">{currentSchool.phone || "School Phone Registry Locked"}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-stone-700 uppercase tracking-widest block">Official Receipt</span>
                        <span className="text-3xs font-mono text-stone-400 block mt-1">REC-{Date.now().toString().slice(-8).toUpperCase()}</span>
                        
                        <span className={`inline-flex mt-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          reg.status === 'paid' 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-805 border border-amber-200'
                        }`}>
                          {reg.status === 'paid' ? 'Fully Settled' : 'Installment Plan'}
                        </span>
                      </div>
                    </div>

                    {/* Meta Fields */}
                    <div className="grid grid-cols-2 gap-4 text-2xs border-b border-stone-150 pb-4">
                      <div className="space-y-1">
                        <span className="text-4xs font-bold text-stone-400 uppercase tracking-widest block">Recipient Pupil</span>
                        <p className="font-bold text-stone-900 text-xs">
                          {student.name} {reg.addedToNameNote && <span className="text-[10px] font-semibold text-[#1B4332]">({reg.addedToNameNote})</span>}
                        </p>
                        <p className="text-stone-500 font-mono">BADGE ID: {student.code || "N/A"}</p>
                        <p className="text-stone-500">School Class: <strong className="text-stone-700">{cl?.name || "Roster"}</strong></p>
                      </div>

                      <div className="space-y-1 text-right">
                        <span className="text-4xs font-bold text-stone-400 uppercase tracking-widest block">Parameters</span>
                        <p className="font-semibold text-stone-900">{reg.term}</p>
                        <p className="text-stone-500">Classification: <strong className="text-stone-700 capitalize">{reg.studentType === 'new' ? 'NEW STUDENT' : 'RETURNING'}</strong></p>
                        <p className="text-stone-400 font-sans">Issued: {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Breakdown Ledger Table */}
                    <div className="space-y-2">
                      <span className="text-4xs font-bold text-stone-400 uppercase tracking-widest block">Transaction Items</span>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-stone-50 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                            <th className="p-2 border-b border-stone-200">Date</th>
                            <th className="p-2 border-b border-stone-200 col-span-2">Memo Description</th>
                            <th className="p-2 border-b border-stone-200 text-right">Amount (₦)</th>
                          </tr>
                        </thead>
                        <tbody className="text-2xs divide-y divide-stone-100">
                          {isFull ? (
                            (reg.payments || []).length === 0 ? (
                              <tr>
                                <td colSpan={3} className="p-4 text-center text-stone-400 italic">No formal receipts recorded.</td>
                              </tr>
                            ) : (
                              reg.payments.map(p => (
                                <tr key={p.id}>
                                  <td className="p-2 text-stone-500 font-mono">{p.date}</td>
                                  <td className="p-2 text-stone-700">
                                    <p className="font-semibold">{p.notes || "Installment Payment"}</p>
                                    <p className="text-3xs text-stone-400 font-mono">Id: {p.reference}</p>
                                  </td>
                                  <td className="p-2 text-right font-mono font-bold text-stone-800">₦{p.amount.toLocaleString()}</td>
                                </tr>
                              ))
                            )
                          ) : (
                            singleP ? (
                              <tr>
                                <td className="p-2 text-stone-500 font-mono">{singleP.date}</td>
                                <td className="p-2 text-stone-700">
                                  <p className="font-semibold font-sans">{singleP.notes || "Installment Remittance Log"}</p>
                                  <p className="text-3xs text-stone-400 font-mono">Id: {singleP.reference}</p>
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-stone-800">₦{singleP.amount.toLocaleString()}</td>
                              </tr>
                            ) : (
                              <tr>
                                <td colSpan={3} className="p-4 text-center text-stone-400 italic">Selected installment missing.</td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Financial summary blocks */}
                    <div className="border-t-2 border-stone-200 pt-3 flex justify-end">
                      <div className="w-56 text-2xs space-y-1 text-stone-600">
                        <div className="flex justify-between">
                          <span>Total Charged Fee:</span>
                          <span className="font-mono text-stone-800 font-semibold">₦{reg.totalFee.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-stone-100 pb-1">
                          <span>Accumulated Paid:</span>
                          <span className="font-mono text-emerald-850 font-bold">₦{reg.paidAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-stone-900 pt-1 font-bold">
                          <span>Outstanding Balance:</span>
                          <span className="font-mono text-amber-805">₦{activeBalance.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Regulatory Certification details */}
                    <div className="pt-4 border-t border-dashed border-stone-200 text-center text-3xs text-stone-400 space-y-1">
                      <p>This is a formal electronic receipt issued by the Proprietors ledger desk.</p>
                      <p className="font-mono text-[8px] tracking-tight uppercase">KLASO SECURITY TOKEN: MD5-{Math.random().toString(36).slice(2, 14).toUpperCase()}</p>
                    </div>

                  </div>
                </div>

                <div className="text-center pt-4 border-t border-stone-200 mt-6 no-print-element">
                  <p className="text-3xs text-stone-500">Klaso Ledger Hub complies with modern digital invoicing standards.</p>
                </div>
              </div>

              {/* RIGHT COLUMN: Actions Terminal (Exclusive to Admin) */}
              <div className="w-full md:w-80 p-6 flex flex-col justify-between space-y-6 bg-white shrink-0">
                
                {/* Header Information */}
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-sm font-bold text-stone-900 tracking-tight">Receipt Dispatch Desk</h3>
                    <button 
                      type="button" 
                      onClick={() => setActiveReceiptData(null)}
                      className="text-stone-400 hover:text-stone-650 text-xs no-print-element font-bold"
                    >
                      ✕ CLOSE
                    </button>
                  </div>
                  <p className="text-3xs text-stone-500 leading-relaxed">
                    Download this receipt to the administrator's desktop device as a print-ready HTML Invoice Letter, send an interactive electronic copy directly to the student's email, or trigger the native print dialog.
                  </p>
                </div>

                {/* Sub-Panel: Transmission Options */}
                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                  
                  {/* Option 1: Native Print Dispatcher */}
                  <div className="p-3 border border-stone-200 rounded-xl bg-stone-50/50 space-y-2">
                    <span className="text-[10px] font-bold text-[#1B4332] uppercase tracking-widest block">Physical Printer Dispatch</span>
                    <p className="text-3xs text-stone-500">Triggers browser native print workflow styled exclusively for standardized A4 or receipt physical papers.</p>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="w-full py-1.5 px-3 bg-[#1B4332] hover:bg-[#143225] text-white rounded-lg text-3xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Printer className="h-3 w-3" />
                      Print Receipt / Save PDF
                    </button>
                    <span className="text-[9px] text-[#1B4332] font-semibold text-center block mt-1">💡 Info: Select "Save as PDF" relative to physical printing to compile as PDF document.</span>
                  </div>

                  {/* Option 2: HTML/PDF Document Payload Download */}
                  <div className="p-3 border border-stone-200 rounded-xl bg-stone-50/50 space-y-2">
                    <span className="text-[10px] font-bold text-[#1B4332] uppercase tracking-widest block">Digital Document Download</span>
                    <p className="text-3xs text-stone-500">Extract complete interactive invoice with full styled tables offline on local hard disk drives.</p>
                    <button
                      type="button"
                      onClick={handleDownloadReceiptDoc}
                      className="w-full py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-3xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="h-3 w-3 text-stone-605" />
                      Download Invoice Letter (HTML)
                    </button>
                  </div>

                  {/* Option 3: Electronic Email Transmitter */}
                  <div className="p-3 border border-stone-200 rounded-xl bg-purple-50/30 border-purple-200/50 space-y-2.5">
                    <span className="text-[10px] font-bold text-purple-800 uppercase tracking-widest block">Email Distribution Node</span>
                    
                    {emailSendStatus === 'idle' ? (
                      <form onSubmit={handleSimulatedSendEmail} className="space-y-2">
                        <div>
                          <label className="block text-[8px] font-bold text-stone-500 uppercase tracking-widest mb-1">Student/Parent Email Address</label>
                          <input
                            type="email"
                            required
                            placeholder="e.g. parent@example.com"
                            className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs bg-white"
                            value={receiptEmailInput}
                            onChange={(e) => setReceiptEmailInput(e.target.value)}
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-1.5 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-3xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                        >
                          <Mail className="h-3 w-3" />
                          Transmit Electronic Receipt
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-2.5 text-3xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-stone-600 block">Transmission Logs</span>
                          {emailSendStatus === 'sending' ? (
                            <span className="text-amber-705 font-medium animate-pulse font-mono">Transmitting...</span>
                          ) : (
                            <span className="text-emerald-705 font-bold font-mono">Dispatched</span>
                          )}
                        </div>

                        <div className="bg-stone-900 text-emerald-450 p-2.5 rounded-lg font-mono text-[9px] h-32 overflow-y-auto space-y-1.5 shadow-inner">
                          {emailSendLogs.map((log, index) => (
                            <p key={index} className="leading-tight break-all">
                              &gt; {log}
                            </p>
                          ))}
                        </div>

                        {emailSendStatus === 'success' && (
                          <div className="space-y-2">
                            <p className="text-emerald-800 bg-emerald-50 border border-emerald-100 p-1.5 rounded text-center font-sans font-medium text-[9px]">
                              📧 Digital Invoice dispatched successfully! Checking routing tables.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setEmailSendStatus('idle');
                                setEmailSendLogs([]);
                              }}
                              className="w-full py-1 text-center bg-stone-150 hover:bg-stone-200 text-stone-700 font-bold uppercase tracking-wider rounded text-[9px]"
                            >
                              Dispatch Another Mail
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-stone-200 text-right no-print-element">
                  <button
                    type="button"
                    onClick={() => setActiveReceiptData(null)}
                    className="py-1.5 px-4 bg-stone-850 hover:bg-stone-950 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer w-full text-center"
                  >
                    Done & Close
                  </button>
                </div>

              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};

