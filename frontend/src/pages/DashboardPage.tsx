import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  FileSpreadsheet,
  FileText,
  Plus,
  TrendingDown,
  TrendingUp,
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
  PeriodoFiltro,
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
  const hoje = new Date();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    tipo: "intervalo",
    inicio: toDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    fim: toDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    tipoTransacao: "todos",
    categoriaId: null,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<ExtratoMensalItem | null>(null);
  const [anticipatingInstallment, setAnticipatingInstallment] =
    useState<ExtratoMensalItem | null>(null);
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [toastErro, setToastErro] = useState<string | null>(null);

  const rangePeriodo = useMemo(() => obterRangePeriodo(periodo), [periodo]);
  const mesesPeriodo = useMemo(
    () => getMonthsBetween(rangePeriodo.inicio, rangePeriodo.fim),
    [rangePeriodo],
  );
  const categoriasQuery = useCategorias();
  const cartoesQuery = useCartoes();
  const configuracoesQuery = useConfiguracoesNotificacao();
  const extratosQueries = useExtratosMensais(mesesPeriodo);
  const faturasQueries = useFaturasMensais(mesesPeriodo);
  const categorias = categoriasQuery.data ?? [];
  const cartoes = cartoesQuery.data ?? [];
  const percentualPadraoDivisao =
    configuracoesQuery.data?.percentualPadraoDivisao ?? 50;
  const isLoading = [
    categoriasQuery,
    cartoesQuery,
    configuracoesQuery,
    ...extratosQueries,
    ...faturasQueries,
  ].some((query) => query.isLoading);
  const hasLoadError = [
    categoriasQuery,
    cartoesQuery,
    configuracoesQuery,
    ...extratosQueries,
    ...faturasQueries,
  ].some((query) => query.isError);

  const movimentacoes = useMemo(() => {
    return extratosQueries
      .flatMap((query) => query.data?.itens ?? [])
      .filter((item) => {
        const data = parseLocalDate(item.dataOcorrencia);
        if (data < rangePeriodo.inicio || data > rangePeriodo.fim) {
          return false;
        }

        const tipoTransacao = periodo.tipoTransacao ?? "todos";
        const matchesCategoria =
          !periodo.categoriaId || item.categoriaId === periodo.categoriaId;

        const matchesTipo =
          tipoTransacao === "todos" ||
          (tipoTransacao === "receita" &&
            (item.tipo === 1 || item.tipo === "Receita")) ||
          (tipoTransacao === "despesa" &&
            (item.tipo === 2 || item.tipo === "Despesa")) ||
          (tipoTransacao === "investimento" &&
            (item.tipo === 3 || item.tipo === "Investimento"));

        return matchesTipo && matchesCategoria;
      })
      .sort(
        (a, b) =>
          parseLocalDate(b.dataOcorrencia).getTime() -
          parseLocalDate(a.dataOcorrencia).getTime(),
      );
  }, [
    extratosQueries,
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

  async function invalidarDadosFinanceiros() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["extrato"] }),
      queryClient.invalidateQueries({ queryKey: ["faturas"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.categorias }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.configuracoesNotificacao,
      }),
    ]);
  }

  const resumo = useMemo(() => {
    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);

    return movimentacoes.reduce(
      (acc, item) => {
        const isReceita = item.tipo === 1 || item.tipo === "Receita";
        const isInvestimento = item.tipo === 3 || item.tipo === "Investimento";
        const dataOcorrencia = parseLocalDate(item.dataOcorrencia);
        const entraNoSaldoAtual = isReceita
          ? dataOcorrencia <= hojeInicio
          : item.isPaga;

        if (isReceita) {
          acc.totalRecebido += item.valor;
          if (entraNoSaldoAtual) {
            acc.saldoAtual += item.valor;
          }
        } else if (isInvestimento) {
          acc.totalInvestido += item.valor;
          if (entraNoSaldoAtual) {
            acc.saldoAtual -= item.valor;
          }
        } else {
          acc.totalGasto += item.valor;
          if (entraNoSaldoAtual) {
            acc.saldoAtual -= item.valor;
          }
        }

        acc.saldoPrevistoFimDoMes =
          acc.totalRecebido - acc.totalGasto - acc.totalInvestido;
        return acc;
      },
      {
        totalGasto: 0,
        totalRecebido: 0,
        totalInvestido: 0,
        saldoAtual: 0,
        saldoPrevistoFimDoMes: 0,
      },
    );
  }, [movimentacoes]);

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
    await financeService.atualizarTransacao(id, request);
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

    await financeService.excluirTransacao(
      item.id,
      item.isProjetada ? item.dataOcorrencia : undefined,
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
    await financeService.anteciparParcela(request);
    await invalidarDadosFinanceiros();
  }

  function atualizarStatusPagamentoLocal(id: string, isPaga: boolean) {
    queryClient.setQueriesData<ExtratoMensal>(
      { queryKey: ["extrato"] },
      (current) =>
        current
          ? {
              ...current,
              itens: current.itens.map((item) =>
                atualizarStatusItem(item, id, isPaga),
              ),
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
    if (item.origem === "FaturaCartao" && item.cartaoCreditoId) {
      const nextStatus = !item.isPaga;
      atualizarStatusFaturaLocal(
        item.cartaoCreditoId,
        item.dataOcorrencia,
        nextStatus,
      );
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
        setToastErro("Não foi possível atualizar o status da fatura.");
        window.setTimeout(() => setToastErro(null), 3500);
      }

      return;
    }

    if (!item.id) {
      return;
    }

    const nextStatus = !item.isPaga;
    atualizarStatusPagamentoLocal(item.id, nextStatus);
    setToastErro(null);

    try {
      const response = await financeService.alternarStatusPagamento(item.id);
      atualizarStatusPagamentoLocal(item.id, response.isPaga);
    } catch {
      atualizarStatusPagamentoLocal(item.id, item.isPaga);
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

        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-stretch">
          <PeriodFilter
            value={periodo}
            categorias={categorias}
            onChange={setPeriodo}
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <ResumoCard
            label="Total gasto"
            value={resumo.totalGasto}
            tone="danger"
            icon="expense"
          />
          <ResumoCard
            label="Total recebido"
            value={resumo.totalRecebido}
            tone="success"
            icon="income"
          />
          <ResumoCard
            label="Total investido"
            value={resumo.totalInvestido}
            tone="investment"
            icon="investment"
          />
          <ResumoCard
            label="Saldo atual"
            value={resumo.saldoAtual}
            secondaryLabel={`Previsto para o fim do mês: ${formatCurrency(
              resumo.saldoPrevistoFimDoMes,
            )}`}
            tone={resumo.saldoAtual >= 0 ? "success" : "danger"}
            icon="balance"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Movimentações recentes
            </h3>
            {isLoading && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Carregando...
              </span>
            )}
          </div>
          {(erro || hasLoadError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {erro ?? "Não foi possível carregar os dados da Dashboard."}
            </div>
          )}
          {!isLoading && (
            <TransactionList
              items={movimentacoes}
              faturas={faturas}
              onEdit={(item) => {
                setEditingTransaction(item);
                setIsModalOpen(true);
              }}
              onDelete={handleDeleteTransacao}
              onAnticipate={setAnticipatingInstallment}
              onTogglePagamento={handleTogglePagamento}
            />
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
) {
  return item.id === id ? { ...item, isPaga } : item;
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
  icon: "expense" | "income" | "investment" | "balance";
};

function ResumoCard({
  label,
  value,
  secondaryLabel,
  tone,
  icon,
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
  }[icon];
  const Icon = iconConfig.Icon;

  return (
    <div className="flex flex-col rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div className={`rounded-xl p-2.5 ${iconConfig.wrapper}`}>
          <Icon size={20} className={iconConfig.color} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${toneClass}`}>
        {formatCurrency(value)}
      </p>
      {secondaryLabel && (
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {secondaryLabel}
        </p>
      )}
    </div>
  );
}
