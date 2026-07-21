import { useQuery } from "@tanstack/react-query";
import * as notificationService from "../../services/notificationService";
import { hasUsableStoredAuth } from "../../services/authStorage";
import { queryKeys } from "./queryKeys";

export function useNotificacoesNaoLidas(enabled = true) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.notificacoesNaoLidas,
    queryFn: ({ signal }) => notificationService.listarNaoLidas(signal),
    enabled: enabled && canFetch,
    refetchInterval: canFetch ? 5 * 60 * 1000 : false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConfiguracoesNotificacao(enabled = true) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.configuracoesNotificacao,
    queryFn: ({ signal }) => notificationService.obterConfiguracoes(signal),
    enabled: enabled && canFetch,
    staleTime: 10 * 60 * 1000,
  });
}
