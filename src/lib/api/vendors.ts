import { Supplier } from '@/types';
import { apiRequest } from './base';

export const vendorApi = {
  getAll: async (): Promise<Supplier[]> => {
    return apiRequest<Supplier[]>('/api/vendors');
  },

  getById: async (id: string): Promise<Supplier> => {
    return apiRequest<Supplier>(`/api/vendors/${id}`);
  },

  create: async (vendorData: Omit<Supplier, 'id'>): Promise<Supplier> => {
    return apiRequest<Supplier>('/api/vendors', {
      method: 'POST',
      body: JSON.stringify(vendorData),
    });
  },

  update: async (id: string, vendorData: Partial<Omit<Supplier, 'id'>>): Promise<Supplier> => {
    return apiRequest<Supplier>(`/api/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vendorData),
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/vendors/${id}`, {
      method: 'DELETE',
    });
  },
};
