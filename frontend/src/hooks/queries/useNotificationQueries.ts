import { useQuery } from "@tanstack/react-query";
import * as notificationService from "../../services/notificationService";
import { hasUsableStoredAuth } from "../../services/authStorage";
import { queryKeys } from "./queryKeys";

export function useNotificacoesNaoLidas() {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.notificacoesNaoLidas,
    queryFn: notificationService.listarNaoLidas,
    enabled: canFetch,
    refetchInterval: canFetch ? 5 * 60 * 1000 : false,
  });
}

export function useConfiguracoesNotificacao() {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.configuracoesNotificacao,
    queryFn: notificationService.obterConfiguracoes,
    enabled: canFetch,
  });
}
