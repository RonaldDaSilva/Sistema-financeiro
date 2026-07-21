import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import * as financeService from "../../services/financeService";
import { queryKeys } from "../queries/queryKeys";
import type {
  CriarTransacaoRequest,
  ExtratoMensal,
  ExtratoMensalItem,
  PagedResponse,
} from "../../types/finance";

type AddTransacaoVariables = {
  request: CriarTransacaoRequest;
  optimisticItem: ExtratoMensalItem;
};

type EditTransacaoVariables = {
  id: string;
  request: CriarTransacaoRequest;
  replicarFuturas: boolean;
  optimisticItem: ExtratoMensalItem;
};

type CacheSnapshot = {
  extratos: Array<[QueryKey, ExtratoMensal | undefined]>;
  paginas: Array<[QueryKey, PagedResponse<ExtratoMensalItem> | undefined]>;
};

export function useAddTransacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ request }: AddTransacaoVariables) =>
      financeService.criarTransacao(request),
    onMutate: async ({ optimisticItem }) => {
      const snapshot = await snapshotAndCancel(queryClient);

      if (!optimisticItem.cartaoCreditoId) {
        addOptimisticItem(queryClient, optimisticItem);
      }

      return { snapshot, optimisticId: optimisticItem.id };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        restoreSnapshot(queryClient, context.snapshot);
      }
    },
    onSuccess: ({ id }, variables, context) => {
      if (context?.optimisticId) {
        replaceItemId(queryClient, context.optimisticId, id);
      }

      reconcileDerivedData(queryClient, variables.request);
    },
  });
}

export function useEditTransacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, request, replicarFuturas }: EditTransacaoVariables) =>
      financeService.atualizarTransacao(id, request, replicarFuturas),
    onMutate: async ({ id, optimisticItem }) => {
      const snapshot = await snapshotAndCancel(queryClient);

      if (!optimisticItem.cartaoCreditoId) {
        replaceOptimisticItem(queryClient, id, optimisticItem);
      }

      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        restoreSnapshot(queryClient, context.snapshot);
      }
    },
    onSuccess: (_response, variables) => {
      reconcileDerivedData(queryClient, variables.request);
    },
  });
}

async function snapshotAndCancel(queryClient: QueryClient): Promise<CacheSnapshot> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: queryKeys.extratoScope }),
    queryClient.cancelQueries({ queryKey: queryKeys.extratoPaginadoScope }),
  ]);

  return {
    extratos: queryClient.getQueriesData<ExtratoMensal>({
      queryKey: queryKeys.extratoScope,
    }),
    paginas: queryClient.getQueriesData<PagedResponse<ExtratoMensalItem>>({
      queryKey: queryKeys.extratoPaginadoScope,
    }),
  };
}

