import { useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Tags,
  WalletCards,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { InfoTooltip } from "../components/InfoTooltip";
import { useResumoFinanceiroMensal } from "../hooks/queries/useFinanceQueries";
import type { RelatorioCategoria, ResumoFinanceiroMes } from "../types/finance";
import { formatCurrency } from "../utils/date";
import {
  buildReportMonthSearchParams,
  formatReportMonth,
  monthDateRange,
  parseReportMonth,
  readReportMonth,
  shiftReportMonth,
} from "./reportPageHelpers";

export function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const monthValue = useMemo(() => readReportMonth(searchParams), [searchParams]);
  const { mes, ano } = useMemo(() => parseReportMonth(monthValue), [monthValue]);
  const resumoQuery = useResumoFinanceiroMensal(mes, ano);
  const previousMonth = shiftReportMonth(monthValue, -1);
  const nextMonth = shiftReportMonth(monthValue, 1);
  const resumo = resumoQuery.data;

  const selectMonth = useCallback((value: string) => {
    setSearchParams(buildReportMonthSearchParams(value));
  }, [setSearchParams]);

  const openCategory = useCallback((categoriaId: string | null) => {
    if (!categoriaId) return;
    const range = monthDateRange(monthValue);
    const params = new URLSearchParams({
      inicio: range.inicio,
      fim: range.fim,
      categoria: categoriaId,
      categorias: categoriaId,
    });
    navigate(`/?${params.toString()}#movimentacoes-recentes`);
  }, [monthValue, navigate]);

  return (
    <AppLayout>
      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 md:py-8 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-[color:var(--app-card-border)] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Relatórios</p>
            <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-white">
              Controle financeiro mensal
            </h1>
          </div>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:min-w-[520px]">
            <button
              className="inline-flex h-11 min-w-0 items-center justify-center gap-1 rounded-lg border border-[color:var(--app-card-border)] px-2 text-sm font-bold text-slate-600 transition hover:bg-[var(--app-card-muted)] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              type="button"
              onClick={() => selectMonth(previousMonth)}
              aria-label={`Ir para ${formatReportMonth(previousMonth)}`}
            >
              <ChevronLeft size={18} className="shrink-0" />
              <span className="truncate">{monthName(previousMonth)}</span>
            </button>

            <label className="relative flex h-14 min-w-[168px] cursor-pointer flex-col items-center justify-center rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-3 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20">
              <span className="text-sm font-black text-slate-900 dark:text-white">
                {formatReportMonth(monthValue)}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <CalendarDays size={13} /> Selecionar mês
              </span>
              <input
                className="absolute inset-0 cursor-pointer opacity-0"
                type="month"
                value={monthValue}
                onChange={(event) => selectMonth(event.target.value)}
                aria-label="Selecionar mês do relatório"
              />
            </label>

            <button
              className="inline-flex h-11 min-w-0 items-center justify-center gap-1 rounded-lg border border-[color:var(--app-card-border)] px-2 text-sm font-bold text-slate-600 transition hover:bg-[var(--app-card-muted)] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              type="button"
              onClick={() => selectMonth(nextMonth)}
              aria-label={`Ir para ${formatReportMonth(nextMonth)}`}
            >
              <span className="truncate">{monthName(nextMonth)}</span>
              <ChevronRight size={18} className="shrink-0" />
            </button>
          </div>
        </header>

        {resumoQuery.isError && (
          <div className="mt-6 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
            Não foi possível carregar o resumo mensal.
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-100 px-3 py-2 font-black dark:bg-red-900/40"
              type="button"
              onClick={() => resumoQuery.refetch()}
            >
              <RefreshCw size={16} /> Tentar novamente
            </button>
          </div>
        )}

        <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Resumo financeiro mensal">
          <SummaryCard
            title="Receitas"
            value={resumo?.receitasRealizadas}
            helper={resumo && resumo.receitasPrevistas > resumo.receitasRealizadas
              ? `Previsto no mês: ${formatCurrency(resumo.receitasPrevistas)}`
              : "Recebido no mês"}
            tone="positive"
            icon={<ArrowUpRight size={20} />}
            loading={resumoQuery.isLoading}
            tooltip="Receitas realizadas, sem tratar reembolsos de divisão como renda normal."
          />
          <SummaryCard
            title="Despesas"
            value={resumo?.despesasRealizadas}
            helper={resumo && resumo.despesasPrevistas > resumo.despesasRealizadas
              ? `Previsto até o fim do mês: ${formatCurrency(resumo.despesasPrevistas)}`
              : "Gasto no mês"}
            tone="negative"
            icon={<ArrowDownRight size={20} />}
            loading={resumoQuery.isLoading}
            tooltip="Consumo pessoal conhecido no mês, incluindo sua parte em despesas divididas e compras na competência da fatura."
          />
          <SummaryCard
            title="Sobra prevista"
            value={resumo?.sobraPrevista}
            helper={resumo && resumo.demaisSaidasPrevistas > 0
              ? `Inclui ${formatCurrency(resumo.demaisSaidasPrevistas)} em outras saídas`
              : "Receitas menos despesas conhecidas"}
            tone={(resumo?.sobraPrevista ?? 0) < 0 ? "negative" : "neutral"}
            icon={<WalletCards size={20} />}
            loading={resumoQuery.isLoading}
            tooltip="Resultado esperado após receitas, despesas e demais saídas patrimoniais conhecidas."
          />
        </section>

        <div className="mt-9 grid items-start gap-9 xl:grid-cols-[minmax(0,0.9fr)_minmax(560px,1.1fr)]">
          <CategorySection
            categories={resumo?.despesasPorCategoria ?? []}
            total={resumo?.despesasPrevistas ?? 0}
            loading={resumoQuery.isLoading}
            onOpen={openCategory}
          />
          <FutureMonthsSection
            items={resumo?.proximosMeses ?? []}
            loading={resumoQuery.isLoading}
          />
        </div>
      </main>
    </AppLayout>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  tone,
  icon,
  loading,
  tooltip,
}: {
  title: string;
  value?: number;
  helper?: string;
  tone: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
  loading: boolean;
  tooltip: string;
}) {
  const toneClass = tone === "positive"
    ? "text-emerald-600 dark:text-emerald-300"
    : tone === "negative"
      ? "text-red-600 dark:text-red-300"
      : "text-slate-900 dark:text-white";

  return (
    <article className="min-w-0 rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</p>
          {loading ? (
            <div className="mt-3 h-9 w-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : (
            <p className={`mt-3 break-words text-3xl font-black ${toneClass}`}>
              {formatCurrency(value ?? 0)}
            </p>
          )}
        </div>
        <div className={`flex shrink-0 items-center gap-1 ${toneClass}`}>
          {icon}
          <InfoTooltip label={title}>{tooltip}</InfoTooltip>
        </div>
      </div>
      <p className="mt-3 min-h-5 text-sm font-semibold text-slate-500 dark:text-slate-400">
        {loading ? "Carregando..." : helper}
      </p>
    </article>
  );
}

