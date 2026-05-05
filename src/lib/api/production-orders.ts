import { ProductionOrder } from '@/types';
import { apiRequest } from './base';

export const productionOrderApi = {
  getAll: async (filters?: { processId?: string; status?: string }): Promise<ProductionOrder[]> => {
    const params = new URLSearchParams();
    if (filters?.processId) params.append('processId', filters.processId);
    if (filters?.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    return apiRequest<ProductionOrder[]>(`/api/production-orders${queryString ? '?' + queryString : ''}`);
  },

  getById: async (id: string): Promise<ProductionOrder> => {
    return apiRequest<ProductionOrder>(`/api/production-orders/${id}`);
  },

  create: async (poData: Omit<ProductionOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionOrder> => {
    return apiRequest<ProductionOrder>('/api/production-orders', {
      method: 'POST',
      body: JSON.stringify(poData),
    });
  },

  update: async (id: string, poData: Partial<Omit<ProductionOrder, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ProductionOrder> => {
    return apiRequest<ProductionOrder>(`/api/production-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(poData),
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/production-orders/${id}`, {
      method: 'DELETE',
    });
  },
};
