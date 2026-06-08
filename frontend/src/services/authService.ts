import { api } from './api';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from '../types/auth';

export async function login(request: LoginRequest) {
  const { data } = await api.post<AuthResponse>('/api/auth/login', request);
  return data;
}

export async function register(request: RegisterRequest) {
  const { data } = await api.post<AuthResponse>('/api/auth/cadastro', request);
  return data;
}
