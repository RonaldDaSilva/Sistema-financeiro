import { api } from './api';
import type { ConfiguracoesNotificacao, Notificacao } from '../types/notification';

export async function listarNaoLidas() {
  const { data } = await api.get<Notificacao[]>('/api/notificacoes/nao-lidas');
  return data;
}

export async function marcarTodasComoLidas() {
  await api.put('/api/notificacoes/marcar-como-lidas');
}

export async function obterConfiguracoes() {
  const { data } = await api.get<ConfiguracoesNotificacao>('/api/notificacoes/configuracoes');
  return data;
}

export async function atualizarConfiguracoes(request: ConfiguracoesNotificacao) {
  const { data } = await api.put<ConfiguracoesNotificacao>(
    '/api/notificacoes/configuracoes',
    request,
  );

  return data;
}
