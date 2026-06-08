import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as authService from '../services/authService';
import {
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
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
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuth());

  const persistSession = useCallback((nextSession: AuthSession) => {
    setStoredAuth(nextSession);
    setSession(nextSession);
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
    setSession(null);
  }, []);

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
