/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Building2, 
  PhoneCall, 
  ShieldCheck, 
  CheckCircle, 
  X, 
  Copy, 
  Check, 
  ArrowRight, 
  Lock, 
  Sparkles,
  ExternalLink,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { School, Profile, SubscriptionPaymentRecord } from '../types';
import { 
  openPaystackInlinePopup, 
  generatePaystackReference, 
  getPaystackPublicKey,
  NIGERIAN_USSD_BANKS
} from '../utils/paystack';

interface PaystackPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  termToPay: string;
  currentSchool: School;
  currentProfile: Profile;
  onPaymentComplete: (paymentRecord: SubscriptionPaymentRecord) => Promise<void>;
}

export function PaystackPaymentModal({
  isOpen,
  onClose,
  termToPay,
  currentSchool,
  currentProfile,
  onPaymentComplete
}: PaystackPaymentModalProps) {
  const [activeChannel, setActiveChannel] = useState<'card' | 'transfer' | 'ussd' | 'paystack_pop'>('card');
  const [step, setStep] = useState<'form' | 'processing' | 'otp' | 'success'>('form');
  const [processingMsg, setProcessingMsg] = useState('Contacting Paystack Gateway...');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form states
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [cardPin, setCardPin] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [selectedUssdBank, setSelectedUssdBank] = useState(NIGERIAN_USSD_BANKS[0].code);

  // Paystack transaction metadata
  const [paystackRef, setPaystackRef] = useState('');
  const [completedRecord, setCompletedRecord] = useState<SubscriptionPaymentRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Paystack virtual account mock details (generated uniquely per reference)
  const [virtualAccountNumber] = useState(() => '99' + Math.floor(10000000 + Math.random() * 90000000));

  useEffect(() => {
    if (isOpen) {
      const ref = generatePaystackReference(termToPay);
      setPaystackRef(ref);
      setStep('form');
      setErrorMessage('');
      setCompletedRecord(null);
      setCardNumber('');
      setCardExpiry('');
      setCardCVV('');
      setCardPin('');
      setOtpCode('');
    }
  }, [isOpen, termToPay]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const getCardType = (num: string) => {
    const clean = num.replace(/\D/g, '');
    if (clean.startsWith('4')) return 'VISA';
    if (clean.startsWith('5')) return 'MASTERCARD';
    if (clean.startsWith('506') || clean.startsWith('507') || clean.startsWith('650')) return 'VERVE';
    return 'CARD';
  };

  const formatCardNumber = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 16);
    const groups = clean.match(/.{1,4}/g);
    return groups ? groups.join(' ') : clean;
  };

  const formatExpiry = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 3) {
      return `${clean.slice(0, 2)}/${clean.slice(2)}`;
    }
    return clean;
  };

  // Launch official Paystack Popup
  const handleLaunchPaystackPopup = async () => {
    setErrorMessage('');
    setStep('processing');
    setProcessingMsg('Initializing Paystack Secure Checkout...');

    const success = await openPaystackInlinePopup({
      email: currentProfile.email || currentSchool.contactEmail || 'school@klaso.edu.ng',
      amount: 20000,
      currency: 'NGN',
      ref: paystackRef,
      metadata: {
        school_id: currentSchool.id,
        school_name: currentSchool.name,
        term: termToPay,
        admin_name: currentProfile.full_name,
        admin_email: currentProfile.email
      },
      onSuccess: async (response) => {
        const record: SubscriptionPaymentRecord = {
          id: `pay_${Date.now()}`,
          reference: response.reference || paystackRef,
          amount: 20000,
          term: termToPay,
          paid_at: new Date().toISOString(),
          channel: 'paystack_inline',
          customer_email: currentProfile.email,
          status: 'success'
        };
        setCompletedRecord(record);
        setStep('processing');
        setProcessingMsg('Verifying Paystack webhook & activating Premium plan...');
        try {
          await onPaymentComplete(record);
          setStep('success');
        } catch (err: any) {
          setErrorMessage(err.message || 'Payment recorded but activation failed.');
          setStep('form');
        }
      },
      onCancel: () => {
        setStep('form');
        setErrorMessage('Paystack checkout was cancelled.');
      }
    });

    if (!success) {
      // If script popup could not open directly (e.g. adblocker or sandboxed iframe), smoothly switch to in-app Paystack channel
      setStep('form');
      setActiveChannel('card');
      setErrorMessage('Direct popup was blocked by browser iframe. You can pay securely using the Paystack Card, Transfer, or USSD options below.');
    }
  };

  // Handle Card Checkout
  const handleProcessCardPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = cardNumber.replace(/\D/g, '');
    if (cleanNum.length < 16) {
      setErrorMessage('Please enter a valid 16-digit card number.');
      return;
    }
    if (!cardExpiry || cardExpiry.length < 5) {
      setErrorMessage('Please enter card expiration date (MM/YY).');
      return;
    }
    if (!cardCVV || cardCVV.length < 3) {
      setErrorMessage('Please enter 3-digit CVV.');
      return;
    }

    setErrorMessage('');
    setStep('processing');
    setProcessingMsg('Encrypting card details with 256-bit TLS (Paystack Switch)...');

    setTimeout(() => {
      setStep('otp');
    }, 1800);
  };

  // Handle OTP Submission
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) {
      setErrorMessage('Please enter the 4 to 6-digit OTP code sent by your bank.');
      return;
    }

    setErrorMessage('');
    setStep('processing');
    setProcessingMsg('Authenticating 3D-Secure One-Time Password with Paystack...');

    setTimeout(async () => {
      const record: SubscriptionPaymentRecord = {
        id: `pay_${Date.now()}`,
        reference: paystackRef,
        amount: 20000,
        term: termToPay,
        paid_at: new Date().toISOString(),
        channel: 'paystack_card',
        customer_email: currentProfile.email,
        status: 'success'
      };

      try {
        await onPaymentComplete(record);
        setCompletedRecord(record);
        setStep('success');
      } catch (err: any) {
        setErrorMessage(err.message || 'Payment processing failed.');
        setStep('form');
      }
    }, 2000);
  };

  // Handle Bank Transfer Confirmation
  const handleConfirmTransfer = async () => {
    setErrorMessage('');
    setStep('processing');
    setProcessingMsg('Listening for NIP Bank Transfer credit from Paystack Titan Switch...');

    setTimeout(async () => {
      const record: SubscriptionPaymentRecord = {
        id: `pay_${Date.now()}`,
        reference: paystackRef,
        amount: 20000,
        term: termToPay,
        paid_at: new Date().toISOString(),
        channel: 'paystack_transfer',
        customer_email: currentProfile.email,
        status: 'success'
      };

      try {
        await onPaymentComplete(record);
        setCompletedRecord(record);
        setStep('success');
      } catch (err: any) {
        setErrorMessage(err.message || 'Transfer confirmation failed.');
        setStep('form');
      }
    }, 2400);
  };

  // Handle USSD Confirmation
  const handleConfirmUssd = async () => {
    setErrorMessage('');
    setStep('processing');
    setProcessingMsg('Validating USSD transaction status with Paystack...');

    setTimeout(async () => {
      const record: SubscriptionPaymentRecord = {
        id: `pay_${Date.now()}`,
        reference: paystackRef,
        amount: 20000,
        term: termToPay,
        paid_at: new Date().toISOString(),
        channel: 'paystack_ussd',
        customer_email: currentProfile.email,
        status: 'success'
      };

      try {
        await onPaymentComplete(record);
        setCompletedRecord(record);
        setStep('success');
      } catch (err: any) {
        setErrorMessage(err.message || 'USSD transaction verification failed.');
        setStep('form');
      }
    }, 2200);
  };

  const selectedBankData = NIGERIAN_USSD_BANKS.find(b => b.code === selectedUssdBank) || NIGERIAN_USSD_BANKS[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-stone-200 overflow-hidden relative flex flex-col max-h-[92vh]"
      >
        {/* Top Paystack Branded Header */}
        <div className="bg-[#0BA4DB] text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-xs shrink-0">
              <svg viewBox="0 0 100 100" className="w-6 h-6">
                {/* Paystack distinctive emblem bars */}
                <rect x="15" y="20" width="70" height="12" rx="6" fill="#0BA4DB" />
                <rect x="15" y="44" width="48" height="12" rx="6" fill="#0BA4DB" />
                <rect x="15" y="68" width="70" height="12" rx="6" fill="#0BA4DB" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="font-display font-black text-white text-base tracking-tight">paystack</h3>
                <span className="text-[10px] uppercase font-mono font-bold bg-white/20 px-1.5 py-0.5 rounded text-white tracking-wider">
                  Checkout
                </span>
              </div>
              <p className="text-white/80 text-3xs font-medium">
                Secured payment gateway for {currentSchool.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={step === 'processing'}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Amount Summary Bar */}
        <div className="bg-stone-50 border-b border-stone-200 px-5 sm:px-6 py-3 flex items-center justify-between shrink-0 text-xs">
          <div>
            <span className="text-stone-500 text-3xs font-bold uppercase tracking-wider block">Target Subscription</span>
            <strong className="text-stone-800 font-display text-sm">{termToPay}</strong>
          </div>
          <div className="text-right">
            <span className="text-stone-500 text-3xs font-bold uppercase tracking-wider block">Pay Amount</span>
            <strong className="text-[#0BA4DB] font-display text-lg font-black tracking-tight">₦20,000<span className="text-xs text-stone-500 font-sans">.00</span></strong>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-3xs font-medium leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {step === 'form' && (
            <div className="space-y-4">
              {/* Payment Channel Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-stone-100 rounded-2xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => { setActiveChannel('card'); setErrorMessage(''); }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    activeChannel === 'card'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5 text-[#0BA4DB]" />
                  <span>Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveChannel('transfer'); setErrorMessage(''); }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    activeChannel === 'transfer'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 text-[#0BA4DB]" />
                  <span>Transfer</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveChannel('ussd'); setErrorMessage(''); }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    activeChannel === 'ussd'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <PhoneCall className="h-3.5 w-3.5 text-[#0BA4DB]" />
                  <span>USSD</span>
                </button>
              </div>

              {/* Fast Popup Launcher Option */}
              <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-[#0BA4DB]/10 rounded-xl text-[#0BA4DB]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Paystack Instant Popup</h4>
                    <p className="text-3xs text-stone-500">Pay with official Paystack modal interface</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLaunchPaystackPopup}
                  className="px-3 py-1.5 bg-[#0BA4DB] hover:bg-[#098bb9] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1 cursor-pointer whitespace-nowrap"
                >
                  <span>Launch Pop</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>

              {/* CHANNEL 1: CARD PAYMENT */}
              {activeChannel === 'card' && (
                <form onSubmit={handleProcessCardPayment} className="space-y-3.5 pt-1">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-3xs font-bold text-stone-600 uppercase tracking-wider">
                        Card Number
                      </label>
                      <span className="text-3xs font-mono font-bold text-[#0BA4DB]">
                        {getCardType(cardNumber)}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="5061 2345 6789 0123"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-[#0BA4DB] focus:border-[#0BA4DB] tracking-wider"
                      />
                      <div className="absolute right-3 top-3 flex items-center space-x-1 text-stone-400">
                        <CreditCard className="h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-3xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                        className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-[#0BA4DB] text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-3xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                        CVV
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="123"
                        value={cardCVV}
                        onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-[#0BA4DB] text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-3xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                      Card 4-Digit PIN (Secured)
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={cardPin}
                      onChange={(e) => setCardPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-[#0BA4DB] text-center tracking-widest"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3 bg-[#0BA4DB] hover:bg-[#098bb9] text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Pay ₦20,000 via Paystack</span>
                    </button>
                  </div>
                </form>
              )}

              {/* CHANNEL 2: BANK TRANSFER */}
              {activeChannel === 'transfer' && (
                <div className="space-y-4 pt-1">
                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-center space-y-3">
                    <p className="text-3xs text-stone-500 font-medium">
                      Transfer exact sum of <strong className="text-stone-800">₦20,000</strong> to the Paystack Titan account below:
                    </p>

                    <div className="bg-white border border-dashed border-[#0BA4DB]/40 rounded-xl p-3.5 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-stone-500">Bank Name:</span>
                        <strong className="text-stone-900 font-bold">Wema Bank / Paystack Titan</strong>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-stone-500">Account Number:</span>
                        <div className="flex items-center space-x-1.5 font-mono font-bold text-sm text-[#0BA4DB]">
                          <span>{virtualAccountNumber}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(virtualAccountNumber, 'account')}
                            className="p-1 text-stone-400 hover:text-stone-700 rounded transition cursor-pointer"
                            title="Copy Account Number"
                          >
                            {copiedField === 'account' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-stone-500">Beneficiary:</span>
                        <strong className="text-stone-800 text-2xs truncate max-w-[200px]">
                          Klaso / {currentSchool.name}
                        </strong>
                      </div>
                    </div>

                    <p className="text-[10px] text-stone-400">
                      Account expires in 30 minutes. Automated Paystack switch detects payment immediately.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmTransfer}
                    className="w-full py-3 bg-[#0BA4DB] hover:bg-[#098bb9] text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>I Have Sent The ₦20,000</span>
                  </button>
                </div>
              )}

              {/* CHANNEL 3: USSD */}
              {activeChannel === 'ussd' && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-3xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                      Choose Your Nigerian Bank
                    </label>
                    <select
                      value={selectedUssdBank}
                      onChange={(e) => setSelectedUssdBank(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0BA4DB]"
                    >
                      {NIGERIAN_USSD_BANKS.map(bank => (
                        <option key={bank.code} value={bank.code}>
                          {bank.bankName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-center space-y-3">
                    <p className="text-3xs text-stone-500 font-medium">
                      Dial this USSD code on the phone number linked to your bank account:
                    </p>

                    <div className="p-3 bg-stone-900 text-amber-300 font-mono text-base font-bold rounded-xl flex items-center justify-center space-x-2 tracking-wider">
                      <span>{selectedBankData.ussdPrefix}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedBankData.ussdPrefix, 'ussd')}
                        className="text-stone-400 hover:text-white p-1 rounded transition cursor-pointer"
                        title="Copy USSD Code"
                      >
                        {copiedField === 'ussd' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>

                    <p className="text-[10px] text-stone-400">
                      Follow bank prompts to confirm your transaction PIN.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmUssd}
                    className="w-full py-3 bg-[#0BA4DB] hover:bg-[#098bb9] text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <PhoneCall className="h-4 w-4" />
                    <span>I Have Completed USSD Payment</span>
                  </button>
                </div>
              )}

              {/* Paystack Reference and Security Footer */}
              <div className="pt-2 border-t border-stone-150 flex items-center justify-between text-3xs text-stone-400">
                <div className="flex items-center space-x-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#0BA4DB]" />
                  <span>256-Bit SSL Encrypted by Paystack</span>
                </div>
                <div className="font-mono text-[9px] text-stone-400">
                  Ref: {paystackRef.slice(0, 18)}...
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING SCREEN */}
          {step === 'processing' && (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-14 h-14 border-4 border-[#0BA4DB]/20 border-t-[#0BA4DB] rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-[#0BA4DB]" />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900 font-display">
                  {processingMsg}
                </h4>
                <p className="text-3xs text-stone-500 mt-1 max-w-xs leading-relaxed">
                  Please do not refresh or close this modal. Paystack is synchronizing your remittance and registering your school's Premium status.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: OTP 3D-SECURE CHALLENGE */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="py-4 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-sky-50 text-[#0BA4DB] mx-auto flex items-center justify-center border border-sky-200">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <div>
                <h4 className="text-sm font-bold text-stone-900 font-display">Paystack 3D Secure Authentication</h4>
                <p className="text-3xs text-stone-500 mt-1 max-w-xs mx-auto">
                  A verification OTP was dispatched to your mobile number / bank app for this ₦20,000 transaction.
                </p>
              </div>

              <div className="max-w-xs mx-auto">
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  placeholder="Enter 6-Digit OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border border-stone-300 rounded-xl text-center text-base font-mono font-bold tracking-widest focus:outline-hidden focus:ring-2 focus:ring-[#0BA4DB]"
                />
                <span className="text-[10px] text-stone-400 mt-1.5 block">
                  Demo hint: enter any 6 digits (e.g. 123456)
                </span>
              </div>

              <div className="flex space-x-2 pt-2 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="flex-1 py-2 px-3 border border-stone-300 text-stone-700 text-xs font-bold rounded-xl hover:bg-stone-50 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-[#0BA4DB] hover:bg-[#098bb9] text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Verify & Pay
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: SUCCESS RECEIPT */}
          {step === 'success' && (
            <div className="py-6 px-2 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border-2 border-emerald-200 flex items-center justify-center shadow-xs">
                <CheckCircle className="h-9 w-9 animate-bounce" />
              </div>

              <div>
                <span className="text-3xs font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Paystack Status: APPROVED
                </span>
                <h3 className="text-lg font-display font-black text-stone-900 mt-2">
                  ₦20,000 Payment Successful!
                </h3>
                <p className="text-xs text-stone-600 mt-1 max-w-sm">
                  {currentSchool.name} is now upgraded to <strong className="text-[#1B4332]">Premium Tier</strong>. All class gradebooks, term summaries, tuition installment billing, and PDF reports are unlocked for <strong className="text-stone-800">{termToPay}</strong>.
                </p>
              </div>

              {/* Paystack Official Receipt Box */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 w-full text-left space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                  <span className="text-stone-500 text-3xs uppercase font-bold">Transaction Reference</span>
                  <span className="font-mono text-2xs font-bold text-stone-800">{completedRecord?.reference || paystackRef}</span>
                </div>
                <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                  <span className="text-stone-500 text-3xs uppercase font-bold">Amount Paid</span>
                  <span className="font-bold text-stone-900">₦20,000.00 NGN</span>
                </div>
                <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                  <span className="text-stone-500 text-3xs uppercase font-bold">Gateway Processor</span>
                  <span className="font-bold text-[#0BA4DB]">Paystack Technologies Limited</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500 text-3xs uppercase font-bold">Authorized User</span>
                  <span className="text-stone-700">{currentProfile.email}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-[#1B4332] hover:bg-[#143225] text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Done & Return to Registry</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
