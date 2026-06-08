import { useCallback, useEffect, useMemo, useState } from "react";
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
import * as financeService from "../services/financeService";
import type {
  CartaoCredito,
  Categoria,
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
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

export function DashboardPage() {
  const { user } = useAuth();
  const { confirm, dialog } = useConfirmDialog();
  const hoje = new Date();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    tipo: "intervalo",
    inicio: toDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    fim: toDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    tipoTransacao: "todos",
    categoriaId: null,
  });
  const [movimentacoes, setMovimentacoes] = useState<ExtratoMensalItem[]>([]);
  const [faturas, setFaturas] = useState<FaturaConsolidada[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<ExtratoMensalItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDadosBase = useCallback(async () => {
    const [categoriasResponse, cartoesResponse] = await Promise.all([
      financeService.listarCategorias(),
      financeService.listarCartoesCredito(),
    ]);

    setCategorias(categoriasResponse);
    setCartoes(cartoesResponse);
  }, []);

  const carregarExtrato = useCallback(async () => {
    setIsLoading(true);
    setErro(null);

    try {
      const range =
        periodo.tipo === "dias"
          ? {
              inicio: addDays(new Date(), -(periodo.dias - 1)),
              fim: new Date(),
            }
          : periodo.tipo === "intervalo"
            ? {
                inicio: parseLocalDate(periodo.inicio),
                fim: parseLocalDate(periodo.fim),
              }
            : {
                inicio: new Date(periodo.ano, periodo.mes - 1, 1),
                fim: new Date(periodo.ano, periodo.mes, 0),
              };

      const meses = getMonthsBetween(range.inicio, range.fim);
      const extratos = await Promise.all(
        meses.map(({ mes, ano }) => financeService.getExtratoMensal(mes, ano)),
      );
      const faturasMeses = await Promise.all(
        meses.map(({ mes, ano }) => financeService.getFaturasDoMes(mes, ano)),
      );

      const itens = extratos
        .flatMap((extrato) => extrato.itens)
        .filter((item) => {
          const data = parseLocalDate(item.dataOcorrencia);
          if (data < range.inicio || data > range.fim) {
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

      setMovimentacoes(itens);
      setFaturas(
        faturasMeses.flat().filter((fatura) => {
          const data = parseLocalDate(fatura.dataVencimento);
          return data >= range.inicio && data <= range.fim;
        }),
      );
    } catch {
      setErro("Nao foi possivel carregar o extrato.");
    } finally {
      setIsLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    carregarDadosBase().catch(() =>
      setErro("Nao foi possivel carregar categorias e cartoes."),
    );
  }, [carregarDadosBase]);

  useEffect(() => {
    carregarExtrato();
  }, [carregarExtrato]);

  const resumo = useMemo(() => {
    return movimentacoes.reduce(
      (acc, item) => {
        const isReceita = item.tipo === 1 || item.tipo === "Receita";
        const isInvestimento = item.tipo === 3 || item.tipo === "Investimento";

        if (isReceita) {
          acc.totalRecebido += item.valor;
        } else if (isInvestimento) {
          acc.totalInvestido += item.valor;
        } else {
          acc.totalGasto += item.valor;
        }

        acc.saldo = acc.totalRecebido - acc.totalGasto - acc.totalInvestido;
        return acc;
      },
      { totalGasto: 0, totalRecebido: 0, totalInvestido: 0, saldo: 0 },
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
    await carregarExtrato();
  }

  async function handleUpdateTransacao(
    id: string,
    request: CriarTransacaoRequest,
  ) {
    await financeService.atualizarTransacao(id, request);
    await carregarExtrato();
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
    await carregarExtrato();
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
      await carregarExtrato();
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
    await carregarExtrato();
  }

  async function handleCreateCompraParcelada(
    request: CriarCompraParceladaRequest,
  ) {
    await financeService.criarCompraParcelada(request);
    await carregarExtrato();
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
            value={resumo.saldo}
            tone={resumo.saldo >= 0 ? "success" : "danger"}
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
          {erro && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {erro}
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
            />
          )}
        </div>
      </section>

      <NewTransactionModal
        isOpen={isModalOpen}
        categorias={categorias}
        cartoes={cartoes}
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
      {dialog}
    </AppLayout>
  );
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
  tone: "success" | "danger" | "investment";
  icon: "expense" | "income" | "investment" | "balance";
};

function ResumoCard({ label, value, tone, icon }: ResumoCardProps) {
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
    </div>
  );
}
