import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import * as financeService from "../../services/financeService";
import { hasUsableStoredAuth } from "../../services/authStorage";
import { queryKeys } from "./queryKeys";
import type { TipoTransacaoFiltro } from "../../types/finance";

type MesAno = {
  mes: number;
  ano: number;
};

export function useExtratoMensal(
  mes: number,
  ano: number,
  apenasDivididas = false,
) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.extrato(mes, ano, apenasDivididas),
    queryFn: () => financeService.getExtratoMensal(mes, ano, apenasDivididas),
    enabled: canFetch && mes >= 1 && mes <= 12 && ano > 0,
  });
}

export function useExtratoMensalPaginado({
  mes,
  ano,
  pageNumber,
  pageSize,
  dataInicial,
  dataFinal,
  apenasDivididas = false,
  tipoTransacao = "todos",
  categoriaId = null,
}: {
  mes: number;
  ano: number;
  pageNumber: number;
  pageSize: number;
  dataInicial?: string;
  dataFinal?: string;
  apenasDivididas?: boolean;
  tipoTransacao?: TipoTransacaoFiltro;
  categoriaId?: string | null;
}) {
  const canFetch = hasUsableStoredAuth();
  const tipo = tipoTransacao === "receita"
    ? 1
    : tipoTransacao === "despesa"
      ? 2
      : tipoTransacao === "investimento"
        ? 3
        : null;

  return useQuery({
    queryKey: queryKeys.extratoPaginado(
      mes,
      ano,
      dataInicial ?? "",
      dataFinal ?? "",
      pageNumber,
      pageSize,
      apenasDivididas,
      tipoTransacao,
      categoriaId,
    ),
    queryFn: () =>
      financeService.getExtratoMensalPaginado({
        mes,
        ano,
        dataInicial,
        dataFinal,
        pageNumber,
        pageSize,
        apenasDivididas,
        tipo,
        categoriaId,
      }),
    enabled: canFetch && mes >= 1 && mes <= 12 && ano > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExtratosMensais(meses: MesAno[], apenasDivididas = false) {
  const canFetch = hasUsableStoredAuth();

  return useQueries({
    queries: meses.map(({ mes, ano }) => ({
      queryKey: queryKeys.extrato(mes, ano, apenasDivididas),
      queryFn: () => financeService.getExtratoMensal(mes, ano, apenasDivididas),
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
    staleTime: 10 * 60 * 1000,
  });
}

export function useCartoes(enabled = true) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.cartoes,
    queryFn: financeService.listarCartoesCredito,
    enabled: enabled && canFetch,
    staleTime: 10 * 60 * 1000,
  });
}
