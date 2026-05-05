import { SaleOrder } from '@/types';
import { apiRequest } from './base';

export const saleOrderApi = {
  getAll: async (filters?: { customerId?: string; status?: string }): Promise<SaleOrder[]> => {
    const params = new URLSearchParams();
    if (filters?.customerId) params.append('customerId', filters.customerId);
    if (filters?.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    return apiRequest<SaleOrder[]>(`/api/sales-orders${queryString ? '?' + queryString : ''}`);
  },

  getById: async (id: string): Promise<SaleOrder> => {
    return apiRequest<SaleOrder>(`/api/sales-orders/${id}`);
  },

  create: async (saleOrderData: Omit<SaleOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<SaleOrder> => {
    return apiRequest<SaleOrder>('/api/sales-orders', {
      method: 'POST',
      body: JSON.stringify(saleOrderData),
    });
  },

  update: async (id: string, saleOrderData: Partial<Omit<SaleOrder, 'id' | 'createdAt' | 'updatedAt'>>): Promise<SaleOrder> => {
    return apiRequest<SaleOrder>(`/api/sales-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(saleOrderData),
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/sales-orders/${id}`, {
      method: 'DELETE',
    });
  },
};
