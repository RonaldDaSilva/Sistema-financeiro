import axios, { type InternalAxiosRequestConfig } from 'axios';
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

export const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<AuthResponse | null> | null = null;
let isRedirectingToLogin = false;

type AuthenticatedRequestConfig = InternalAxiosRequestConfig & {
  __isRetryRequest?: boolean;
  __authToken?: string;
  __requestStartedAt?: number;
};

function redirectToLogin() {
  if (isRedirectingToLogin || window.location.pathname === '/login') {
    return false;
  }

  isRedirectingToLogin = true;
  const currentUrl = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`;
  return true;
}

function isPublicAuthRequest(url?: string) {
  if (!url) {
    return false;
  }

  return (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/cadastro') ||
    url.includes('/api/auth/refresh')
  );
}

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
  if (import.meta.env.DEV) {
    (config as AuthenticatedRequestConfig).__requestStartedAt = performance.now();
  }

  let auth = getStoredAuth();

  if (auth?.accessToken && tokenExpiraEmBreve(auth.accessTokenExpiraEm)) {
    auth = await renovarSessaoAtual();
  }

  if (auth?.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
    (config as AuthenticatedRequestConfig).__authToken = auth.accessToken;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    logRequestTiming(response.config as AuthenticatedRequestConfig, response.status);
    return response;
  },
  async (error) => {
    const originalRequest = error.config as AuthenticatedRequestConfig | undefined;
    logRequestTiming(originalRequest, error.response?.status);

    if (isPublicAuthRequest(originalRequest?.url)) {
      return Promise.reject(error);
    }

    const failedToken = originalRequest?.__authToken;
    const currentAuth = getStoredAuth();

    if (error.response?.status === 401 && (!failedToken || currentAuth?.accessToken !== failedToken)) {
      return Promise.reject(error);
    }

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
      if (redirectToLogin()) {
        return new Promise(() => undefined);
      }
    }

    if (error.response?.status === 401) {
      clearStoredAuth();
      if (redirectToLogin()) {
        return new Promise(() => undefined);
      }
    }

    return Promise.reject(error);
  },
);

function logRequestTiming(
  config: AuthenticatedRequestConfig | undefined,
  status: number | undefined,
) {
  if (!import.meta.env.DEV || !config?.__requestStartedAt) {
    return;
  }

  const durationMs = Math.round(performance.now() - config.__requestStartedAt);
  const method = config.method?.toUpperCase() ?? "GET";
  const url = config.url ?? "";

  console.debug(`[api] ${method} ${url} ${status ?? "ERR"} ${durationMs}ms`);
}
