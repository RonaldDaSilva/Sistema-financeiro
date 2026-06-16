import { useQuery } from "@tanstack/react-query";
import * as notificationService from "../../services/notificationService";
import { queryKeys } from "./queryKeys";

export function useNotificacoesNaoLidas() {
  return useQuery({
    queryKey: queryKeys.notificacoesNaoLidas,
    queryFn: notificationService.listarNaoLidas,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useConfiguracoesNotificacao() {
  return useQuery({
    queryKey: queryKeys.configuracoesNotificacao,
    queryFn: notificationService.obterConfiguracoes,
  });
}
