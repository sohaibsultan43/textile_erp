import { Article } from '@/types';
import { apiRequest } from './base';

export const articleApi = {
  getAll: async (): Promise<Article[]> => {
    return apiRequest<Article[]>('/api/articles');
  },

  getById: async (id: string): Promise<Article> => {
    return apiRequest<Article>(`/api/articles/${id}`);
  },

  create: async (articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>): Promise<Article> => {
    return apiRequest<Article>('/api/articles', {
      method: 'POST',
      body: JSON.stringify(articleData),
    });
  },

  update: async (id: string, articleData: Partial<Omit<Article, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Article> => {
    return apiRequest<Article>(`/api/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(articleData),
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/articles/${id}`, {
      method: 'DELETE',
    });
  },
};
