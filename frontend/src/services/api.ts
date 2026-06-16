import axios from 'axios';
import type { AuthResponse } from '../types/auth';
import {
  clearStoredAuth,
  getStoredAuth,
  isSessionIdle,
  setStoredAuth,
} from './authStorage';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<AuthResponse | null> | null = null;

function tokenExpiraEmBreve(expiraEm: string) {
  return new Date(expiraEm).getTime() - Date.now() <= 60_000;
}

async function renovarSessaoAtual() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const auth = getStoredAuth();

  if (!auth || isSessionIdle(auth)) {
    clearStoredAuth();
    return null;
  }

  refreshPromise = publicApi
    .post<AuthResponse>('/api/auth/refresh', {
      refreshToken: auth.refreshToken,
    })
    .then((response) => {
      const nextSession = {
        ...response.data,
        lastActivityAt: auth.lastActivityAt ?? new Date().toISOString(),
      };

      setStoredAuth(nextSession);
      return nextSession;
    })
    .catch(() => {
      clearStoredAuth();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

api.interceptors.request.use(async (config) => {
  let auth = getStoredAuth();

  if (auth?.accessToken && tokenExpiraEmBreve(auth.accessTokenExpiraEm)) {
    auth = await renovarSessaoAtual();
  }

  if (auth?.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest.__isRetryRequest
    ) {
      originalRequest.__isRetryRequest = true;
      const auth = await renovarSessaoAtual();

      if (auth?.accessToken) {
        originalRequest.headers.Authorization = `Bearer ${auth.accessToken}`;
        return api(originalRequest);
      }

      clearStoredAuth();
    }

    return Promise.reject(error);
  },
);
