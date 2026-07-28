import type { AuthResponse, AuthSession } from '../types/auth';
import {
  clearStoredAuth,
  getStoredAuth,
  isAccessTokenUsable,
  isSessionUsable,
  setStoredAuth,
} from './authStorage';

const AUTH_REFRESH_LOCK_KEY = 'sistema_financeiro_auth_refresh_lock';
const AUTH_REFRESH_LOCK_TTL_MS = 10_000;
const AUTH_REFRESH_WAIT_TIMEOUT_MS = 12_000;
const AUTH_REFRESH_WAIT_STEP_MS = 100;

type RefreshLock = {
  ownerId: string;
  expiresAt: number;
};

const contextId = createContextId();

export async function refreshSessionCoordinated(
  refreshFn: (refreshToken: string) => Promise<AuthResponse>,
): Promise<AuthSession | null> {
  const auth = getStoredAuth();

  if (!auth) {
    authDebugLog('refresh rejeitado: sessão local ausente');
    return null;
  }

  if (!isSessionUsable(auth)) {
    authDebugLog('refresh rejeitado: sessão absoluta ou refresh expirado');
    clearStoredAuth();
    return null;
  }

  if (isAccessTokenUsable(auth)) {
    authDebugLog('refresh dispensado: access token ainda válido');
    return auth;
  }

  return runWithRefreshLock(auth, refreshFn);
}

export function authDebugLog(message: string) {
  if (import.meta.env.DEV) {
    console.debug(`[auth] ${message}`);
  }
}

async function runWithRefreshLock(
  originalAuth: AuthSession,
  refreshFn: (refreshToken: string) => Promise<AuthResponse>,
) {
  const acquired = await acquireRefreshLock();

  if (!acquired) {
    authDebugLog('refresh rejeitado: timeout aguardando outra aba');
    return getFreshSessionAfterWaiting(originalAuth);
  }

  try {
    const latestAuth = getStoredAuth();
    if (!latestAuth || !isSessionUsable(latestAuth)) {
      authDebugLog('refresh rejeitado: sessão removida enquanto aguardava lock');
      clearStoredAuth();
      return null;
    }

    if (
      latestAuth.refreshToken !== originalAuth.refreshToken &&
      isAccessTokenUsable(latestAuth)
    ) {
      authDebugLog('refresh reaproveitado: outra aba já renovou a sessão');
      return latestAuth;
    }

    authDebugLog('início de refresh');
    const refreshed = await refreshFn(latestAuth.refreshToken);
    const nextSession = {
      ...refreshed,
      lastActivityAt: new Date().toISOString(),
    };

    setStoredAuth(nextSession);
    authDebugLog('refresh concluído');
    return nextSession;
  } catch {
    authDebugLog('refresh rejeitado pelo servidor');
    clearStoredAuth();
    return null;
  } finally {
    releaseRefreshLock();
  }
}

async function getFreshSessionAfterWaiting(originalAuth: AuthSession) {
  const latestAuth = getStoredAuth();

  if (
    latestAuth &&
    latestAuth.refreshToken !== originalAuth.refreshToken &&
    isSessionUsable(latestAuth)
  ) {
    return latestAuth;
  }

  if (!latestAuth || !isSessionUsable(latestAuth)) {
    clearStoredAuth();
    return null;
  }

  return latestAuth;
}

async function acquireRefreshLock() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < AUTH_REFRESH_WAIT_TIMEOUT_MS) {
    if (tryAcquireRefreshLock()) {
      return true;
    }

    authDebugLog('refresh aguardando outra aba');
    await wait(AUTH_REFRESH_WAIT_STEP_MS);
  }

  return false;
}

function tryAcquireRefreshLock() {
  const now = Date.now();
  const lock = readRefreshLock();

  if (lock && lock.ownerId !== contextId && lock.expiresAt > now) {
    return false;
  }

  const nextLock: RefreshLock = {
    ownerId: contextId,
    expiresAt: now + AUTH_REFRESH_LOCK_TTL_MS,
  };

  localStorage.setItem(AUTH_REFRESH_LOCK_KEY, JSON.stringify(nextLock));
  return readRefreshLock()?.ownerId === contextId;
}

function releaseRefreshLock() {
  if (readRefreshLock()?.ownerId === contextId) {
    localStorage.removeItem(AUTH_REFRESH_LOCK_KEY);
  }
}

function readRefreshLock(): RefreshLock | null {
  const raw = localStorage.getItem(AUTH_REFRESH_LOCK_KEY);

  if (!raw) {
    return null;
  }

  try {
    const lock = JSON.parse(raw) as RefreshLock;
    return typeof lock.ownerId === 'string' && typeof lock.expiresAt === 'number'
      ? lock
      : null;
  } catch {
    localStorage.removeItem(AUTH_REFRESH_LOCK_KEY);
    return null;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createContextId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
