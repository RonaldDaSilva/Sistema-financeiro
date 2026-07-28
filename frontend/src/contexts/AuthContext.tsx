import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authService from '../services/authService';
import { renovarSessaoAtual } from '../services/api';
import { authDebugLog } from '../services/authRefreshCoordinator';
import {
  AUTH_STORAGE_EVENT,
  clearStoredAuth,
  getStoredAuth,
  isAccessTokenUsable,
  isSessionUsable,
  setStoredAuth,
  touchSessionActivity,
} from '../services/authStorage';
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest } from '../types/auth';
import { AuthContext, type AuthContextValue } from './authContextCore';

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuth());
  const [isAuthRestoring, setIsAuthRestoring] = useState(true);
  const lastActivitySyncRef = useRef(0);

  const persistSession = useCallback((nextSession: AuthSession) => {
    const sessionWithActivity = {
      ...nextSession,
      lastActivityAt: new Date().toISOString(),
    };

    setStoredAuth(sessionWithActivity);
    setSession(sessionWithActivity);
  }, []);

  const handleLogin = useCallback(
    async (request: LoginRequest) => {
      const response = await authService.login(request);
      persistSession(response);
    },
    [persistSession],
  );

  const handleRegister = useCallback(
    async (request: RegisterRequest) => {
      const response = await authService.register(request);
      persistSession(response);
    },
    [persistSession],
  );

  const clearLocalSession = useCallback(() => {
    clearStoredAuth();
    queryClient.clear();
    setSession(null);
  }, [queryClient]);

  const logout = useCallback(async () => {
    const refreshToken = getStoredAuth()?.refreshToken;
    clearLocalSession();

    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {
        // Logout local já foi aplicado; falha de rede não deve manter a sessão aberta no cliente.
      }
    }
  }, [clearLocalSession]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedSession = getStoredAuth();

      if (!storedSession) {
        authDebugLog('restauração sem sessão local');
        if (isMounted) {
          setSession(null);
          setIsAuthRestoring(false);
        }
        return;
      }

      if (isAccessTokenUsable(storedSession)) {
        authDebugLog('restauração usando access token válido');
        if (isMounted) {
          setSession(storedSession);
          setIsAuthRestoring(false);
        }
        return;
      }

      if (!isSessionUsable(storedSession)) {
        authDebugLog('sessão absoluta ou refresh expirado durante restauração');
        clearLocalSession();
        if (isMounted) {
          setIsAuthRestoring(false);
        }
        return;
      }

      try {
        authDebugLog('restauração tentando refresh silencioso');
        const sessionWithActivity = await renovarSessaoAtual();
        if (isMounted) {
          setSession(sessionWithActivity);
        }
      } catch {
        authDebugLog('refresh rejeitado durante restauração');
        clearLocalSession();
      } finally {
        if (isMounted) {
          setIsAuthRestoring(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [clearLocalSession]);

  useEffect(() => {
    function syncSessionFromStorage() {
      const storedSession = getStoredAuth();
      setSession(storedSession);

      if (!storedSession) {
        queryClient.clear();
      }
    }

    window.addEventListener(AUTH_STORAGE_EVENT, syncSessionFromStorage);
    window.addEventListener("storage", syncSessionFromStorage);

    return () => {
      window.removeEventListener(AUTH_STORAGE_EVENT, syncSessionFromStorage);
      window.removeEventListener("storage", syncSessionFromStorage);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!session) {
      return;
    }

    function handleActivity() {
      const now = Date.now();
      if (now - lastActivitySyncRef.current < 60_000) {
        return;
      }

      lastActivitySyncRef.current = now;
      const updatedSession = touchSessionActivity();
      if (updatedSession) {
        setSession(updatedSession);
      }
    }

    function handleIdleCheck() {
      const storedSession = getStoredAuth();
      if (!storedSession) {
        void logout();
      }
    }

    const activityEvents = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
    ] as const;

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true }),
    );
    const interval = window.setInterval(handleIdleCheck, 60_000);

    return () => {
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, handleActivity),
      );
      window.clearInterval(interval);
    };
  }, [logout, session]);

  const updateUser = useCallback((nextUser: Partial<AuthUser>) => {
    setSession((current) => {
      if (!current) {
        return current;
      }

      const nextSession = {
        ...current,
        nome: nextUser.nome ?? current.nome,
        email: nextUser.email ?? current.email,
        telefone: nextUser.telefone ?? current.telefone,
        cpf: nextUser.cpf ?? current.cpf,
      };

      setStoredAuth(nextSession);
      return nextSession;
    });
  }, []);

  const user = useMemo<AuthUser | null>(() => {
    if (!session) {
      return null;
    }

    return {
      id: session.usuarioId,
      nome: session.nome,
      email: session.email,
      telefone: session.telefone,
      cpf: session.cpf,
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isAuthenticated: Boolean(session?.accessToken),
      isAuthRestoring,
      login: handleLogin,
      register: handleRegister,
      updateUser,
      logout,
    }),
    [handleLogin, handleRegister, isAuthRestoring, logout, session, updateUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
