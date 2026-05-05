import { Location } from '@/types';
import { apiRequest } from './base';

export const locationApi = {
  getAll: async (type?: 'godown' | 'salepoint'): Promise<Location[]> => {
    const query = type ? `?type=${type}` : '';
    return apiRequest<Location[]>(`/api/locations${query}`);
  },

  getById: async (id: string): Promise<Location> => {
    return apiRequest<Location>(`/api/locations/${id}`);
  },

  create: async (locationData: Omit<Location, 'id'>): Promise<Location> => {
    return apiRequest<Location>('/api/locations', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  },

  update: async (id: string, locationData: Partial<Omit<Location, 'id'>>): Promise<Location> => {
    return apiRequest<Location>(`/api/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(locationData),
    });
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/locations/${id}`, {
      method: 'DELETE',
    });
  },

  getDeletionStatus: async (id: string): Promise<{
    canDelete: boolean;
    blockingRecords: {
      stockItems: number;
      saleOrders: number;
      fromRequisitions: number;
      toRequisitions: number;
      fromGatePasses: number;
      toGatePasses: number;
    };
    preview?: {
      stockItems?: Array<{ 
        id: string; 
        quantity: number; 
        article: { name: string }; 
        poNumbers?: string[] | null;
      }>;
      saleOrders?: Array<{ id: string; orderNumber: string; totalAmount: number; status: string }>;
      fromRequisitions?: Array<{ id: string; requisitionNumber?: string }>;
      toRequisitions?: Array<{ id: string; requisitionNumber?: string }>;
      fromGatePasses?: Array<{ id: string; gatePassNumber?: string }>;
      toGatePasses?: Array<{ id: string; gatePassNumber?: string }>;
    };
  }> => {
    return apiRequest(`/api/locations/${id}/deletion-status`);
  },

  getStockDetail: async (id: string): Promise<Array<{
    id: string;
    articleId: string;
    article: { name: string; unit: string; yarnCount?: string; composition?: string; constraction?: string; width?: string; lotNumber?: string };
    quantity: number;
    meterEquivalent?: number | null;
    pricePerUnit: number;
    lotNo?: string | null;
    shade?: string | null;
    stage: string;
    createdAt: string;
    receivingDate?: string | null;
    transactionNo?: string | null;
    supplier?: { id: string; name: string; phone?: string; contactPerson?: string } | null;
    packages?: number | null;
    issuedToDyeing?: { workOrderNo?: string; dyeingHouse?: string; jobNumber?: string; greyThan?: number; greyMeters?: number; status?: string } | null;
  }>> => {
    return apiRequest(`/api/locations/${id}/stock-detail`);
  },
};
