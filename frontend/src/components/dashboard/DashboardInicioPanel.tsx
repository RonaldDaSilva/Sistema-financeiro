import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Lightbulb,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { useDashboardInicio } from "../../hooks/queries/useFinanceQueries";
import type { DashboardLancamento } from "../../types/finance";
import { formatCurrency, formatDate, parseLocalDate, startOfDay } from "../../utils/date";

type DashboardInicioPanelProps = {
  hiddenValues: boolean;
};

export function DashboardInicioPanel({ hiddenValues }: DashboardInicioPanelProps) {
  const dashboardQuery = useDashboardInicio();
  const dashboard = dashboardQuery.data;
  const balancoOperacional = (dashboard?.livreParaGastar ?? 0) - (dashboard?.saldoAtual ?? 0);

  const insights = dashboard?.insights ?? [];
  const proximosLancamentos = dashboard?.proximosLancamentos ?? [];

  if (dashboardQuery.isLoading) {
    return (
      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="min-h-[220px] animate-pulse rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] dark:border-slate-800 dark:bg-slate-900" />
        <div className="min-h-[220px] animate-pulse rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] dark:border-slate-800 dark:bg-slate-900" />
      </section>
    );
  }

  if (dashboardQuery.isError || !dashboard) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
        Não foi possível carregar o resumo inteligente da Dashboard.
      </div>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      <div className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Livre para gastar
            </p>
            <p
              className={`mt-4 text-4xl font-black tracking-tight sm:text-5xl ${
                dashboard.livreParaGastar >= 0
                  ? "text-[var(--app-primary)]"
                  : "text-red-500"
              }`}
            >
              {maskCurrency(dashboard.livreParaGastar, hiddenValues)}
            </p>
            <p className="mt-3 max-w-xl text-sm font-medium text-slate-500 dark:text-slate-400">
              Considera seu saldo real, receitas pendentes do mês e contas ainda em aberto.
            </p>
          </div>
          <span className="rounded-2xl bg-[var(--app-primary-soft)] p-3 text-[var(--app-primary)] dark:bg-emerald-950/50 dark:text-emerald-300">
            <WalletCards size={26} />
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Saldo atual"
            value={dashboard.saldoAtual}
            hiddenValues={hiddenValues}
            tone={dashboard.saldoAtual >= 0 ? "success" : "danger"}
            icon={<WalletCards size={18} />}
          />
          <MetricCard
            label="Balanço do mês"
            value={balancoOperacional}
            hiddenValues={hiddenValues}
            tone={balancoOperacional >= 0 ? "success" : "danger"}
            icon={balancoOperacional >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
          />
          <MetricCard
            label="A pagar"
            value={dashboard.despesasAPagar}
            hiddenValues={hiddenValues}
            tone="warning"
            icon={<CalendarClock size={18} />}
          />
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
              <Lightbulb size={18} />
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Insights automáticos
            </h3>
          </div>
          <div className="space-y-2">
            {insights.length === 0 ? (
              <InsightCard text="Nenhum alerta crítico encontrado para os próximos dias." />
            ) : (
              insights.map((insight) => (
                <InsightCard key={insight} text={insight} />
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
              <CalendarClock size={18} />
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Próximos lançamentos
            </h3>
          </div>
          <div className="space-y-3">
            {proximosLancamentos.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                Nenhum lançamento pendente nos próximos dias.
              </p>
            ) : (
              proximosLancamentos.map((lancamento) => (
                <TimelineItem
                  key={lancamento.id}
                  lancamento={lancamento}
                  hiddenValues={hiddenValues}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  hiddenValues,
  tone,
  icon,
}: {
  label: string;
  value: number;
  hiddenValues: boolean;
  tone: "success" | "danger" | "warning";
  icon: ReactNode;
}) {
  const toneClass = {
    success: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300",
    danger: "text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300",
    warning: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
  }[tone];

  return (
    <div className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className={`rounded-xl p-2 ${toneClass}`}>{icon}</span>
      </div>
      <p className={`mt-4 text-2xl font-black ${value >= 0 ? "text-slate-950 dark:text-white" : "text-red-500"}`}>
        {maskCurrency(value, hiddenValues)}
      </p>
    </div>
  );
}

function InsightCard({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-blue-50 p-3 text-sm font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-300">
      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" />
      <span>{text}</span>
    </div>
  );
}

function TimelineItem({
  lancamento,
  hiddenValues,
}: {
  lancamento: DashboardLancamento;
  hiddenValues: boolean;
}) {
  const isReceita = lancamento.tipo === 1 || lancamento.tipo === "Receita";

  return (
    <article className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
          isReceita
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
            : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
        }`}
      >
        {isReceita ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-black text-slate-900 dark:text-white">
            {lancamento.descricao}
          </p>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
            {relativeDate(lancamento.dataOcorrencia)}
          </span>
        </div>
        <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">
          {formatDate(lancamento.dataOcorrencia)} · {lancamento.categoriaNome || lancamento.formaPagamento}
        </p>
      </div>
      <p className={`shrink-0 text-sm font-black ${isReceita ? "text-emerald-600" : "text-red-500"}`}>
        {isReceita ? "+" : "-"} {maskCurrency(lancamento.valor, hiddenValues)}
      </p>
    </article>
  );
}

function maskCurrency(value: number, hiddenValues: boolean) {
  return hiddenValues ? "R$ •••••" : formatCurrency(value);
}

function relativeDate(value: string) {
  const today = startOfDay(new Date());
  const target = startOfDay(parseLocalDate(value));
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff > 1 && diff <= 7) return `${diff} dias`;

  return formatDate(value);
}
