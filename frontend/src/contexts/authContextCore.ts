import { createContext } from "react";
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest } from "../types/auth";

export type AuthContextValue = {
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  login: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  updateUser: (user: Partial<AuthUser>) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
