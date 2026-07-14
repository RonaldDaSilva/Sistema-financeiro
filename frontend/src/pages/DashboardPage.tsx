import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Eye,
  EyeOff,
  Plus,
  TrendingDown,
  TrendingUp,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { NewTransactionModal } from "../components/NewTransactionModal";
import { PeriodFilter } from "../components/PeriodFilter";
import { PaymentConfirmationModal } from "../components/PaymentConfirmationModal";
import { TransactionList } from "../components/TransactionList";
import { DashboardInicioPanel } from "../components/dashboard/DashboardInicioPanel";
import { useAuth } from "../contexts/AuthContext";
import {
  useCartoes,
  useCategorias,
  useContas,
  useExtratoMensalPaginado,
  useExtratosMensais,
  useFaturasMensais,
} from "../hooks/queries/useFinanceQueries";
import { useConfiguracoesNotificacao } from "../hooks/queries/useNotificationQueries";
import { queryKeys } from "../hooks/queries/queryKeys";
import {
  useAddTransacao,
  useEditTransacao,
} from "../hooks/mutations/useTransactionMutations";
import * as financeService from "../services/financeService";
import type {
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
  Categoria,
  CartaoCredito,
  CampoOrdenacaoExtrato,
  DirecaoOrdenacao,
  ExtratoMensal,
  ExtratoMensalItem,
  FaturaConsolidada,
  PagedResponse,
  PeriodoFiltro,
  StatusFiltro,
  TipoTransacaoFiltro,
} from "../types/finance";
import {
  addDays,
  formatCurrency,
  getMonthsBetween,
  parseLocalDate,
  toDateInputValue,
} from "../utils/date";
import { AnticipateInstallmentModal } from "../components/AnticipateInstallmentModal";

