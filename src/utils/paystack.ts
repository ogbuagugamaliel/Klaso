/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Paystack Integration Helper

export const DEFAULT_PAYSTACK_TEST_KEY = 'pk_test_01928472910481092837482910481029';

export function getPaystackPublicKey(): string {
  const envKey = ((import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || '').trim();
  if (envKey && envKey.startsWith('pk_')) {
    return envKey;
  }
  return DEFAULT_PAYSTACK_TEST_KEY;
}

export function generatePaystackReference(term: string): string {
  const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8);
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `pstk_${cleanTerm}_${timestamp}_${randomStr}`;
}

export function loadPaystackScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).PaystackPop) {
      resolve(true);
      return;
    }

    const existingScript = document.getElementById('paystack-inline-js');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'paystack-inline-js';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface PaystackOptions {
  key?: string;
  email: string;
  amount: number; // in NGN (will be converted to kobo * 100)
  currency?: string;
  ref?: string;
  metadata?: Record<string, any>;
  channels?: ('card' | 'bank' | 'ussd' | 'qr' | 'mobile_money' | 'bank_transfer')[];
  onSuccess: (response: { reference: string; status: string; message: string; trans?: string; transaction?: string }) => void;
  onCancel?: () => void;
}

export async function openPaystackInlinePopup(options: PaystackOptions): Promise<boolean> {
  const isLoaded = await loadPaystackScript();
  const PaystackPop = (window as any).PaystackPop;

  if (!isLoaded || !PaystackPop) {
    return false;
  }

  try {
    const handler = PaystackPop.setup({
      key: options.key || getPaystackPublicKey(),
      email: options.email,
      amount: Math.round(options.amount * 100), // convert to Kobo
      currency: options.currency || 'NGN',
      ref: options.ref || generatePaystackReference(options.metadata?.term || 'term'),
      metadata: options.metadata || {},
      channels: options.channels || ['card', 'bank_transfer', 'ussd', 'bank'],
      callback: (response: any) => {
        options.onSuccess({
          reference: response.reference || response.trxref || options.ref || '',
          status: 'success',
          message: response.message || 'Approved',
          trans: response.trans || response.transaction || ''
        });
      },
      onClose: () => {
        if (options.onCancel) {
          options.onCancel();
        }
      }
    });

    handler.openIframe();
    return true;
  } catch (err) {
    console.error('Paystack Pop error:', err);
    return false;
  }
}

export interface NigerianBankUSSD {
  code: string;
  bankName: string;
  ussdPrefix: string;
}

export const NIGERIAN_USSD_BANKS: NigerianBankUSSD[] = [
  { code: '058', bankName: 'Guaranty Trust Bank (GTB)', ussdPrefix: '*737*50*20000*324#' },
  { code: '057', bankName: 'Zenith Bank', ussdPrefix: '*966*000*20000#' },
  { code: '044', bankName: 'Access Bank', ussdPrefix: '*901*000*20000#' },
  { code: '033', bankName: 'United Bank for Africa (UBA)', ussdPrefix: '*919*00*20000#' },
  { code: '011', bankName: 'First Bank of Nigeria', ussdPrefix: '*894*000*20000#' },
  { code: '035', bankName: 'Wema Bank', ussdPrefix: '*945*000*20000#' },
  { code: '214', bankName: 'First City Monument Bank (FCMB)', ussdPrefix: '*329*000*20000#' },
  { code: '070', bankName: 'Fidelity Bank', ussdPrefix: '*770*000*20000#' },
  { code: '221', bankName: 'Stanbic IBTC Bank', ussdPrefix: '*909*000*20000#' },
  { code: '101', bankName: 'Providus Bank', ussdPrefix: '*540*000*20000#' },
  { code: '076', bankName: 'Polaris Bank', ussdPrefix: '*833*000*20000#' },
  { code: '082', bankName: 'Keystone Bank', ussdPrefix: '*711*000*20000#' }
];
