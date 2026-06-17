import type { AuthSession } from '../types/auth';

const AUTH_STORAGE_KEY = 'sistema_financeiro_auth';
export const AUTH_STORAGE_EVENT = 'sistema-financeiro-auth-updated';
export const SESSION_IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

export function getStoredAuth(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const auth = JSON.parse(raw) as AuthSession;

    if (isSessionIdle(auth)) {
      clearStoredAuth();
      return null;
    }

    return auth;
  } catch {
    clearStoredAuth();
    return null;
  }
}

export function setStoredAuth(auth: AuthSession) {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      ...auth,
      lastActivityAt: auth.lastActivityAt ?? new Date().toISOString(),
    }),
  );
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

export function touchSessionActivity() {
  const auth = getStoredAuth();

  if (!auth) {
    return null;
  }

  const nextAuth = {
    ...auth,
    lastActivityAt: new Date().toISOString(),
  };

  setStoredAuth(nextAuth);
  return nextAuth;
}

export function isSessionIdle(auth: AuthSession) {
  if (!auth.lastActivityAt) {
    return false;
  }

  return Date.now() - new Date(auth.lastActivityAt).getTime() > SESSION_IDLE_TIMEOUT_MS;
}

export function hasUsableStoredAuth() {
  const auth = getStoredAuth();
  return Boolean(auth?.accessToken && !isSessionIdle(auth));
}
