import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileText, Plus, Wallet } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  TransactionForm,
  type TransactionFormSavedSummary,
} from "../components/TransactionForm";
import {
  useCartoesOpcoes,
  useCategorias,
  useContas,
} from "../hooks/queries/useFinanceQueries";
import { useConfiguracoesNotificacao } from "../hooks/queries/useNotificationQueries";
import { queryKeys } from "../hooks/queries/queryKeys";
import * as financeService from "../services/financeService";
import type {
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
} from "../types/finance";
import { formatCurrency } from "../utils/date";
import { applyPalette, getStoredPaletteId } from "../utils/palette";

export function QuickTransactionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [precisaCartoes, setPrecisaCartoes] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [savedSummary, setSavedSummary] =
    useState<TransactionFormSavedSummary | null>(null);
  const origem = normalizarOrigem(searchParams.get("origem"));

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", storedTheme === "dark");
    document.documentElement.dataset.theme = storedTheme;
    applyPalette(getStoredPaletteId());
  }, []);

  const categoriasQuery = useCategorias();
  const contasQuery = useContas(true);
  const cartoesQuery = useCartoesOpcoes(precisaCartoes);
  const configuracoesQuery = useConfiguracoesNotificacao(true);

  const isInitialLoading =
    categoriasQuery.isLoading ||
    contasQuery.isLoading ||
    configuracoesQuery.isLoading;
  const loadError =
    categoriasQuery.error || contasQuery.error || configuracoesQuery.error;

  const invalidarCachesFinanceiros = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.extratoScope }),
      queryClient.invalidateQueries({ queryKey: queryKeys.extratoPaginadoScope }),
      queryClient.invalidateQueries({ queryKey: queryKeys.faturasScope }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoesOpcoes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.contas }),
      queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardScope }),
    ]);
  }, [queryClient]);

  async function handleCreateTransacao(request: CriarTransacaoRequest) {
    const response = await financeService.criarTransacao(request);
    await invalidarCachesFinanceiros();
    return response;
  }

  async function handleCreateCompraParcelada(
    request: CriarCompraParceladaRequest,
  ) {
    await financeService.criarCompraParcelada(request);
    await invalidarCachesFinanceiros();
  }

  function handleAdicionarOutra() {
    setSavedSummary(null);
    setFormKey((current) => current + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleConcluir() {
    navigate("/", { replace: origem === "atalho" || origem === "pwa-shortcut" });
  }

  function handleVerExtrato() {
    const data = savedSummary?.data;
    const params = data ? `?inicio=${data}&fim=${data}` : "";
    navigate(`/${params}`);
  }

  return (
    <QuickTransactionLayout onBack={handleConcluir}>
      <section className="flex min-h-0 flex-1 flex-col gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[var(--app-primary)] dark:text-emerald-300">
            {origem === "atalho" ? "Atalho iOS" : "Transações"}
          </p>
          <h1 className="text-2xl font-black text-slate-950 dark:text-white">
            Nova transação
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Registre uma movimentação sem carregar a tela inicial completa.
          </p>
        </div>

        {loadError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
            Não foi possível carregar os dados do formulário.
          </div>
        )}

        {savedSummary && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
              <div className="min-w-0">
                <h2 className="font-black">Transação salva</h2>
                <p className="mt-1 break-words text-sm">
                  {savedSummary.descricao} • {formatCurrency(savedSummary.valor)}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
                type="button"
                onClick={handleAdicionarOutra}
              >
                <Plus size={17} />
                Adicionar outra
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-slate-950 dark:text-emerald-100 dark:hover:bg-slate-900"
                type="button"
                onClick={handleConcluir}
              >
                Concluir
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-slate-950 dark:text-emerald-100 dark:hover:bg-slate-900"
                type="button"
                onClick={handleVerExtrato}
              >
                <FileText size={17} />
                Ver no extrato
              </button>
            </div>
          </div>
        )}

        {isInitialLoading ? (
          <div className="flex flex-1 animate-pulse flex-col gap-4 rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="h-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-20 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-14 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-14 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : (
          <TransactionForm
            key={formKey}
            variant="page"
            categorias={categoriasQuery.data ?? []}
            cartoes={cartoesQuery.data ?? []}
            contas={contasQuery.data ?? []}
            percentualPadraoDivisao={
              configuracoesQuery.data?.percentualPadraoDivisao ?? 50
            }
            onCancel={handleConcluir}
            onSaved={setSavedSummary}
            onCartaoNecessarioChange={setPrecisaCartoes}
            onCreateTransacao={handleCreateTransacao}
            onCreateCompraParcelada={handleCreateCompraParcelada}
          />
        )}
      </section>
    </QuickTransactionLayout>
  );
}

function QuickTransactionLayout({
  children,
  onBack,
}: {
  children: ReactNode;
  onBack: () => void;
}) {
  return (
    <main className="min-h-dvh bg-[var(--app-bg)] px-[max(1rem,env(safe-area-inset-left))] py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
              <Wallet size={22} />
            </div>
            <span className="truncate text-lg font-black text-slate-950 dark:text-white">
              Financeiro
            </span>
          </div>
          <button
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-[var(--app-card-muted)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            type="button"
            onClick={onBack}
          >
            <ArrowLeft size={17} />
            Voltar
          </button>
        </header>
        {children}
      </div>
    </main>
  );
}

function normalizarOrigem(value: string | null) {
  const origensValidas = new Set(["atalho", "pwa-shortcut"]);
  return value && origensValidas.has(value) ? value : null;
}
