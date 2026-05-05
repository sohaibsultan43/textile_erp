import { StockItem, StockLedgerResponse } from '@/types';
import { apiRequest } from './base';

export const stockApi = {
  getAll: async (locationId?: string, articleId?: string, stage?: 'RM' | 'WIP' | 'FG'): Promise<StockItem[]> => {
    const params = new URLSearchParams();
    if (locationId) params.append('locationId', locationId);
    if (articleId) params.append('articleId', articleId);
    if (stage) params.append('stage', stage);
    const query = params.toString();
    return apiRequest<StockItem[]>(`/api/stock${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<StockItem> => {
    return apiRequest<StockItem>(`/api/stock/${id}`);
  },

  create: async (stockData: Omit<StockItem, 'id'>): Promise<StockItem> => {
    return apiRequest<StockItem>('/api/stock', {
      method: 'POST',
      body: JSON.stringify(stockData),
    });
  },

  update: async (id: string, stockData: Partial<Omit<StockItem, 'id'>>): Promise<StockItem> => {
    return apiRequest<StockItem>(`/api/stock/${id}`, {
      method: 'PUT',
      body: JSON.stringify(stockData),
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/stock/${id}`, {
      method: 'DELETE',
    });
  },

  getLedger: async (
    articleId: string,
    filters?: { locationId?: string; startDate?: string; endDate?: string }
  ): Promise<StockLedgerResponse> => {
    const params = new URLSearchParams();
    if (filters?.locationId) params.set('locationId', filters.locationId);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    const query = params.toString();
    const url = query ? `/api/stock/ledger/${articleId}?${query}` : `/api/stock/ledger/${articleId}`;
    return apiRequest<StockLedgerResponse>(url);
  },

  // Bulk operations
  adjustQuantity: async (id: string, quantity: number, operation: 'add' | 'subtract' | 'set'): Promise<StockItem> => {
    return apiRequest<StockItem>(`/api/stock/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ quantity, operation }),
    });
  },
};
