import { DyeingJob, DyeingReceive, LForm, Voucher } from '@/types';
import { apiRequest } from './base';

type DyeingFlowData = {
  jobs: DyeingJob[];
  receives: DyeingReceive[];
  lforms: LForm[];
  vouchers: Voucher[];
};

export const dyeingFlowApi = {
  getAll: async (): Promise<DyeingFlowData> => {
    return apiRequest<DyeingFlowData>('/api/dyeing-flow');
  },

  createJob: async (payload: DyeingJob): Promise<DyeingJob> => {
    return apiRequest<DyeingJob>('/api/dyeing-flow/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateJobStatus: async (id: string, status: DyeingJob['status']): Promise<DyeingJob> => {
    return apiRequest<DyeingJob>(`/api/dyeing-flow/jobs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  deleteJobCascade: async (id: string): Promise<void> => {
    await apiRequest<null>(`/api/dyeing-flow/jobs/${id}`, {
      method: 'DELETE',
    });
  },

  createReceive: async (payload: DyeingReceive): Promise<DyeingReceive> => {
    return apiRequest<DyeingReceive>('/api/dyeing-flow/receives', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createLForm: async (payload: LForm): Promise<LForm> => {
    return apiRequest<LForm>('/api/dyeing-flow/lforms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createVoucher: async (payload: Voucher): Promise<Voucher> => {
    return apiRequest<Voucher>('/api/dyeing-flow/vouchers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
