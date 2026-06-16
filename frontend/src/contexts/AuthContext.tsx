import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authService from '../services/authService';
import {
  AUTH_STORAGE_EVENT,
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
  touchSessionActivity,
} from '../services/authStorage';
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest } from '../types/auth';

type AuthContextValue = {
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  login: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  updateUser: (user: Partial<AuthUser>) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuth());
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

  const logout = useCallback(() => {
    clearStoredAuth();
    queryClient.clear();
    setSession(null);
  }, [queryClient]);

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
        logout();
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
      login: handleLogin,
      register: handleRegister,
      updateUser,
      logout,
    }),
    [handleLogin, handleRegister, logout, session, updateUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
