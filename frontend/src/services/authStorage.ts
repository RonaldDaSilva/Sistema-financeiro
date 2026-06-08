import type { AuthSession } from '../types/auth';

const AUTH_STORAGE_KEY = 'sistema_financeiro_auth';

export function getStoredAuth(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    clearStoredAuth();
    return null;
  }
}

export function setStoredAuth(auth: AuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
