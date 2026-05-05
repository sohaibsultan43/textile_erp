import { GRN } from '@/types';
import { apiRequest } from './base';

export const grnApi = {
  getAll: async (filters?: { supplierId?: string; status?: string }): Promise<GRN[]> => {
    const params = new URLSearchParams();
    if (filters?.supplierId) params.append('supplierId', filters.supplierId);
    if (filters?.status) params.append('status', filters.status);

    const queryString = params.toString();
    return apiRequest<GRN[]>(`/api/grns${queryString ? '?' + queryString : ''}`);
  },

  getById: async (id: string): Promise<GRN> => {
    return apiRequest<GRN>(`/api/grns/${id}`);
  },

  create: async (
    grnData: Omit<GRN, 'id' | 'grnNumber' | 'createdAt' | 'updatedAt'>,
    options?: { idempotencyKey?: string }
  ): Promise<GRN> => {
    return apiRequest<GRN>('/api/grns', {
      method: 'POST',
      headers: options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      body: JSON.stringify(grnData),
    });
  },

  update: async (id: string, grnData: Partial<Omit<GRN, 'id' | 'createdAt' | 'updatedAt'>>): Promise<GRN> => {
    return apiRequest<GRN>(`/api/grns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(grnData),
    });
  },

  confirm: async (id: string): Promise<GRN> => {
    return apiRequest<GRN>(`/api/grns/${id}/confirm`, {
      method: 'PATCH',
    });
  },

  cancel: async (id: string): Promise<GRN> => {
    return apiRequest<GRN>(`/api/grns/${id}/cancel`, {
      method: 'PATCH',
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/grns/${id}`, {
      method: 'DELETE',
    });
  },
};
