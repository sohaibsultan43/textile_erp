/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApiBaseUrl, getAuthToken, logout } from '../auth';

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any;
};

export const getHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  // Handle 401 Unauthorized (token expired or invalid)
  if (res.status === 401) {
    // Clear auth data and redirect to login
    logout();
    // Reload page to trigger login redirect
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    throw new Error('Token expired. Please log in again.');
  }

  const payload = (await res.json()) as ApiResponse<T>;
  
  if (!res.ok || !payload.success) {
    const errorMessage = payload.error || payload.message || 'Request failed';
    throw new Error(errorMessage);
  }

  return payload.data as T;
};
