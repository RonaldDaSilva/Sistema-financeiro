import { useQueries, useQuery } from "@tanstack/react-query";
import * as financeService from "../../services/financeService";
import { hasUsableStoredAuth } from "../../services/authStorage";
import { queryKeys } from "./queryKeys";

type MesAno = {
  mes: number;
  ano: number;
};

export function useExtratoMensal(mes: number, ano: number) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.extrato(mes, ano),
    queryFn: () => financeService.getExtratoMensal(mes, ano),
    enabled: canFetch && mes >= 1 && mes <= 12 && ano > 0,
  });
}

export function useExtratosMensais(meses: MesAno[]) {
  const canFetch = hasUsableStoredAuth();

  return useQueries({
    queries: meses.map(({ mes, ano }) => ({
      queryKey: queryKeys.extrato(mes, ano),
      queryFn: () => financeService.getExtratoMensal(mes, ano),
      enabled: canFetch && mes >= 1 && mes <= 12 && ano > 0,
    })),
  });
}

export function useFaturaMes(mes: number, ano: number) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.faturas(mes, ano),
    queryFn: () => financeService.getFaturasDoMes(mes, ano),
    enabled: canFetch && mes >= 1 && mes <= 12 && ano > 0,
  });
}

export function useFaturasMensais(meses: MesAno[]) {
  const canFetch = hasUsableStoredAuth();

  return useQueries({
    queries: meses.map(({ mes, ano }) => ({
      queryKey: queryKeys.faturas(mes, ano),
      queryFn: () => financeService.getFaturasDoMes(mes, ano),
      enabled: canFetch && mes >= 1 && mes <= 12 && ano > 0,
    })),
  });
}

export function useCategorias() {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.categorias,
    queryFn: financeService.listarCategorias,
    enabled: canFetch,
  });
}

export function useCartoes() {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.cartoes,
    queryFn: financeService.listarCartoesCredito,
    enabled: canFetch,
  });
}
