import { useQueries, useQuery } from "@tanstack/react-query";
import * as financeService from "../../services/financeService";
import { queryKeys } from "./queryKeys";

type MesAno = {
  mes: number;
  ano: number;
};

export function useExtratoMensal(mes: number, ano: number) {
  return useQuery({
    queryKey: queryKeys.extrato(mes, ano),
    queryFn: () => financeService.getExtratoMensal(mes, ano),
    enabled: mes >= 1 && mes <= 12 && ano > 0,
  });
}

export function useExtratosMensais(meses: MesAno[]) {
  return useQueries({
    queries: meses.map(({ mes, ano }) => ({
      queryKey: queryKeys.extrato(mes, ano),
      queryFn: () => financeService.getExtratoMensal(mes, ano),
      enabled: mes >= 1 && mes <= 12 && ano > 0,
    })),
  });
}

export function useFaturaMes(mes: number, ano: number) {
  return useQuery({
    queryKey: queryKeys.faturas(mes, ano),
    queryFn: () => financeService.getFaturasDoMes(mes, ano),
    enabled: mes >= 1 && mes <= 12 && ano > 0,
  });
}

export function useFaturasMensais(meses: MesAno[]) {
  return useQueries({
    queries: meses.map(({ mes, ano }) => ({
      queryKey: queryKeys.faturas(mes, ano),
      queryFn: () => financeService.getFaturasDoMes(mes, ano),
      enabled: mes >= 1 && mes <= 12 && ano > 0,
    })),
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: queryKeys.categorias,
    queryFn: financeService.listarCategorias,
  });
}

export function useCartoes() {
  return useQuery({
    queryKey: queryKeys.cartoes,
    queryFn: financeService.listarCartoesCredito,
  });
}
