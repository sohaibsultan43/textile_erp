import { Customer } from '@/types';
import { apiRequest } from './base';

export const customerApi = {
  getAll: async (): Promise<Customer[]> => {
    return apiRequest<Customer[]>('/api/customers');
  },

  getById: async (id: string): Promise<Customer> => {
    return apiRequest<Customer>(`/api/customers/${id}`);
  },

  create: async (customerData: Omit<Customer, 'id' | 'currentBalance'>): Promise<Customer> => {
    return apiRequest<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify({
        ...customerData,
        currentBalance: 0,
      }),
    });
  },

  update: async (id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<Customer> => {
    return apiRequest<Customer>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customerData),
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/customers/${id}`, {
      method: 'DELETE',
    });
  },
};
