import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import * as financeService from "../../services/financeService";
import { hasUsableStoredAuth } from "../../services/authStorage";
import { queryKeys } from "./queryKeys";
import type {
  CampoOrdenacaoExtrato,
  DirecaoOrdenacao,
  StatusFiltro,
  TipoTransacaoFiltro,
} from "../../types/finance";
import type {
  DashboardInicioParams,
  RelatorioGraficosParams,
} from "../../services/financeService";

type MesAno = {
  mes: number;
  ano: number;
};

export function useExtratoMensal(
  mes: number,
  ano: number,
  apenasDivididas = false,
  status: StatusFiltro = "todos",
) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.extrato(mes, ano, apenasDivididas, status),
    queryFn: ({ signal }) =>
      financeService.getExtratoMensal(mes, ano, apenasDivididas, status, signal),
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
  status = "todos",
  categoriaIds = categoriaId ? [categoriaId] : [],
  statuses = status !== "todos" ? [status] : [],
  ordenarPor = "data",
  direcao = "desc",
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
  categoriaIds?: string[];
  status?: StatusFiltro;
  statuses?: StatusFiltro[];
  ordenarPor?: CampoOrdenacaoExtrato;
  direcao?: DirecaoOrdenacao;
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
      categoriaIds,
      statuses,
      ordenarPor,
      direcao,
    ),
    queryFn: ({ signal }) =>
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
        categoriaIds,
        statuses,
        ordenarPor,
        direcao,
      }, signal),
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
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        financeService.getExtratoMensal(mes, ano, apenasDivididas, "todos", signal),
      enabled: canFetch && mes >= 1 && mes <= 12 && ano > 0,
    })),
  });
}

export function useFaturaMes(mes: number, ano: number, enabled = true) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.faturas(mes, ano),
    queryFn: ({ signal }) => financeService.getFaturasDoMes(mes, ano, signal),
    enabled: enabled && canFetch && mes >= 1 && mes <= 12 && ano > 0,
  });
}

export function useRelatorioGraficos(
  params: RelatorioGraficosParams,
) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.relatorios(
      params.dataInicial,
      params.dataFinal,
      params.contaBancariaId ?? "",
      params.cartaoCreditoId ?? "",
      params.categoriaIds ?? [],
      params.tipoTransacao ?? "todos",
      params.status ?? "todos",
      params.somenteRecorrentes ?? false,
      params.somenteParceladas ?? false,
    ),
    queryFn: ({ signal }) =>
      financeService.getRelatorioGraficos(params, signal),
    enabled: canFetch && Boolean(params.dataInicial) && Boolean(params.dataFinal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardInicio(params: DashboardInicioParams = {}, enabled = true) {
  const canFetch = hasUsableStoredAuth();
  const categoriaIds = params.categoriaIds ?? [];
  const statuses = params.statuses ?? [];

  return useQuery({
    queryKey: queryKeys.dashboardInicio(
      params.dataInicial ?? "",
      params.dataFinal ?? "",
      params.tipoTransacao ?? "todos",
      categoriaIds,
      statuses,
    ),
    queryFn: ({ signal }) => financeService.getDashboardInicio(params, signal),
    enabled: enabled && canFetch,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });
}

export function useFaturasMensais(meses: MesAno[]) {
  const canFetch = hasUsableStoredAuth();

  return useQueries({
    queries: meses.map(({ mes, ano }) => ({
      queryKey: queryKeys.faturas(mes, ano),
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        financeService.getFaturasDoMes(mes, ano, signal),
      enabled: canFetch && mes >= 1 && mes <= 12 && ano > 0,
    })),
  });
}

export function useCategorias() {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.categorias,
    queryFn: ({ signal }) => financeService.listarCategorias(signal),
    enabled: canFetch,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCartoes(enabled = true) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.cartoes,
    queryFn: ({ signal }) => financeService.listarCartoesCredito(signal),
    enabled: enabled && canFetch,
    staleTime: 10 * 60 * 1000,
  });
}

export function useContas(enabled = true) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.contas,
    queryFn: ({ signal }) => financeService.listarContasBancarias(signal),
    enabled: enabled && canFetch,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useDistribuicaoContas(enabled = true) {
  const canFetch = hasUsableStoredAuth();

  return useQuery({
    queryKey: queryKeys.distribuicaoContas,
    queryFn: ({ signal }) => financeService.obterDistribuicaoContas(signal),
    enabled: enabled && canFetch,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