function restoreSnapshot(queryClient: QueryClient, snapshot: CacheSnapshot) {
  snapshot.extratos.forEach(([key, data]) => queryClient.setQueryData(key, data));
  snapshot.paginas.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

function addOptimisticItem(queryClient: QueryClient, item: ExtratoMensalItem) {
  queryClient
    .getQueriesData<ExtratoMensal>({ queryKey: queryKeys.extratoScope })
    .forEach(([key, current]) => {
      if (!current || !matchesExtratoFilter(key, item)) {
        return;
      }

      queryClient.setQueryData(key, applyExtratoMutation(current, null, item));
    });

  queryClient
    .getQueriesData<PagedResponse<ExtratoMensalItem>>({
      queryKey: queryKeys.extratoPaginadoScope,
    })
    .forEach(([key, current]) => {
      if (!current || !matchesPagedFilter(key, item)) {
        return;
      }

      const pageNumber = Number(key[5]);
      const pageSize = Number(key[6]);
      queryClient.setQueryData(key, {
        ...current,
        items:
          pageNumber === 1
            ? sortItems([item, ...current.items]).slice(0, pageSize)
            : current.items,
        totalCount: current.totalCount + 1,
        totalPages: Math.ceil((current.totalCount + 1) / pageSize),
      });
    });
}

function replaceOptimisticItem(
  queryClient: QueryClient,
  id: string,
  item: ExtratoMensalItem,
) {
  queryClient
    .getQueriesData<ExtratoMensal>({ queryKey: queryKeys.extratoScope })
    .forEach(([key, current]) => {
      if (!current) {
        return;
      }

      const previous = current.itens.find((entry) => entry.id === id) ?? null;
      const next = matchesExtratoFilter(key, item) ? item : null;

      if (previous || next) {
        queryClient.setQueryData(
          key,
          applyExtratoMutation(current, previous, next),
        );
      }
    });

  queryClient
    .getQueriesData<PagedResponse<ExtratoMensalItem>>({
      queryKey: queryKeys.extratoPaginadoScope,
    })
    .forEach(([key, current]) => {
      if (!current) {
        return;
      }

      const previousIndex = current.items.findIndex((entry) => entry.id === id);
      const shouldInclude = matchesPagedFilter(key, item);
      let items = current.items.filter((entry) => entry.id !== id);
      let totalCount = current.totalCount;

      if (previousIndex >= 0 && !shouldInclude) {
        totalCount -= 1;
      } else if (previousIndex < 0 && shouldInclude) {
        totalCount += 1;
      }

      if (shouldInclude && (Number(key[5]) === 1 || previousIndex >= 0)) {
        items = sortItems([item, ...items]).slice(0, Number(key[6]));
      }

      queryClient.setQueryData(key, {
        ...current,
        items,
        totalCount,
        totalPages:
          totalCount === 0 ? 0 : Math.ceil(totalCount / Number(key[6])),
      });
    });
}

function replaceItemId(queryClient: QueryClient, oldId: string, newId: string) {
  queryClient.setQueriesData<ExtratoMensal>(
    { queryKey: queryKeys.extratoScope },
    (current) =>
      current
        ? {
            ...current,
            itens: current.itens.map((item) =>
              item.id === oldId ? { ...item, id: newId } : item,
            ),
          }
        : current,
  );
  queryClient.setQueriesData<PagedResponse<ExtratoMensalItem>>(
    { queryKey: queryKeys.extratoPaginadoScope },
    (current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === oldId ? { ...item, id: newId } : item,
            ),
          }
        : current,
  );
}

function applyExtratoMutation(
  current: ExtratoMensal,
  previous: ExtratoMensalItem | null,
  next: ExtratoMensalItem | null,
): ExtratoMensal {
  const items = current.itens.filter((item) => item.id !== previous?.id);
  if (next) {
    items.push(next);
  }

  const previousImpact = previous ? signedValue(previous) : 0;
  const nextImpact = next ? signedValue(next) : 0;
  const globalDelta =
    (next && affectsCurrentBalance(next) ? signedValue(next) : 0) -
    (previous && affectsCurrentBalance(previous) ? signedValue(previous) : 0);

  return {
    ...current,
    totalReceitas:
      current.totalReceitas + typeValue(next, "receita") - typeValue(previous, "receita"),
    receitasDoMes:
      current.receitasDoMes + typeValue(next, "receita") - typeValue(previous, "receita"),
    totalDespesas:
      current.totalDespesas + typeValue(next, "despesa") - typeValue(previous, "despesa"),
    despesasDoMes:
      current.despesasDoMes + typeValue(next, "despesa") - typeValue(previous, "despesa"),
    totalInvestido:
      current.totalInvestido +
      typeValue(next, "investimento") -
      typeValue(previous, "investimento"),
    investimentosDoMes:
      current.investimentosDoMes +
      typeValue(next, "investimento") -
      typeValue(previous, "investimento"),
    saldo: current.saldo + nextImpact - previousImpact,
    balancoDoMes: current.balancoDoMes + nextImpact - previousImpact,
    saldoAtual: current.saldoAtual + globalDelta,
    saldoAtualGlobal: current.saldoAtualGlobal + globalDelta,
    itens: sortItems(items),
  };
}

