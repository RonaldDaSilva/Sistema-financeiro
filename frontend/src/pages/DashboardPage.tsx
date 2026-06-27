import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  FileSpreadsheet,
  FileText,
  Eye,
  EyeOff,
  Plus,
  TrendingDown,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { NewTransactionModal } from "../components/NewTransactionModal";
import { PeriodFilter } from "../components/PeriodFilter";
import { TransactionList } from "../components/TransactionList";
import { useAuth } from "../contexts/AuthContext";
import {
  useCartoes,
  useCategorias,
  useExtratoMensalPaginado,
  useExtratosMensais,
  useFaturasMensais,
} from "../hooks/queries/useFinanceQueries";
import { useConfiguracoesNotificacao } from "../hooks/queries/useNotificationQueries";
import { queryKeys } from "../hooks/queries/queryKeys";
import * as financeService from "../services/financeService";
import type {
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
  ExtratoMensal,
  ExtratoMensalItem,
  FaturaConsolidada,
  PagedResponse,
  PeriodoFiltro,
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
  const { confirm, dialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const hoje = new Date();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(() =>
    obterPeriodoInicial(searchParams, hoje),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<ExtratoMensalItem | null>(null);
  const [anticipatingInstallment, setAnticipatingInstallment] =
    useState<ExtratoMensalItem | null>(null);
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [toastErro, setToastErro] = useState<string | null>(null);
  const [apenasDivididas, setApenasDivididas] = useState(false);
  const [paginaMovimentacoes, setPaginaMovimentacoes] = useState(1);
  const pageSizeMovimentacoes = 25;
  const [valoresOcultos, setValoresOcultos] = useState(() => {
    return localStorage.getItem("dashboard-values-hidden") === "true";
  });

  useEffect(() => {
    localStorage.setItem("dashboard-values-hidden", String(valoresOcultos));
  }, [valoresOcultos]);

  const rangePeriodo = useMemo(() => obterRangePeriodo(periodo), [periodo]);
  const mesesPeriodo = useMemo(
    () => getMonthsBetween(rangePeriodo.inicio, rangePeriodo.fim),
    [rangePeriodo],
  );
  const categoriasQuery = useCategorias();
  const cartoesQuery = useCartoes(isModalOpen);
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
    categoriaId: periodo.categoriaId,
  });
  const faturasQueries = useFaturasMensais(mesesPeriodo);
  const categorias = categoriasQuery.data ?? [];
  const cartoes = cartoesQuery.data ?? [];
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
    periodo.categoriaId,
    periodo.tipoTransacao,
    rangePeriodo.fim,
    rangePeriodo.inicio,
  ]);

  const faturas = useMemo(() => {
    return faturasQueries
      .flatMap((query) => query.data ?? [])
      .filter((fatura) => {
        const data = parseLocalDate(fatura.dataVencimento);
        return data >= rangePeriodo.inicio && data <= rangePeriodo.fim;
      });
  }, [faturasQueries, rangePeriodo.fim, rangePeriodo.inicio]);

  const movimentacoesPaginadas = extratoPaginadoQuery.data?.items ?? [];
  const totalPaginasMovimentacoes = extratoPaginadoQuery.data?.totalPages ?? 0;
  const totalMovimentacoes = extratoPaginadoQuery.data?.totalCount ?? 0;

  async function invalidarDadosFinanceiros() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["extrato"] }),
      queryClient.invalidateQueries({ queryKey: ["extrato-paginado"] }),
      queryClient.invalidateQueries({ queryKey: ["faturas"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes }),
    ]);
  }

  function handlePeriodoChange(nextPeriodo: PeriodoFiltro) {
    setPeriodo(nextPeriodo);

    const range = obterRangePeriodo(nextPeriodo);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("inicio", toDateInputValue(range.inicio));
    nextParams.set("fim", toDateInputValue(range.fim));

    const tipoTransacao = nextPeriodo.tipoTransacao ?? "todos";
    const categoriaId = nextPeriodo.categoriaId ?? null;
    tipoTransacao === "todos"
      ? nextParams.delete("tipo")
      : nextParams.set("tipo", tipoTransacao);
    categoriaId
      ? nextParams.set("categoria", categoriaId)
      : nextParams.delete("categoria");

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
    await financeService.criarTransacao(request);
    await invalidarDadosFinanceiros();
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

    await financeService.atualizarTransacao(id, request, replicarFuturas);
    await invalidarDadosFinanceiros();
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

    await financeService.anteciparParcela({
      ...request,
      anteciparParcelasFuturas,
    });
    await invalidarDadosFinanceiros();
  }

  function atualizarStatusPagamentoLocal(
    id: string,
    isPaga: boolean,
    dataOcorrencia?: string,
  ) {
    queryClient.setQueriesData<ExtratoMensal>(
      { queryKey: ["extrato"] },
      (current) =>
        current
          ? {
              ...current,
              itens: current.itens.map((item) =>
                atualizarStatusItem(item, id, isPaga, dataOcorrencia),
              ),
            }
          : current,
    );
    queryClient.setQueriesData<PagedResponse<ExtratoMensalItem>>(
      { queryKey: ["extrato-paginado"] },
      (current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                atualizarStatusItem(item, id, isPaga, dataOcorrencia),
              ),
            }
          : current,
    );
  }

  function aplicarImpactoSaldoGlobalLocal(
    item: ExtratoMensalItem,
    isPagaAnterior: boolean,
    isPagaAtual: boolean,
  ) {
    const isReceita = item.tipo === 1 || item.tipo === "Receita";
    const dataOcorrencia = parseLocalDate(item.dataOcorrencia);
    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);

    if (isReceita || dataOcorrencia > hojeInicio || isPagaAnterior === isPagaAtual) {
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

  function atualizarStatusFaturaLocal(
    cartaoCreditoId: string,
    dataVencimento: string,
    isPaga: boolean,
  ) {
    queryClient.setQueriesData<ExtratoMensal>(
      { queryKey: ["extrato"] },
      (current) =>
        current
          ? {
              ...current,
              itens: current.itens.map((item) =>
                item.origem === "FaturaCartao" &&
                item.cartaoCreditoId === cartaoCreditoId &&
                item.dataOcorrencia === dataVencimento
                  ? { ...item, isPaga }
                  : item,
              ),
            }
          : current,
    );
    queryClient.setQueriesData<PagedResponse<ExtratoMensalItem>>(
      { queryKey: ["extrato-paginado"] },
      (current) =>
        current
          ? {
              ...current,
              items: current.items.map((currentItem) =>
                currentItem.origem === "FaturaCartao" &&
                currentItem.cartaoCreditoId === cartaoCreditoId &&
                currentItem.dataOcorrencia === dataVencimento
                  ? { ...currentItem, isPaga }
                  : currentItem,
              ),
            }
          : current,
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
      const nextStatus = !item.isPaga;
      atualizarStatusFaturaLocal(
        item.cartaoCreditoId,
        item.dataOcorrencia,
        nextStatus,
      );
      aplicarImpactoSaldoGlobalLocal(item, item.isPaga, nextStatus);
      setToastErro(null);

      try {
        const response = await financeService.alternarStatusFatura(
          item.cartaoCreditoId,
          item.dataOcorrencia,
        );
        atualizarStatusFaturaLocal(
          item.cartaoCreditoId,
          item.dataOcorrencia,
          response.isPaga,
        );
      } catch {
        atualizarStatusFaturaLocal(
          item.cartaoCreditoId,
          item.dataOcorrencia,
          item.isPaga,
        );
        aplicarImpactoSaldoGlobalLocal(item, nextStatus, item.isPaga);
        setToastErro("Não foi possível atualizar o status da fatura.");
        window.setTimeout(() => setToastErro(null), 3500);
      }

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
      <section className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
              Início
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Olá, {user?.nome}
            </h2>
          </div>
          <button
            className="flex items-center rounded-xl bg-[var(--app-accent)] px-5 py-2.5 font-medium text-[var(--app-accent-contrast)] shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-95 dark:bg-white dark:text-slate-950"
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

        <div className="relative z-30 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-stretch">
          <PeriodFilter
            value={periodo}
            categorias={categorias}
            onChange={handlePeriodoChange}
          />
          <div className="flex flex-col gap-2 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row lg:flex-col lg:justify-center">
            <button
              className="flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={Boolean(exportando)}
              onClick={() => handleExportar("excel")}
            >
              <FileSpreadsheet size={17} className="mr-2" />
              {exportando === "excel" ? "Baixando..." : "Baixar Excel"}
            </button>
            <button
              className="flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={Boolean(exportando)}
              onClick={() => handleExportar("pdf")}
            >
              <FileText size={17} className="mr-2" />
              {exportando === "pdf" ? "Baixando..." : "Baixar PDF"}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-[var(--app-card-muted)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            type="button"
            onClick={() => setValoresOcultos((current) => !current)}
            aria-pressed={valoresOcultos}
            aria-label={valoresOcultos ? "Mostrar valores" : "Ocultar valores"}
          >
            {valoresOcultos ? <Eye size={16} /> : <EyeOff size={16} />}
            {valoresOcultos ? "Mostrar valores" : "Ocultar valores"}
          </button>
        </div>

        <div className="relative z-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {apenasDivididas ? (
            <>
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
            </>
          ) : (
            <>
              <ResumoCard
                label="Saldo Atual (Global)"
                value={resumo.saldoAtualGlobal}
                secondaryLabel={`Previsto para o fim do mês: ${formatCurrency(
                  resumo.saldoPrevistoFimDoMes,
                )}`}
                tone={resumo.saldoAtualGlobal >= 0 ? "success" : "danger"}
                icon="balance"
                featured
                hiddenValues={valoresOcultos}
              />
              <ResumoCard
                label="Total gasto"
                value={resumo.totalGasto}
                tone="danger"
                icon="expense"
                hiddenValues={valoresOcultos}
              />
              <ResumoCard
                label="Total recebido"
                value={resumo.totalRecebido}
                tone="success"
                icon="income"
                hiddenValues={valoresOcultos}
              />
              <ResumoCard
                label="Total investido"
                value={resumo.totalInvestido}
                tone="investment"
                icon="investment"
                hiddenValues={valoresOcultos}
              />
              <ResumoCard
                label="Balanço do Mês"
                value={resumo.balancoDoMes}
                secondaryLabel={
                  resumo.balancoDoMes >= 0
                    ? `Sobrando: + ${formatCurrency(resumo.balancoDoMes)}`
                    : `Déficit: - ${formatCurrency(Math.abs(resumo.balancoDoMes))}`
                }
                tone={resumo.balancoDoMes >= 0 ? "success" : "danger"}
                icon={resumo.balancoDoMes >= 0 ? "income" : "expense"}
                hiddenValues={valoresOcultos}
              />
            </>
          )}
        </div>

        <div className="space-y-3">
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
      <AnticipateInstallmentModal
        item={anticipatingInstallment}
        onClose={() => setAnticipatingInstallment(null)}
        onConfirm={handleAnteciparParcela}
      />
      {dialog}
    </AppLayout>
  );
}

function atualizarStatusItem(
  item: ExtratoMensalItem,
  id: string,
  isPaga: boolean,
  dataOcorrencia?: string,
) {
  if (item.id !== id) {
    return item;
  }

  if (dataOcorrencia && item.dataOcorrencia !== dataOcorrencia) {
    return item;
  }

  return { ...item, isPaga };
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
  const categoriaId = searchParams.get("categoria");

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
  };
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