function CategorySection({
  categories,
  total,
  loading,
  onOpen,
}: {
  categories: RelatorioCategoria[];
  total: number;
  loading: boolean;
  onOpen: (id: string | null) => void;
}) {
  return (
    <section className="min-w-0 border-t border-[color:var(--app-card-border)] pt-5">
      <SectionHeading
        icon={<Tags size={19} />}
        title="Despesas por categoria"
        subtitle={formatCurrency(total)}
      />
      <div className="mt-5 space-y-4">
        {loading ? Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        )) : categories.length === 0 ? (
          <EmptyState message="Nenhuma despesa conhecida neste mês." />
        ) : categories.map((item) => {
          const percent = total > 0 ? Math.min(100, (item.valor / total) * 100) : 0;
          return (
            <button
              key={`${item.categoriaId ?? "sem-categoria"}-${item.categoriaNome}`}
              className="block w-full text-left disabled:cursor-default"
              type="button"
              disabled={!item.categoriaId}
              onClick={() => onOpen(item.categoriaId)}
              aria-label={`Abrir despesas de ${item.categoriaNome}`}
            >
              <span className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-bold text-slate-700 dark:text-slate-200">
                  {item.categoriaNome}
                </span>
                <span className="shrink-0 font-black text-slate-900 dark:text-white">
                  {formatCurrency(item.valor)}
                </span>
              </span>
              <span className="mt-2 block h-2 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                <span
                  className="block h-full rounded"
                  style={{ width: `${percent}%`, backgroundColor: item.categoriaCorHexa }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FutureMonthsSection({ items, loading }: { items: ResumoFinanceiroMes[]; loading: boolean }) {
  return (
    <section className="min-w-0 border-t border-[color:var(--app-card-border)] pt-5">
      <SectionHeading
        icon={<CalendarRange size={19} />}
        title="Próximos meses"
        subtitle="Previsão das próximas 6 competências"
      />
      {loading ? (
        <div className="mt-5 h-72 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--app-card-border)] text-left text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                <th className="px-2 py-3">Mês</th>
                <th className="px-2 py-3 text-right">Receitas previstas</th>
                <th className="px-2 py-3 text-right">Despesas previstas</th>
                <th className="px-2 py-3 text-right">Sobra prevista</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.ano}-${item.mes}`} className="border-b border-[color:var(--app-card-border)] last:border-0">
                  <td className="px-2 py-4 font-bold text-slate-800 dark:text-slate-100">
                    {formatReportMonth(`${item.ano}-${String(item.mes).padStart(2, "0")}`)}
                  </td>
                  <td className="px-2 py-4 text-right font-semibold text-emerald-600 dark:text-emerald-300">
                    {formatCurrency(item.receitasPrevistas)}
                  </td>
                  <td className="px-2 py-4 text-right font-semibold text-red-600 dark:text-red-300">
                    {formatCurrency(item.despesasPrevistas)}
                  </td>
                  <td className={`px-2 py-4 text-right font-black ${item.sobraPrevista < 0 ? "text-red-600 dark:text-red-300" : "text-slate-900 dark:text-white"}`}>
                    {formatCurrency(item.sobraPrevista)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2 text-slate-900 dark:text-white">
        {icon}
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      <span className="text-right text-xs font-bold text-slate-500 dark:text-slate-400">{subtitle}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg bg-[var(--app-card-muted)] p-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}

function monthName(monthValue: string) {
  return formatReportMonth(monthValue).split(" de ")[0];
}
