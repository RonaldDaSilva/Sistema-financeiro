import { api } from './api';
import type {
  CategoriaNotificacao,
  ConfiguracoesNotificacao,
  FiltroNotificacao,
  Notificacao,
  NotificacoesPaginadas,
} from '../types/notification';

export async function listar(
  pagina: number,
  filtro: FiltroNotificacao,
  categoria: CategoriaNotificacao,
  signal?: AbortSignal,
) {
  const { data } = await api.get<NotificacoesPaginadas>('/api/notificacoes', {
    params: {
      pagina,
      tamanhoPagina: 20,
      filtro,
      categoria: categoria ?? undefined,
    },
    signal,
  });
  return data;
}

export async function listarNaoLidas(signal?: AbortSignal) {
  const { data } = await api.get<Notificacao[]>('/api/notificacoes/nao-lidas', {
    signal,
  });
  return data;
}

export async function marcarTodasComoLidas() {
  await api.put('/api/notificacoes/marcar-como-lidas');
}

export async function marcarComoLida(id: string) {
  await api.put(`/api/notificacoes/${id}/marcar-como-lida`);
}

export async function obterConfiguracoes(signal?: AbortSignal) {
  const { data } = await api.get<ConfiguracoesNotificacao>(
    '/api/notificacoes/configuracoes',
    { signal },
  );
  return data;
}

export async function atualizarConfiguracoes(request: ConfiguracoesNotificacao) {
  const { data } = await api.put<ConfiguracoesNotificacao>(
    '/api/notificacoes/configuracoes',
    request,
  );

  return data;
}