export function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const addTransacaoMutation = useAddTransacao();
  const editTransacaoMutation = useEditTransacao();
  const { confirm, dialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const hoje = new Date();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(() =>
    obterPeriodoInicial(searchParams, hoje),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<ExtratoMensalItem | null>(null);
  const [payingTransaction, setPayingTransaction] =
    useState<ExtratoMensalItem | null>(null);
  const [faturaChequeEspecial, setFaturaChequeEspecial] =
    useState<ExtratoMensalItem | null>(null);
  const [anticipatingInstallment, setAnticipatingInstallment] =
    useState<ExtratoMensalItem | null>(null);
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [toastErro, setToastErro] = useState<string | null>(null);
  const [apenasDivididas, setApenasDivididas] = useState(false);
  const [statusesFiltro, setStatusesFiltro] = useState<StatusFiltro[]>(() =>
    obterStatusesIniciais(searchParams),
  );
  const [paginaMovimentacoes, setPaginaMovimentacoes] = useState(1);
  const [ordenacao, setOrdenacao] = useState<{
    campo: CampoOrdenacaoExtrato;
    direcao: DirecaoOrdenacao;
  }>({ campo: "data", direcao: "desc" });
  const pageSizeMovimentacoes = 25;
  const [valoresOcultos, setValoresOcultos] = useState(() => {
    return localStorage.getItem("dashboard-values-hidden") === "true";
  });

  useEffect(() => {
    localStorage.setItem("dashboard-values-hidden", String(valoresOcultos));
  }, [valoresOcultos]);

  const rangePeriodo = useMemo(() => obterRangePeriodo(periodo), [periodo]);
  const categoriaIdsFiltro = useMemo(
    () => obterCategoriaIdsPeriodo(periodo),
    [periodo],
  );
  const mesesPeriodo = useMemo(
    () => getMonthsBetween(rangePeriodo.inicio, rangePeriodo.fim),
    [rangePeriodo],
  );
  const categoriasQuery = useCategorias();
  const cartoesQuery = useCartoes(isModalOpen);
  const contasQuery = useContas(isModalOpen || Boolean(payingTransaction));
  const configuracoesQuery = useConfiguracoesNotificacao(isModalOpen);
  const extratosQueries = useExtratosMensais(mesesPeriodo, apenasDivididas);
  const extratoPaginadoQuery = useExtratoMensalPaginado({
    mes: mesesPeriodo[0]?.mes ?? hoje.getMonth() + 1,
    ano: mesesPeriodo[0]?.ano ?? hoje.getFullYear(),
    dataInicial: toDateInputValue(rangePeriodo.inicio),
    dataFinal: toDateInputValue(rangePeriodo.fim),
    pageNumber: paginaMovimentacoes,
    pageSize: pageSizeMovimentacoes,
    apenasDivididas,
    tipoTransacao: periodo.tipoTransacao ?? "todos",
    categoriaIds: categoriaIdsFiltro,
    statuses: statusesFiltro,
    ordenarPor: ordenacao.campo,
    direcao: ordenacao.direcao,
  });
  const faturasQueries = useFaturasMensais(mesesPeriodo);
  const categorias = categoriasQuery.data ?? [];
  const cartoes = cartoesQuery.data ?? [];
  const contas = contasQuery.data ?? [];
  const percentualPadraoDivisao =
    configuracoesQuery.data?.percentualPadraoDivisao ?? 50;
  const isLoading = [
    categoriasQuery,
    ...extratosQueries,
    ...faturasQueries,
    extratoPaginadoQuery,
  ].some((query) => query.isLoading);
  const hasLoadError = [
    categoriasQuery,
    ...extratosQueries,
    ...faturasQueries,
    extratoPaginadoQuery,
  ].some((query) => query.isError);

  useEffect(() => {
    setPaginaMovimentacoes(1);
  }, [
    apenasDivididas,
    categoriaIdsFiltro,
    periodo.tipoTransacao,
    rangePeriodo.fim,
    rangePeriodo.inicio,
    statusesFiltro,
  ]);

  const faturas = useMemo(() => {
    return faturasQueries
      .flatMap((query) => query.data ?? [])
      .filter((fatura) => {
        const data = parseLocalDate(fatura.dataVencimento);
        return data >= rangePeriodo.inicio && data <= rangePeriodo.fim;
      });
  }, [faturasQueries, rangePeriodo.fim, rangePeriodo.inicio]);

  const movimentacoesPaginadas = useMemo(() => {
    const items = [...(extratoPaginadoQuery.data?.items ?? [])];
    const direction = ordenacao.direcao === "asc" ? 1 : -1;

    return items.sort((left, right) => {
      let comparison = 0;

      switch (ordenacao.campo) {
        case "movimentacao":
          comparison = left.descricao.localeCompare(right.descricao, "pt-BR", {
            sensitivity: "base",
          });
          break;
        case "categoria":
          comparison = left.categoriaNome.localeCompare(
            right.categoriaNome,
            "pt-BR",
            { sensitivity: "base" },
          );
          break;
        case "valor":
          comparison = left.valor - right.valor;
          break;
        default:
          comparison = left.dataOcorrencia.localeCompare(right.dataOcorrencia);
          break;
      }

      return (
        comparison * direction ||
        left.descricao.localeCompare(right.descricao, "pt-BR", {
          sensitivity: "base",
        })
      );
    });
  }, [
    extratoPaginadoQuery.data?.items,
    ordenacao.campo,
    ordenacao.direcao,
  ]);
  const totalPaginasMovimentacoes = extratoPaginadoQuery.data?.totalPages ?? 0;
  const totalMovimentacoes = extratoPaginadoQuery.data?.totalCount ?? 0;

  async function invalidarDadosFinanceiros() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["extrato"] }),
      queryClient.invalidateQueries({ queryKey: ["extrato-paginado"] }),
      queryClient.invalidateQueries({ queryKey: ["faturas"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.contas }),
      queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  }

  const pagarFaturaMutation = useMutation({
    mutationFn: ({
      item,
      confirmarSemSaldo,
    }: {
      item: ExtratoMensalItem;
      confirmarSemSaldo: boolean;
    }) => {
      if (!item.cartaoCreditoId) {
        throw new Error("Fatura sem cartão vinculado.");
      }

      return financeService.alternarStatusFatura(
        item.cartaoCreditoId,
        item.dataOcorrencia,
        { confirmarSemSaldo },
      );
    },
    onMutate: async ({ item }) => {
      if (!item.cartaoCreditoId) {
        return { item, previousStatus: item.isPaga, nextStatus: item.isPaga };
      }

      const nextStatus = !item.isPaga;
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["faturas"] }),
        queryClient.cancelQueries({ queryKey: ["extrato"] }),
        queryClient.cancelQueries({ queryKey: ["extrato-paginado"] }),
      ]);

      atualizarStatusFaturaLocal(
        item.cartaoCreditoId,
        item.dataOcorrencia,
        nextStatus,
      );
      aplicarImpactoSaldoGlobalLocal(item, item.isPaga, nextStatus);
      setToastErro(null);

      return { item, previousStatus: item.isPaga, nextStatus };
    },
    onError: (error, { item }, context) => {
      if (item.cartaoCreditoId && context) {
        atualizarStatusFaturaLocal(
          item.cartaoCreditoId,
          item.dataOcorrencia,
          context.previousStatus,
        );
        aplicarImpactoSaldoGlobalLocal(item, context.nextStatus, context.previousStatus);
      }

      if (isSaldoInsuficienteError(error)) {
        setFaturaChequeEspecial(item);
        return;
      }

      setToastErro("Não foi possível atualizar o status da fatura.");
      window.setTimeout(() => setToastErro(null), 3500);
    },
    onSuccess: async (response, { item }) => {
      if (item.cartaoCreditoId) {
        atualizarStatusFaturaLocal(
          item.cartaoCreditoId,
          item.dataOcorrencia,
          response.isPaga,
        );
      }

      setFaturaChequeEspecial(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["faturas"] }),
        queryClient.invalidateQueries({ queryKey: ["extrato"] }),
        queryClient.invalidateQueries({ queryKey: ["extrato-paginado"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.contas }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cartoes }),
        queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });

  function handlePeriodoChange(nextPeriodo: PeriodoFiltro) {
    setPeriodo(nextPeriodo);

    const range = obterRangePeriodo(nextPeriodo);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("inicio", toDateInputValue(range.inicio));
    nextParams.set("fim", toDateInputValue(range.fim));

    const tipoTransacao = nextPeriodo.tipoTransacao ?? "todos";
    const categoriaIds = obterCategoriaIdsPeriodo(nextPeriodo);
    tipoTransacao === "todos"
      ? nextParams.delete("tipo")
      : nextParams.set("tipo", tipoTransacao);
    if (categoriaIds.length > 0) {
      nextParams.set("categorias", categoriaIds.join(","));
      nextParams.set("categoria", categoriaIds[0]);
    } else {
      nextParams.delete("categorias");
      nextParams.delete("categoria");
    }

    setSearchParams(nextParams, { replace: true });
  }

  function handleStatusesChange(nextStatuses: StatusFiltro[]) {
    const statuses = normalizarStatuses(nextStatuses);
    setStatusesFiltro(statuses);

    const nextParams = new URLSearchParams(searchParams);
    if (statuses.length > 0) {
      nextParams.set("status", statuses.join(","));
    } else {
      nextParams.delete("status");
    }
    setSearchParams(nextParams, { replace: true });
  }

  const resumoApi = useMemo(() => {
    const extratos = extratosQueries
      .map((query, index) => {
        const data = query.data;
        const referencia = mesesPeriodo[index];

        return data &&
          referencia &&
          data.mes === referencia.mes &&
          data.ano === referencia.ano
          ? data
          : null;
      })
      .filter((data): data is ExtratoMensal => Boolean(data));

    return extratos.reduce(
      (acc, item) => {
        acc.totalRecebido += item.receitasDoMes ?? item.totalReceitas;
        acc.totalGasto += item.despesasDoMes ?? item.totalDespesas;
        acc.totalInvestido += item.investimentosDoMes ?? item.totalInvestido;
        acc.balancoDoMes +=
          item.balancoDoMes ??
          (item.totalReceitas - item.totalDespesas - item.totalInvestido);

        if (acc.saldoAtualGlobal === null) {
          acc.saldoAtualGlobal = item.saldoAtualGlobal ?? item.saldoAtual;
        }

        if (acc.saldoPrevistoFimDoMes === null) {
          acc.saldoPrevistoFimDoMes = item.saldoPrevistoFimDoMes;
        }

        return acc;
      },
      {
        totalGasto: 0,
        totalRecebido: 0,
        totalInvestido: 0,
        balancoDoMes: 0,
        saldoAtualGlobal: null as number | null,
        saldoPrevistoFimDoMes: null as number | null,
      },
    );
  }, [extratosQueries, mesesPeriodo]);

  const resumo = {
    totalGasto: resumoApi.totalGasto,
    totalRecebido: resumoApi.totalRecebido,
    totalInvestido: resumoApi.totalInvestido,
    balancoDoMes: resumoApi.balancoDoMes,
    saldoAtualGlobal: resumoApi.saldoAtualGlobal ?? 0,
    saldoPrevistoFimDoMes: resumoApi.saldoPrevistoFimDoMes ?? 0,
  };

  const resumoDivididas = useMemo(() => {
    return extratosQueries.reduce(
      (acc, item) => {
        const resumo = item.data?.resumoDivididas;
        if (!resumo) {
          return acc;
        }

        acc.totalSuaParte += resumo.totalSuaParte;
        acc.totalOriginal += resumo.totalOriginal;
        return acc;
      },
      {
        totalSuaParte: 0,
        totalOriginal: 0,
      },
    );
  }, [extratosQueries]);

  const periodoExportacao = useMemo(() => {
    const range = obterRangePeriodo(periodo);

    return {
      dataInicial: toDateInputValue(range.inicio),
      dataFinal: toDateInputValue(range.fim),
      categoriaId: periodo.categoriaId ?? null,
      tipoTransacao: periodo.tipoTransacao ?? "todos",
    };
  }, [periodo]);

  async function handleCreateTransacao(request: CriarTransacaoRequest) {
    await addTransacaoMutation.mutateAsync({
      request,
      optimisticItem: criarItemOtimista(
        `optimistic-${crypto.randomUUID()}`,
        request,
        null,
        categorias,
        cartoes,
      ),
    });
  }

  async function handleUpdateTransacao(
    id: string,
    request: CriarTransacaoRequest,
  ) {
    let replicarFuturas = true;

    if (editingTransaction?.isFixa) {
      replicarFuturas = await confirm({
        title: "Editar transação fixa",
        message:
          "Deseja aplicar esta alteração também para os meses seguintes? Se escolher somente este mês, as próximas ocorrências continuam com os dados atuais.",
        confirmLabel: "Replicar futuras",
        cancelLabel: "Somente este mês",
      });
    }

    await editTransacaoMutation.mutateAsync({
      id,
      request,
      replicarFuturas,
      optimisticItem: criarItemOtimista(
        id,
        request,
        editingTransaction,
        categorias,
        cartoes,
      ),
    });
  }

  async function handleUpdateCompraParcelada(
    id: string,
    numeroParcela: number,
    dataOcorrencia: string,
    request: CriarCompraParceladaRequest,
  ) {
    await financeService.atualizarCompraParceladaProjetada(
      id,
      numeroParcela,
      dataOcorrencia,
      request,
    );
    await invalidarDadosFinanceiros();
  }

  async function handleDeleteTransacao(item: ExtratoMensalItem) {
    if (
      (item.origem === "CompraParcelada" || item.origem === "Carne") &&
      item.compraParceladaId &&
      item.numeroParcela
    ) {
      const confirmed = await confirm({
        title: "Excluir parcela",
        message: `Excluir "${item.descricao}" da parcela ${item.numeroParcela} em diante?`,
        confirmLabel: "Excluir",
        variant: "danger",
      });

      if (!confirmed) {
        return;
      }

      await financeService.excluirCompraParceladaProjetada(
        item.compraParceladaId,
        item.numeroParcela,
      );
      await invalidarDadosFinanceiros();
      return;
    }

    if (!item.id || (item.isProjetada && !item.isFixa)) {
      return;
    }

    let replicarFuturas = true;

    if (item.isFixa) {
      replicarFuturas = await confirm({
        title: "Excluir transação fixa",
        message:
          "Deseja excluir também as ocorrências dos meses seguintes? Se escolher somente este mês, as próximas ocorrências continuam aparecendo normalmente.",
        confirmLabel: "Excluir futuras",
        cancelLabel: "Somente este mês",
        variant: "danger",
      });
    } else {
      const confirmed = await confirm({
        title: item.isProjetada ? "Excluir recorrência" : "Excluir transação",
        message: item.isProjetada
          ? `Excluir a recorrência "${item.descricao}" a partir desta ocorrência?`
          : `Excluir a transação "${item.descricao}"?`,
        confirmLabel: "Excluir",
        variant: "danger",
      });
      if (!confirmed) {
        return;
      }
    }

    await financeService.excluirTransacao(
      item.id,
      item.isProjetada || item.isFixa ? item.dataOcorrencia : undefined,
      replicarFuturas,
    );
    await invalidarDadosFinanceiros();
  }

  async function handleCreateCompraParcelada(
    request: CriarCompraParceladaRequest,
  ) {
    await financeService.criarCompraParcelada(request);
    await invalidarDadosFinanceiros();
  }

  async function handleAnteciparParcela(request: {
    idCompraParcelada: string;
    numeroParcela: number;
    dataAntecipacao: string;
    valorPago: number;
  }) {
    let anteciparParcelasFuturas = false;

    if (
      anticipatingInstallment?.numeroParcela &&
      anticipatingInstallment?.quantidadeParcelas &&
      anticipatingInstallment.numeroParcela <
        anticipatingInstallment.quantidadeParcelas
    ) {
      anteciparParcelasFuturas = await confirm({
        title: "Antecipar próximas parcelas?",
        message:
          "Esta compra possui parcelas nos meses seguintes. Deseja antecipar também todas as parcelas futuras ainda pendentes?",
        confirmLabel: "Antecipar futuras",
        cancelLabel: "Somente esta parcela",
      });
    }

    const transacoesAntecipadas = await financeService.anteciparParcela({
      ...request,
      anteciparParcelasFuturas,
    });
    aplicarImpactoAntecipacaoLocal(transacoesAntecipadas);
    await invalidarDadosFinanceiros();
  }

  function atualizarStatusPagamentoLocal(
    id: string,
    isPaga: boolean,
    dataOcorrencia?: string,
    contaBancariaId?: string | null,
  ) {
    atualizarStatusPagamentoCaches(
      (item) => item.id === id &&
        (!dataOcorrencia || item.dataOcorrencia === dataOcorrencia),
      isPaga,
      contaBancariaId,
    );
  }

  function atualizarStatusPagamentoCaches(
    matchesItem: (item: ExtratoMensalItem) => boolean,
    isPaga: boolean,
    contaBancariaId?: string | null,
  ) {
    queryClient.getQueriesData<ExtratoMensal>({ queryKey: ["extrato"] })
      .forEach(([queryKey, current]) => {
        if (!current) {
          return;
        }

        queryClient.setQueryData<ExtratoMensal>(queryKey, {
          ...current,
          itens: current.itens
            .map((item) =>
              matchesItem(item)
                ? atualizarStatusItem(item, isPaga, contaBancariaId)
                : item,
            )
            .filter((item) => itemCombinaComStatusQuery(queryKey, item)),
        });
      });

    queryClient.getQueriesData<PagedResponse<ExtratoMensalItem>>({
      queryKey: ["extrato-paginado"],
    }).forEach(([queryKey, current]) => {
      if (!current) {
        return;
      }

      const items = current.items
        .map((item) =>
          matchesItem(item)
            ? atualizarStatusItem(item, isPaga, contaBancariaId)
            : item,
        )
        .filter((item) => itemCombinaComStatusQuery(queryKey, item));
      const removedFromPage = current.items.length - items.length;

      queryClient.setQueryData<PagedResponse<ExtratoMensalItem>>(queryKey, {
        ...current,
        items,
        totalCount: Math.max(0, current.totalCount - removedFromPage),
      });
    });
  }

  function aplicarImpactoSaldoGlobalLocal(
    item: ExtratoMensalItem,
    isPagaAnterior: boolean,
    isPagaAtual: boolean,
  ) {
    const isReceita = item.tipo === 1 || item.tipo === "Receita";

    if (isReceita || isPagaAnterior === isPagaAtual) {
      return;
    }

    const multiplicador = isPagaAtual ? -1 : 1;
    const impacto = item.valor * multiplicador;

    queryClient.setQueriesData<ExtratoMensal>(
      { queryKey: ["extrato"] },
      (current) =>
        current
          ? {
              ...current,
              saldoAtual: current.saldoAtual + impacto,
              saldoAtualGlobal:
                (current.saldoAtualGlobal ?? current.saldoAtual) + impacto,
            }
          : current,
    );
  }

  function aplicarImpactoAntecipacaoLocal(
    transacoes: Array<{
      tipo: CriarTransacaoRequest["tipo"] | "Receita" | "Despesa" | "Investimento";
      valor: number;
      dataOcorrencia: string;
      isPaga: boolean;
    }>,
  ) {
    const impacto = transacoes.reduce((total, transacao) => {
      const isReceita = transacao.tipo === 1 || transacao.tipo === "Receita";

      if (isReceita || !transacao.isPaga) {
        return total;
      }

      return total - transacao.valor;
    }, 0);

    if (impacto === 0) {
      return;
    }

    queryClient.setQueriesData<ExtratoMensal>(
      { queryKey: ["extrato"] },
      (current) =>
        current
          ? {
              ...current,
              saldoAtual: current.saldoAtual + impacto,
              saldoAtualGlobal:
                (current.saldoAtualGlobal ?? current.saldoAtual) + impacto,
            }
          : current,
    );
  }

  function atualizarStatusFaturaLocal(
    cartaoCreditoId: string,
    dataVencimento: string,
    isPaga: boolean,
  ) {
    atualizarStatusPagamentoCaches(
      (item) =>
        item.origem === "FaturaCartao" &&
        item.cartaoCreditoId === cartaoCreditoId &&
        item.dataOcorrencia === dataVencimento,
      isPaga,
    );
    queryClient.setQueriesData<FaturaConsolidada[]>(
      { queryKey: ["faturas"] },
      (current) =>
        current?.map((fatura) =>
          fatura.cartaoCreditoId === cartaoCreditoId &&
          fatura.dataVencimento === dataVencimento
            ? { ...fatura, isPaga }
            : fatura,
        ),
    );
  }

  async function handleTogglePagamento(item: ExtratoMensalItem) {
    if (!item.isPaga && item.origem !== "FaturaCartao") {
      setPayingTransaction(item);
      return;
    }

    if (
      item.origem === "Carne" &&
      item.isProjetada &&
      item.compraParceladaId &&
      item.numeroParcela
    ) {
      setToastErro(null);
      aplicarImpactoSaldoGlobalLocal(item, item.isPaga, true);

      try {
        await financeService.anteciparParcela({
          idCompraParcelada: item.compraParceladaId,
          numeroParcela: item.numeroParcela,
          dataAntecipacao: item.dataOcorrencia,
          valorPago: item.valor,
          anteciparParcelasFuturas: false,
        });
        await invalidarDadosFinanceiros();
      } catch {
        aplicarImpactoSaldoGlobalLocal(item, true, item.isPaga);
        setToastErro("Não foi possível marcar a parcela de carnê como paga.");
        window.setTimeout(() => setToastErro(null), 3500);
      }

      return;
    }

    if (item.origem === "FaturaCartao" && item.cartaoCreditoId) {
      pagarFaturaMutation.mutate({ item, confirmarSemSaldo: false });
      return;
    }

    if (!item.id) {
      return;
    }

    const nextStatus = !item.isPaga;
    const dataOcorrenciaStatus = item.isFixa ? item.dataOcorrencia : undefined;
    atualizarStatusPagamentoLocal(item.id, nextStatus, dataOcorrenciaStatus);
    aplicarImpactoSaldoGlobalLocal(item, item.isPaga, nextStatus);
    setToastErro(null);

    try {
      const response = await financeService.alternarStatusPagamento(
        item.id,
        dataOcorrenciaStatus,
        { isPaga: nextStatus },
      );
      aplicarImpactoSaldoGlobalLocal(item, nextStatus, response.isPaga);
      atualizarStatusPagamentoLocal(item.id, response.isPaga, dataOcorrenciaStatus);
    } catch {
      atualizarStatusPagamentoLocal(item.id, item.isPaga, dataOcorrenciaStatus);
      aplicarImpactoSaldoGlobalLocal(item, nextStatus, item.isPaga);
      setToastErro("Não foi possível atualizar o status de pagamento.");
      window.setTimeout(() => setToastErro(null), 3500);
    }
  }

  async function handleConfirmarPagamento(contaBancariaId: string | null) {
    const item = payingTransaction;
    if (!item) {
      return;
    }

    if (
      item.origem === "Carne" &&
      item.isProjetada &&
      item.compraParceladaId &&
      item.numeroParcela
    ) {
      setToastErro(null);
      aplicarImpactoSaldoGlobalLocal(item, item.isPaga, true);

      try {
        await financeService.anteciparParcela({
          idCompraParcelada: item.compraParceladaId,
          numeroParcela: item.numeroParcela,
          dataAntecipacao: item.dataOcorrencia,
          valorPago: item.valor,
          contaBancariaId,
          anteciparParcelasFuturas: false,
        });
        await invalidarDadosFinanceiros();
      } catch {
        aplicarImpactoSaldoGlobalLocal(item, true, item.isPaga);
        setToastErro("Não foi possível marcar a parcela de carnê como paga.");
        window.setTimeout(() => setToastErro(null), 3500);
        throw new Error("Falha ao baixar carnê.");
      }

      return;
    }

    if (!item.id) {
      return;
    }

    const dataOcorrenciaStatus = item.isFixa ? item.dataOcorrencia : undefined;
    atualizarStatusPagamentoLocal(item.id, true, dataOcorrenciaStatus, contaBancariaId);
    aplicarImpactoSaldoGlobalLocal(item, item.isPaga, true);
    setToastErro(null);

    try {
      const response = await financeService.alternarStatusPagamento(
        item.id,
        dataOcorrenciaStatus,
        { isPaga: true, contaBancariaId },
      );
      aplicarImpactoSaldoGlobalLocal(item, true, response.isPaga);
      atualizarStatusPagamentoLocal(
        item.id,
        response.isPaga,
        dataOcorrenciaStatus,
        contaBancariaId,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["extrato"] }),
        queryClient.invalidateQueries({ queryKey: ["extrato-paginado"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.contas }),
        queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } catch {
      atualizarStatusPagamentoLocal(item.id, item.isPaga, dataOcorrenciaStatus);
      aplicarImpactoSaldoGlobalLocal(item, true, item.isPaga);
      setToastErro("Não foi possível atualizar o status de pagamento.");
      window.setTimeout(() => setToastErro(null), 3500);
      throw new Error("Falha ao baixar transação.");
    }
  }

  async function handleExportar(formato: "excel" | "pdf") {
    setExportando(formato);
    setErro(null);

    try {
      const blob =
        formato === "excel"
          ? await financeService.exportarExtratoExcel(periodoExportacao)
          : await financeService.exportarExtratoPdf(periodoExportacao);

      baixarArquivo(
        blob,
        criarNomeArquivoExportacao(
          periodoExportacao.dataInicial,
          periodoExportacao.dataFinal,
          formato === "excel" ? "xlsx" : "pdf",
        ),
      );
    } catch {
      setErro("Não foi possível exportar o relatório.");
    } finally {
      setExportando(null);
    }
  }

  return (
    <AppLayout>
      <section className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 md:space-y-8 md:py-8 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
              Início
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Olá, {user?.nome}
            </h2>
          </div>
          <div className="flex w-full gap-2 md:w-auto">
            <button
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] text-slate-600 shadow-sm transition hover:bg-[var(--app-card-muted)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 md:w-auto md:px-4"
              type="button"
              onClick={() => setValoresOcultos((current) => !current)}
              aria-pressed={valoresOcultos}
              aria-label={valoresOcultos ? "Mostrar valores" : "Ocultar valores"}
            >
              {valoresOcultos ? <Eye size={18} /> : <EyeOff size={18} />}
              <span className="ml-2 hidden md:inline">
                {valoresOcultos ? "Mostrar" : "Ocultar"}
              </span>
            </button>
            <button
              className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[var(--app-accent)] px-5 font-medium text-[var(--app-accent-contrast)] shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-95 dark:bg-white dark:text-slate-950 md:flex-none"
              type="button"
              onClick={() => {
                setEditingTransaction(null);
                setIsModalOpen(true);
              }}
            >
              <Plus size={18} className="mr-2" />
              Nova transação
            </button>
          </div>
        </div>

        <div className="relative z-30 flex flex-col gap-2 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:gap-4 lg:p-3">
          <PeriodFilter
            value={periodo}
            categorias={categorias}
            statuses={statusesFiltro}
            onChange={handlePeriodoChange}
            onStatusesChange={handleStatusesChange}
          />
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <button
              className="flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={Boolean(exportando)}
              onClick={() => handleExportar("excel")}
            >
              <FileSpreadsheet size={17} className="mr-2" />
              {exportando === "excel" ? "Baixando..." : "Excel"}
            </button>
            <button
              className="flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={Boolean(exportando)}
              onClick={() => handleExportar("pdf")}
            >
              <FileText size={17} className="mr-2" />
              {exportando === "pdf" ? "Baixando..." : "PDF"}
            </button>
          </div>
        </div>

        {apenasDivididas ? (
          <div className="relative z-10 grid gap-6 md:grid-cols-2">
            <ResumoCard
              label="Sua parte nestas despesas"
              value={resumoDivididas.totalSuaParte}
              tone="investment"
              icon="shared"
              hiddenValues={valoresOcultos}
            />
            <ResumoCard
              label="Valor total original"
              value={resumoDivididas.totalOriginal}
              tone="danger"
              icon="expense"
              hiddenValues={valoresOcultos}
            />
          </div>
        ) : (
          <DashboardInicioPanel hiddenValues={valoresOcultos} />
        )}

        <div id="movimentacoes-recentes" className="space-y-3 scroll-mt-24">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Movimentações recentes
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-all ${
                  apenasDivididas
                    ? "border-violet-300 bg-violet-50 text-violet-700 shadow-sm dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
                    : "border-[color:var(--app-card-border)] bg-[var(--app-card)] text-slate-600 hover:bg-[var(--app-card-muted)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
                type="button"
                aria-pressed={apenasDivididas}
                onClick={() => setApenasDivididas((current) => !current)}
              >
                <UsersRound size={16} />
                Apenas Divididas
              </button>
              {isLoading && (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Carregando...
                </span>
              )}
            </div>
          </div>
          {(erro || hasLoadError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {erro ?? "Não foi possível carregar os dados da Dashboard."}
            </div>
          )}
          {!isLoading && (
            <>
              <TransactionList
                items={movimentacoesPaginadas}
                faturas={faturas}
                ordenacao={ordenacao}
                onOrdenar={(campo) => {
                  setPaginaMovimentacoes(1);
                  setOrdenacao((current) => ({
                    campo,
                    direcao:
                      current.campo === campo && current.direcao === "asc"
                        ? "desc"
                        : "asc",
                  }));
                }}
                onEdit={(item) => {
                  setEditingTransaction(item);
                  setIsModalOpen(true);
                }}
                onDelete={handleDeleteTransacao}
                onAnticipate={setAnticipatingInstallment}
                onTogglePagamento={handleTogglePagamento}
              />
              {totalMovimentacoes > pageSizeMovimentacoes && (
                <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Página {paginaMovimentacoes} de {totalPaginasMovimentacoes} •{" "}
                    {totalMovimentacoes} movimentações
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="rounded-xl border border-[color:var(--app-card-border)] px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
                      type="button"
                      disabled={paginaMovimentacoes <= 1}
                      onClick={() =>
                        setPaginaMovimentacoes((current) => Math.max(1, current - 1))
                      }
                    >
                      Anterior
                    </button>
                    <button
                      className="rounded-xl border border-[color:var(--app-card-border)] px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
                      type="button"
                      disabled={
                        totalPaginasMovimentacoes === 0 ||
                        paginaMovimentacoes >= totalPaginasMovimentacoes
                      }
                      onClick={() =>
                        setPaginaMovimentacoes((current) =>
                          Math.min(totalPaginasMovimentacoes, current + 1),
                        )
                      }
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {toastErro && (
        <div className="fixed bottom-6 right-6 z-[80] max-w-sm rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-lg dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {toastErro}
        </div>
      )}

      <NewTransactionModal
        isOpen={isModalOpen}
        categorias={categorias}
        cartoes={cartoes}
        contas={contas}
        percentualPadraoDivisao={percentualPadraoDivisao}
        initialTransaction={editingTransaction}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }}
        onCreateTransacao={handleCreateTransacao}
        onUpdateTransacao={handleUpdateTransacao}
        onUpdateCompraParcelada={handleUpdateCompraParcelada}
        onCreateCompraParcelada={handleCreateCompraParcelada}
      />
      <PaymentConfirmationModal
        item={payingTransaction}
        contas={contas}
        isLoadingContas={contasQuery.isLoading}
        onClose={() => setPayingTransaction(null)}
        onConfirm={handleConfirmarPagamento}
      />
      <ModalConfirmacaoChequeEspecial
        isOpen={Boolean(faturaChequeEspecial)}
        isLoading={pagarFaturaMutation.isPending}
        onClose={() => setFaturaChequeEspecial(null)}
        onConfirm={() => {
          if (!faturaChequeEspecial) {
            return;
          }

          pagarFaturaMutation.mutate({
            item: faturaChequeEspecial,
            confirmarSemSaldo: true,
          });
        }}
      />
      <AnticipateInstallmentModal
        item={anticipatingInstallment}
        onClose={() => setAnticipatingInstallment(null)}
        onConfirm={handleAnteciparParcela}
      />
      {dialog}
    </AppLayout>
  );
}

function ModalConfirmacaoChequeEspecial({
  isOpen,
  isLoading,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <button
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          type="button"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4 pr-8">
          <div className="rounded-2xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Saldo insuficiente
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              A conta vinculada não possui saldo suficiente para pagar esta
              fatura. Deseja utilizar o limite da conta (cheque especial) para
              confirmar o pagamento?
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            type="button"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            className="rounded-xl bg-[var(--app-accent)] px-5 py-3 font-bold text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950"
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Confirmando..." : "Confirmar pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

function isSaldoInsuficienteError(error: unknown) {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 400 &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "erro" in error.response.data &&
    error.response.data.erro === "SALDO_INSUFICIENTE"
  );
}

function atualizarStatusItem(
  item: ExtratoMensalItem,
  isPaga: boolean,
  contaBancariaId?: string | null,
) {
  return {
    ...item,
    isPaga,
    contaBancariaId:
      isPaga && contaBancariaId !== undefined
        ? contaBancariaId
        : item.contaBancariaId,
    statusVisual: calcularStatusVisualLocal(isPaga, item.dataOcorrencia),
  };
}

function itemCombinaComStatusQuery(
  queryKey: readonly unknown[],
  item: ExtratoMensalItem,
) {
  const statuses = obterStatusesDaQueryKey(queryKey);

  if (statuses.length === 0) {
    return true;
  }

  if (item.tipo !== 2 && item.tipo !== "Despesa") {
    return false;
  }

  const statusVisual = item.statusVisual ||
    calcularStatusVisualLocal(item.isPaga, item.dataOcorrencia);

  return statuses.some((status) =>
    (status === "pagas" && statusVisual === "Paga") ||
    (status === "pendentes" && statusVisual === "Pendente") ||
    (status === "atrasadas" && statusVisual === "Atrasada"),
  );
}

function obterStatusesDaQueryKey(queryKey: readonly unknown[]) {
  if (queryKey[0] === "extrato-paginado") {
    return splitQueryList(queryKey[10]);
  }

  if (queryKey[0] === "extrato") {
    return splitQueryList(queryKey[4]);
  }

  return [];
}

function calcularStatusVisualLocal(isPaga: boolean, dataOcorrencia: string) {
  if (isPaga) {
    return "Paga";
  }

  return dataOcorrencia < toDateInputValue(new Date())
    ? "Atrasada"
    : "Pendente";
}

function criarItemOtimista(
  id: string,
  request: CriarTransacaoRequest,
  previous: ExtratoMensalItem | null,
  categorias: Categoria[],
  cartoes: CartaoCredito[],
): ExtratoMensalItem {
  const categoria = categorias.find((item) => item.id === request.categoriaId);
  const cartao = cartoes.find((item) => item.id === request.cartaoCreditoId);
  const hoje = toDateInputValue(new Date());

  return {
    id,
    codigoExibicao: previous?.codigoExibicao ?? null,
    tipo: request.tipo,
    descricao: request.descricao,
    valor: request.valor,
    dataOcorrencia: request.dataOcorrencia,
    categoriaId: request.categoriaId ?? null,
    categoriaNome: categoria?.nome ?? "Sem categoria",
    categoriaCorHexa: categoria?.corHexa ?? "#64748B",
    formaPagamento: request.formaPagamento,
    cartaoCreditoId: request.cartaoCreditoId ?? null,
    contaBancariaId: request.contaBancariaId ?? null,
    cartaoCreditoApelido: cartao?.apelidoCartao ?? null,
    isFixa: request.isFixa,
    isPaga: request.dataOcorrencia <= hoje,
    statusVisual: calcularStatusVisualLocal(
      request.dataOcorrencia <= hoje,
      request.dataOcorrencia,
    ),
    isDividida: request.isDividida,
    valorTotalOriginal: request.valorTotalOriginal ?? null,
    percentualDivisao: request.percentualDivisao ?? null,
    isProjetada: false,
    origem: "Transacao",
    compraParceladaId: request.compraParceladaId ?? null,
    numeroParcela: request.numeroParcelaQuitada ?? null,
    quantidadeParcelas: previous?.quantidadeParcelas ?? null,
  };
}

function obterPeriodoInicial(
  searchParams: URLSearchParams,
  hoje: Date,
): PeriodoFiltro {
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");
  const tipoParam = searchParams.get("tipo");
  const tiposValidos: TipoTransacaoFiltro[] = [
    "todos",
    "receita",
    "despesa",
    "investimento",
  ];
  const tipoTransacao = tiposValidos.includes(tipoParam as TipoTransacaoFiltro)
    ? (tipoParam as TipoTransacaoFiltro)
    : "todos";
  const categoriaIds = obterCategoriaIdsIniciais(searchParams);
  const categoriaId = categoriaIds[0] ?? null;

  if (
    inicio &&
    fim &&
    /^\d{4}-\d{2}-\d{2}$/.test(inicio) &&
    /^\d{4}-\d{2}-\d{2}$/.test(fim) &&
    parseLocalDate(fim) >= parseLocalDate(inicio)
  ) {
    return {
      tipo: "intervalo",
      inicio,
      fim,
      tipoTransacao,
      categoriaId,
      categoriaIds,
    };
  }

  return {
    tipo: "intervalo",
    inicio: toDateInputValue(
      new Date(hoje.getFullYear(), hoje.getMonth(), 1),
    ),
    fim: toDateInputValue(
      new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0),
    ),
    tipoTransacao,
    categoriaId,
    categoriaIds,
  };
}

function obterCategoriaIdsPeriodo(periodo: PeriodoFiltro) {
  return [
    ...new Set([
      ...(periodo.categoriaIds ?? []),
      ...(periodo.categoriaId ? [periodo.categoriaId] : []),
    ]),
  ].filter(Boolean);
}

function obterCategoriaIdsIniciais(searchParams: URLSearchParams) {
  return [
    ...new Set([
      ...(searchParams.get("categorias") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      ...(searchParams.get("categoria") ? [searchParams.get("categoria")!] : []),
    ]),
  ];
}

function obterStatusesIniciais(searchParams: URLSearchParams): StatusFiltro[] {
  return normalizarStatuses(
    (searchParams.get("status") ?? "")
      .split(",")
      .map((item) => item.trim() as StatusFiltro),
  );
}

function normalizarStatuses(statuses: StatusFiltro[]) {
  const validos: StatusFiltro[] = ["pagas", "pendentes", "atrasadas"];
  return [...new Set(statuses.filter((status) => validos.includes(status)))];
}

function splitQueryList(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function obterRangePeriodo(periodo: PeriodoFiltro) {
  if (periodo.tipo === "dias") {
    const fim = new Date();
    return {
      inicio: addDays(fim, -(periodo.dias - 1)),
      fim,
    };
  }

  if (periodo.tipo === "intervalo") {
    return {
      inicio: parseLocalDate(periodo.inicio),
      fim: parseLocalDate(periodo.fim),
    };
  }

  return {
    inicio: new Date(periodo.ano, periodo.mes - 1, 1),
    fim: new Date(periodo.ano, periodo.mes, 0),
  };
}

function baixarArquivo(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function criarNomeArquivoExportacao(
  dataInicial: string,
  dataFinal: string,
  extensao: "xlsx" | "pdf",
) {
  return `Extrato_${dataInicial}_${dataFinal}.${extensao}`;
}

type ResumoCardProps = {
  label: string;
  value: number;
  secondaryLabel?: string;
  tone: "success" | "danger" | "investment";
  icon: "expense" | "income" | "investment" | "balance" | "shared";
  featured?: boolean;
  hiddenValues?: boolean;
};

function ResumoCard({
  label,
  value,
  secondaryLabel,
  tone,
  icon,
  featured = false,
  hiddenValues = false,
}: ResumoCardProps) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "investment"
        ? "text-indigo-700"
        : "text-red-700";
  const iconConfig = {
    expense: {
      Icon: TrendingDown,
      wrapper: "bg-red-50",
      color: "text-red-500",
    },
    income: {
      Icon: TrendingUp,
      wrapper: "bg-emerald-50",
      color: "text-emerald-500",
    },
    investment: {
      Icon: Activity,
      wrapper: "bg-blue-50",
      color: "text-blue-500",
    },
    balance: {
      Icon: Wallet,
      wrapper: "bg-slate-100",
      color: "text-slate-600",
    },
    shared: {
      Icon: UsersRound,
      wrapper: "bg-violet-50",
      color: "text-violet-600",
    },
  }[icon];
  const Icon = iconConfig.Icon;

  return (
    <div
      className={`flex flex-col rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${
        featured ? "md:col-span-2" : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div className={`rounded-xl p-2.5 ${iconConfig.wrapper}`}>
          <Icon size={20} className={iconConfig.color} />
        </div>
      </div>
      <p className={`${featured ? "text-3xl" : "text-2xl"} font-bold ${toneClass}`}>
        {hiddenValues ? "R$ ••••••" : formatCurrency(value)}
      </p>
      {secondaryLabel && (
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {hiddenValues ? "Valores ocultos" : secondaryLabel}
        </p>
      )}
    </div>
  );
}
