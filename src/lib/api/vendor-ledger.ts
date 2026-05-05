/* eslint-disable @typescript-eslint/no-explicit-any */
import { VendorLedgerEntry } from '@/types';
import { apiRequest } from './base';

export interface VendorLedgerSummary {
  supplier: any;
  entries: VendorLedgerEntry[];
  summary: {
    totalDebits: number;
    totalCredits: number;
    currentBalance: number;
  };
}

export interface CreateLedgerEntryData {
  supplierId: string;
  entryType: 'debit' | 'credit';
  amount: number;
  referenceType: 'receiving_invoice' | 'payment' | 'adjustment' | 'opening_balance';
  referenceId?: string;
  referenceNumber?: string;
  description: string;
  date: string;
}

export interface CreatePaymentData {
  supplierId: string;
  amount: number;
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer' | 'online' | 'credit';
  reference?: string;
  date: string;
  notes?: string;
}

export const vendorLedgerApi = {
  getBySupplierId: async (
    supplierId: string,
    filters?: { startDate?: string; endDate?: string }
  ): Promise<VendorLedgerSummary> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    const query = params.toString();
    const url = query
      ? `/api/vendor-ledger/${supplierId}?${query}`
      : `/api/vendor-ledger/${supplierId}`;
    return apiRequest<VendorLedgerSummary>(url);
  },

  createEntry: async (entryData: CreateLedgerEntryData): Promise<VendorLedgerEntry> => {
    return apiRequest<VendorLedgerEntry>('/api/vendor-ledger', {
      method: 'POST',
      body: JSON.stringify(entryData),
    });
  },

  createPayment: async (paymentData: CreatePaymentData): Promise<VendorLedgerEntry> => {
    return apiRequest<VendorLedgerEntry>('/api/vendor-ledger/payment', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  updateEntry: async (id: string, entryData: Partial<CreateLedgerEntryData>): Promise<VendorLedgerEntry> => {
    return apiRequest<VendorLedgerEntry>(`/api/vendor-ledger/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entryData),
    });
  },

  deleteEntry: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/vendor-ledger/${id}`, {
      method: 'DELETE',
    });
  },
};