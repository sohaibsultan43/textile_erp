import { ReceivingInvoice } from '@/types';
import { apiRequest } from './base';

export interface CreateReceivingInvoiceData {
  billNo?: string;
  poId: string;
  supplierId: string;
  date: string;
  dueDate?: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paymentTerms?: 'cash' | 'credit' | 'cheque';
  notes?: string;
  items: Array<{
    articleId: string;
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
    taxPercent?: number;
    taxAmount: number;
    lineTotal: number;
  }>;
  grnIds?: string[];
}

export const receivingInvoiceApi = {
  getAll: async (filters?: { supplierId?: string; status?: string; fromDate?: string; toDate?: string }): Promise<ReceivingInvoice[]> => {
    const params = new URLSearchParams();
    if (filters?.supplierId) params.append('supplierId', filters.supplierId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.fromDate) params.append('fromDate', filters.fromDate);
    if (filters?.toDate) params.append('toDate', filters.toDate);
    
    const queryString = params.toString();
    return apiRequest<ReceivingInvoice[]>(`/api/receiving-invoices${queryString ? '?' + queryString : ''}`);
  },

  getById: async (id: string): Promise<ReceivingInvoice> => {
    return apiRequest<ReceivingInvoice>(`/api/receiving-invoices/${id}`);
  },

  create: async (invoiceData: CreateReceivingInvoiceData): Promise<ReceivingInvoice> => {
    return apiRequest<ReceivingInvoice>('/api/receiving-invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    });
  },

  update: async (id: string, invoiceData: Partial<CreateReceivingInvoiceData>): Promise<ReceivingInvoice> => {
    return apiRequest<ReceivingInvoice>(`/api/receiving-invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(invoiceData),
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/receiving-invoices/${id}`, {
      method: 'DELETE',
    });
  },
};
