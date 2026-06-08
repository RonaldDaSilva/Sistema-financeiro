import { api } from './api';
import type {
  ChangePasswordRequest,
  DeleteAccountRequest,
  UpdateProfileRequest,
  UserProfile,
} from '../types/auth';

export async function obterPerfil() {
  const { data } = await api.get<UserProfile>('/api/usuarios/me');
  return data;
}

export async function atualizarPerfil(request: UpdateProfileRequest) {
  const { data } = await api.put<UserProfile>('/api/usuarios/me', request);
  return data;
}

export async function alterarSenha(request: ChangePasswordRequest) {
  await api.put('/api/usuarios/me/senha', request);
}

export async function excluirConta(request: DeleteAccountRequest) {
  await api.delete('/api/usuarios/me', { data: request });
}
