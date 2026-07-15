import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Lightbulb,
  WalletCards,
  ExternalLink,
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

  const insights = dashboard?.insights ?? [];
  const proximosLancamentos = dashboard?.proximosLancamentos ?? [];
  const lancamentosPorGrupo = {
    vencidos: proximosLancamentos.filter((item) => item.grupo === "Vencido"),
    hoje: proximosLancamentos.filter((item) => item.grupo === "Hoje"),
    proximos: proximosLancamentos.filter(
      (item) => item.grupo !== "Vencido" && item.grupo !== "Hoje",
    ),
  };

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
    <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Livre para gastar
            </p>
            <p
              className={`mt-4 max-w-full break-words text-3xl font-black leading-tight tracking-normal [overflow-wrap:anywhere] sm:text-4xl lg:text-5xl ${
                dashboard.livreParaGastar >= 0
                  ? "text-[var(--app-primary)]"
                  : "text-red-500"
              }`}
            >
              {maskCurrency(dashboard.livreParaGastar, hiddenValues)}
            </p>
            <p className="mt-3 max-w-xl break-words text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
              Saldo atual disponível somado às receitas pendentes do mês, descontando despesas em aberto.
            </p>
          </div>
          <span className="self-start rounded-2xl bg-[var(--app-primary-soft)] p-3 text-[var(--app-primary)] dark:bg-emerald-950/50 dark:text-emerald-300 sm:shrink-0">
            <WalletCards size={26} />
          </span>
        </div>

        <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Saldo atual"
            description="Dinheiro já realizado nas contas, considerando pagamentos e recebimentos efetivos."
            value={dashboard.saldoAtual}
            hiddenValues={hiddenValues}
            tone={dashboard.saldoAtual >= 0 ? "success" : "danger"}
            icon={<WalletCards size={18} />}
          />
          <MetricCard
            label="Balanço realizado do mês"
            description="Receitas realizadas menos despesas e investimentos já realizados neste mês."
            value={dashboard.balancoRealizadoNoMes}
            hiddenValues={hiddenValues}
            tone={dashboard.balancoRealizadoNoMes >= 0 ? "success" : "danger"}
            icon={dashboard.balancoRealizadoNoMes >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
          />
          <MetricCard
            label="Previsto fim do mês"
            description="Saldo atual projetado com receitas, despesas e investimentos pendentes do mês."
            value={dashboard.saldoPrevistoFimDoMes}
            hiddenValues={hiddenValues}
            tone={dashboard.saldoPrevistoFimDoMes >= 0 ? "success" : "warning"}
            icon={<CalendarClock size={18} />}
          />
        </div>
      </div>

      <div className="grid min-w-0 gap-4">
        <div className="min-w-0 rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
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

        <div className="min-w-0 rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
              <CalendarClock size={18} />
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Próximos lançamentos
            </h3>
          </div>
          <div className="space-y-4">
            {proximosLancamentos.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                Nenhum lançamento pendente nos próximos dias.
              </p>
            ) : (
              <>
                <TimelineGroup
                  title="Vencidos"
                  items={lancamentosPorGrupo.vencidos}
                  hiddenValues={hiddenValues}
                />
                <TimelineGroup
                  title="Vencendo hoje"
                  items={lancamentosPorGrupo.hoje}
                  hiddenValues={hiddenValues}
                />
                <TimelineGroup
                  title="Próximos"
                  items={lancamentosPorGrupo.proximos}
                  hiddenValues={hiddenValues}
                />
                <a
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[var(--app-primary)] outline-none transition hover:bg-[var(--app-primary-soft)] focus-visible:ring-2 focus-visible:ring-[var(--app-primary)]"
                  href="#movimentacoes-recentes"
                >
                  Ver todos
                  <ExternalLink size={15} />
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  description,
  value,
  hiddenValues,
  tone,
  icon,
}: {
  label: string;
  description: string;
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
    <div className="min-w-0 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 break-words text-sm font-bold text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className={`shrink-0 rounded-xl p-2 ${toneClass}`}>{icon}</span>
      </div>
      <p className={`mt-4 max-w-full break-words text-2xl font-black leading-tight [overflow-wrap:anywhere] ${value >= 0 ? "text-slate-950 dark:text-white" : "text-red-500"}`}>
        {maskCurrency(value, hiddenValues)}
      </p>
      <p className="mt-2 text-xs font-medium leading-snug text-slate-500 dark:text-slate-400">
        {description}
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
    <a
      className="flex min-w-0 flex-col gap-3 rounded-2xl bg-slate-50 p-3 outline-none transition hover:bg-[var(--app-primary-soft)] focus-visible:ring-2 focus-visible:ring-[var(--app-primary)] dark:bg-slate-950 dark:hover:bg-slate-900 min-[380px]:flex-row min-[380px]:items-center"
      href={buildLancamentoHref(lancamento)}
      aria-label={`Abrir ${lancamento.descricao} no extrato`}
    >
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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 break-words font-black text-slate-900 dark:text-white">
            {lancamento.descricao}
          </p>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
            {relativeDate(lancamento.dataOcorrencia)}
          </span>
        </div>
        <p className="break-words text-sm font-medium text-slate-500 dark:text-slate-400">
          {formatDate(lancamento.dataOcorrencia)} · {lancamento.categoriaNome || lancamento.formaPagamento}
        </p>
      </div>
      <div className="min-w-0 text-left min-[380px]:shrink-0 min-[380px]:text-right">
        <p className={`break-words text-sm font-black [overflow-wrap:anywhere] ${isReceita ? "text-emerald-600" : "text-red-500"}`}>
          {isReceita ? "+" : "-"} {maskCurrency(lancamento.valor, hiddenValues)}
        </p>
        {lancamento.podeLiquidar && (
          <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-[var(--app-primary)] ring-1 ring-[color:var(--app-card-border)] dark:bg-slate-900 dark:ring-slate-700">
            {isReceita ? "Receber" : "Pagar"}
          </span>
        )}
      </div>
    </a>
  );
}

function TimelineGroup({
  title,
  items,
  hiddenValues,
}: {
  title: string;
  items: DashboardLancamento[];
  hiddenValues: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {title}
      </p>
      {items.map((lancamento) => (
        <TimelineItem
          key={`${lancamento.id}-${lancamento.dataOcorrencia}-${lancamento.descricao}`}
          lancamento={lancamento}
          hiddenValues={hiddenValues}
        />
      ))}
    </div>
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

function buildLancamentoHref(lancamento: DashboardLancamento) {
  const params = new URLSearchParams(lancamento.filtrosDestino);

  if (!params.has("inicio") || !params.has("fim")) {
    const data = parseLocalDate(lancamento.dataOcorrencia);
    const inicio = new Date(data.getFullYear(), data.getMonth(), 1);
    const fim = new Date(data.getFullYear(), data.getMonth() + 1, 0);
    params.set("inicio", toDateOnly(inicio));
    params.set("fim", toDateOnly(fim));
  }

  return `${lancamento.rotaDestino || "/"}?${params.toString()}#movimentacoes-recentes`;
}

function toDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
