import { User } from '@/types';
import { apiRequest } from './base';

export const userApi = {
  getAll: async (role?: User['role']): Promise<User[]> => {
    const query = role ? `?role=${role}` : '';
    return apiRequest<User[]>(`/api/auth/users${query}`);
  },

  getById: async (id: string): Promise<User> => {
    return apiRequest<User>(`/api/auth/users/${id}`);
  },

  create: async (userData: { email: string; password: string; name: string; role: User['role'] }): Promise<User> => {
    return apiRequest<User>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  update: async (id: string, userData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & { password?: string }): Promise<User> => {
    return apiRequest<User>(`/api/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/auth/users/${id}`, {
      method: 'DELETE',
    });
  },
};
