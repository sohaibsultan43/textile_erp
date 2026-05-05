/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from '@/types';
import { STORAGE_KEYS } from './storage';

type LoginResponse = {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: User['role'];
    };
  };
  message?: string;
  error?: string;
};

export const getApiBaseUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  // If VITE_API_URL is defined (even if empty string), use it. 
  // This allows "" in .env.production to result in relative paths.
  return envUrl !== undefined ? envUrl : 'http://localhost:3001';
};

export const login = async (email: string, password: string): Promise<User | null> => {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await res.json()) as LoginResponse;
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Login failed');
  }

  if (!payload?.data?.token || !payload?.data?.user) return null;

  localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, payload.data.token);

  const user: User = {
    id: payload.data.user.id,
    email: payload.data.user.email,
    name: payload.data.user.name,
    role: payload.data.user.role,
  };

  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  return user;
};

export const logout = () => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
};

export const getCurrentUser = (): User | null => {
  const userData = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return userData ? JSON.parse(userData) : null;
};

export const isAuthenticated = (): boolean => {
  return Boolean(getAuthToken());
};