function matchesExtratoFilter(key: QueryKey, item: ExtratoMensalItem) {
  const [, mes, ano, apenasDivididas] = key;
  const [itemAno, itemMes] = item.dataOcorrencia.split("-").map(Number);
  return (
    Number(mes) === itemMes &&
    Number(ano) === itemAno &&
    (!apenasDivididas || item.isDividida)
  );
}

function matchesPagedFilter(key: QueryKey, item: ExtratoMensalItem) {
  const dataInicial = String(key[3] ?? "");
  const dataFinal = String(key[4] ?? "");
  const apenasDivididas = Boolean(key[7]);
  const tipo = String(key[8] ?? "todos");
  const categoriaIds = splitQueryList(key[9]);
  const statuses = splitQueryList(key[10]);

  return (
    (!dataInicial || item.dataOcorrencia >= dataInicial) &&
    (!dataFinal || item.dataOcorrencia <= dataFinal) &&
    (!apenasDivididas || item.isDividida) &&
    (tipo === "todos" || tipo === itemType(item)) &&
    (categoriaIds.length === 0 ||
      (Boolean(item.categoriaId) && categoriaIds.includes(item.categoriaId!))) &&
    matchesStatusFilter(statuses, item)
  );
}

function matchesStatusFilter(statuses: string[], item: ExtratoMensalItem) {
  if (statuses.length === 0) {
    return true;
  }

  if (itemType(item) !== "despesa") {
    return false;
  }

  const visual = item.statusVisual || statusVisual(item);

  return statuses.some((status) =>
    (status === "pagas" && visual === "Paga") ||
    (status === "pendentes" && visual === "Pendente") ||
    (status === "atrasadas" && visual === "Atrasada"),
  );
}

function splitQueryList(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusVisual(item: ExtratoMensalItem) {
  if (item.isPaga) {
    return "Paga";
  }

  return item.dataOcorrencia < todayValue() ? "Atrasada" : "Pendente";
}

function itemType(item: ExtratoMensalItem) {
  if (item.tipo === 1 || item.tipo === "Receita") return "receita";
  if (item.tipo === 3 || item.tipo === "Investimento") return "investimento";
  return "despesa";
}

function typeValue(
  item: ExtratoMensalItem | null,
  type: "receita" | "despesa" | "investimento",
) {
  return item && itemType(item) === type ? item.valor : 0;
}

function signedValue(item: ExtratoMensalItem) {
  return itemType(item) === "receita" ? item.valor : -item.valor;
}

function affectsCurrentBalance(item: ExtratoMensalItem) {
  if (itemType(item) === "receita") {
    return item.dataOcorrencia <= todayValue();
  }

  return item.isPaga;
}

function todayValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function sortItems(items: ExtratoMensalItem[]) {
  return [...items].sort(
    (left, right) =>
      right.dataOcorrencia.localeCompare(left.dataOcorrencia) ||
      left.descricao.localeCompare(right.descricao),
  );
}

function reconcileDerivedData(
  queryClient: QueryClient,
  request: CriarTransacaoRequest,
) {
  const needsDerivedRefresh = Boolean(request.cartaoCreditoId || request.isFixa);

  void (async () => {
    if (needsDerivedRefresh) {
      await queryClient.refetchQueries({ queryKey: queryKeys.faturasScope, type: "active" });
      await queryClient.refetchQueries({ queryKey: queryKeys.extratoScope, type: "active" });
      await queryClient.refetchQueries({
        queryKey: queryKeys.extratoPaginadoScope,
        type: "active",
      });
    }

    if (request.cartaoCreditoId) {
      await queryClient.refetchQueries({ queryKey: queryKeys.cartoes, type: "active" });
    }

    if (request.contaBancariaId) {
      await queryClient.refetchQueries({
        queryKey: queryKeys.distribuicaoContas,
        type: "active",
      });
    }

    await queryClient.refetchQueries({ queryKey: queryKeys.dashboardScope, type: "active" });
  })();
}
