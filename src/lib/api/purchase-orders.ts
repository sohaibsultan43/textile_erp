import { PurchaseOrder } from '@/types';
import { apiRequest } from './base';

export const purchaseOrderApi = {
  getAll: async (filters?: { supplierId?: string; status?: string }): Promise<PurchaseOrder[]> => {
    const params = new URLSearchParams();
    if (filters?.supplierId) params.append('supplierId', filters.supplierId);
    if (filters?.status) params.append('status', filters.status);

    const queryString = params.toString();
    return apiRequest<PurchaseOrder[]>(`/api/purchase-orders${queryString ? '?' + queryString : ''}`);
  },

  getById: async (id: string): Promise<PurchaseOrder> => {
    return apiRequest<PurchaseOrder>(`/api/purchase-orders/${id}`);
  },

  create: async (poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrder> => {
    return apiRequest<PurchaseOrder>('/api/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(poData),
    });
  },

  update: async (id: string, poData: Partial<Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PurchaseOrder> => {
    return apiRequest<PurchaseOrder>(`/api/purchase-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(poData),
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/purchase-orders/${id}`, {
      method: 'DELETE',
    });
  },

  confirm: async (id: string): Promise<PurchaseOrder> => {
    return apiRequest<PurchaseOrder>(`/api/purchase-orders/${id}/confirm`, {
      method: 'PATCH',
    });
  },

  cancel: async (id: string): Promise<PurchaseOrder> => {
    return apiRequest<PurchaseOrder>(`/api/purchase-orders/${id}/cancel`, {
      method: 'PATCH',
    });
  },
};
