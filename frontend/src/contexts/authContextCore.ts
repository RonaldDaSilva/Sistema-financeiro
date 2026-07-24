import { createContext } from "react";
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest } from "../types/auth";

export type AuthContextValue = {
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isAuthRestoring: boolean;
  login: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  updateUser: (user: Partial<AuthUser>) => void;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
