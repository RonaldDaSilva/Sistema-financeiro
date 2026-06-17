import { publicApi } from './api';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from '../types/auth';

export async function login(request: LoginRequest) {
  const { data } = await publicApi.post<AuthResponse>('/api/auth/login', request);
  return data;
}

export async function register(request: RegisterRequest) {
  const { data } = await publicApi.post<AuthResponse>('/api/auth/cadastro', request);
  return data;
}

export async function refreshSession(refreshToken: string) {
  const { data } = await publicApi.post<AuthResponse>('/api/auth/refresh', {
    refreshToken,
  });

  return data;
}
