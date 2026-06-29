import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Landmark,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "../components/AppLayout";
import {
  useDistribuicaoContas,
  useRelatorioGraficos,
} from "../hooks/queries/useFinanceQueries";
import { formatCurrency } from "../utils/date";

const monthNames = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const fallbackColors = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#65a30d",
  "#475569",
];

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

const chartGridColor = "#f1f5f9";
const chartTick = { fill: "#64748b", fontSize: 12 };
const lightTooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
  color: "#0f172a",
};

export function ReportsPage() {
  const hoje = new Date();
  const mesAtual = toMonthInput(hoje);
  const inicioPadrao = toMonthInput(
    new Date(hoje.getFullYear(), 0, 1),
  );
  const [periodoAplicado, setPeriodoAplicado] = useState({
    inicio: inicioPadrao,
    fim: mesAtual,
  });
  const [periodoRascunho, setPeriodoRascunho] = useState(periodoAplicado);
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null);
  const [isPeriodoOpen, setIsPeriodoOpen] = useState(false);
  const [modoGraficoCategoria, setModoGraficoCategoria] = useState<
    "valor" | "percentual"
  >("valor");
  const dataInicial = `${periodoAplicado.inicio}-01`;
  const dataFinal = lastDayOfMonth(periodoAplicado.fim);
  const relatorioQuery = useRelatorioGraficos(dataInicial, dataFinal);
  const distribuicaoContasQuery = useDistribuicaoContas();

  const despesasPorCategoria = useMemo(
    () =>
      (relatorioQuery.data?.despesasPorCategoria ?? []).map((item) => ({
        name: item.categoriaNome,
        value: item.valor,
        color: item.categoriaCorHexa,
      })),
    [relatorioQuery.data?.despesasPorCategoria],
  );
  const serieFluxo = useMemo(
    () =>
      (relatorioQuery.data?.serieFluxo ?? []).map((item) => ({
        mes: `${monthNames[item.mes - 1]}/${String(item.ano).slice(2)}`,
        receitas: item.receitas,
        despesas: item.despesas,
        saldo: item.saldo,
      })),
    [relatorioQuery.data?.serieFluxo],
  );

  const totalDespesasCategoria = useMemo(
    () => despesasPorCategoria.reduce((total, item) => total + item.value, 0),
    [despesasPorCategoria],
  );

  const despesasPorCategoriaGrafico = useMemo(
    () =>
      despesasPorCategoria.map((item) => ({
        ...item,
        percentual:
          totalDespesasCategoria > 0
            ? (item.value / totalDespesasCategoria) * 100
            : 0,
      })),
    [despesasPorCategoria, totalDespesasCategoria],
  );

  const dataKeyCategoria =
    modoGraficoCategoria === "valor" ? "value" : "percentual";

  const saldoAnual = useMemo(
    () =>
      (relatorioQuery.data?.saldoAnual ?? []).map((item) => ({
        mes: `${monthNames[item.mes - 1]}/${String(item.ano).slice(2)}`,
        saldo: item.saldo,
        receitas: item.receitas,
        despesas: item.despesas,
      })),
    [relatorioQuery.data?.saldoAnual],
  );
  const distribuicaoContas = useMemo(
    () =>
      (distribuicaoContasQuery.data ?? [])
        .filter((conta) => conta.saldoAtual > 0)
        .map((conta, index) => ({
          name: conta.nomeCustomizado,
          value: conta.saldoAtual,
          color: fallbackColors[index % fallbackColors.length],
        })),
    [distribuicaoContasQuery.data],
  );

  function aplicarPeriodo() {
    if (!periodoRascunho.inicio || !periodoRascunho.fim) {
      setErroPeriodo("Informe o mês inicial e o mês final.");
      return false;
    }

    const quantidadeMeses = monthsBetween(
      periodoRascunho.inicio,
      periodoRascunho.fim,
    );

    if (quantidadeMeses < 1) {
      setErroPeriodo("O mês final deve ser igual ou posterior ao mês inicial.");
      return false;
    }

    if (quantidadeMeses > 12) {
      setErroPeriodo("Selecione um período de no máximo 12 meses.");
      return false;
    }

    setErroPeriodo(null);
    if (
      periodoAplicado.inicio === periodoRascunho.inicio &&
      periodoAplicado.fim === periodoRascunho.fim
    ) {
      void relatorioQuery.refetch();
      return true;
    }

    setPeriodoAplicado(periodoRascunho);
    return true;
  }

  function deslocarPeriodo(offset: number) {
    const next = {
      inicio: addMonthsToInput(periodoAplicado.inicio, offset),
      fim: addMonthsToInput(periodoAplicado.fim, offset),
    };
    setErroPeriodo(null);
    setPeriodoRascunho(next);
    setPeriodoAplicado(next);
  }

  return (
    <AppLayout>
      <section className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Relatórios</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Gráficos financeiros
            </h2>
          </div>
          <div className="relative flex flex-col gap-2">
            <div className="flex items-center gap-1 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <button
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-[var(--app-primary-soft)] hover:text-[var(--app-primary)] dark:text-slate-300"
                type="button"
                aria-label="Período anterior"
                onClick={() => deslocarPeriodo(-1)}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 transition hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800 sm:min-w-[310px]"
                type="button"
                aria-expanded={isPeriodoOpen}
                onClick={() => setIsPeriodoOpen((current) => !current)}
              >
                <CalendarRange size={18} className="shrink-0 text-slate-500" />
                <span className="truncate">
                  {formatMonthLabel(periodoAplicado.inicio)} -{" "}
                  {formatMonthLabel(periodoAplicado.fim)}
                </span>
              </button>
              <button
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-[var(--app-primary-soft)] hover:text-[var(--app-primary)] dark:text-slate-300"
                type="button"
                aria-label="Próximo período"
                onClick={() => deslocarPeriodo(1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {isPeriodoOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-full min-w-[290px] rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:w-[390px]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                    De
                    <input
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case text-slate-800 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      type="month"
                      value={periodoRascunho.inicio}
                      onChange={(event) =>
                        setPeriodoRascunho((current) => ({
                          ...current,
                          inicio: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                    Até
                    <input
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case text-slate-800 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      type="month"
                      value={periodoRascunho.fim}
                      onChange={(event) =>
                        setPeriodoRascunho((current) => ({
                          ...current,
                          fim: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--app-card-border)] pt-3 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Máximo de 12 meses
                  </span>
                  <button
                    className="rounded-xl bg-[var(--app-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                    type="button"
                    onClick={() => {
                      if (aplicarPeriodo()) {
                        setIsPeriodoOpen(false);
                      }
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {(erroPeriodo || relatorioQuery.isError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {erroPeriodo ?? "Não foi possível carregar os relatórios."}
          </div>
        )}
        {relatorioQuery.isLoading && (
          <div className="rounded-2xl bg-[var(--app-card)] p-6 text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
            Carregando gráficos...
          </div>
        )}

        {!relatorioQuery.isLoading && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="flex min-h-[350px] flex-col rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-red-50 p-2 text-red-500">
                    <PieChartIcon size={20} />
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Despesas por categoria
                  </h3>
                </div>
                <div className="inline-flex w-fit rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-1 dark:border-slate-800 dark:bg-slate-950">
                  <button
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      modoGraficoCategoria === "valor"
                        ? "bg-[var(--app-primary)] text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                    type="button"
                    onClick={() => setModoGraficoCategoria("valor")}
                  >
                    Valor
                  </button>
                  <button
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      modoGraficoCategoria === "percentual"
                        ? "bg-[var(--app-primary)] text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                    type="button"
                    onClick={() => setModoGraficoCategoria("percentual")}
                  >
                    Percentual
                  </button>
                </div>
              </div>
              <div className="mt-6 h-80 flex-grow">
                {despesasPorCategoria.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
                    Sem despesas no período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={despesasPorCategoriaGrafico}
                        dataKey={dataKeyCategoria}
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={105}
                        paddingAngle={2}
                        labelLine={false}
                        label={({ value }) =>
                          modoGraficoCategoria === "valor"
                            ? formatCurrency(Number(value ?? 0))
                            : formatPercent(Number(value ?? 0))
                        }
                      >
                        {despesasPorCategoriaGrafico.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.color ||
                              fallbackColors[index % fallbackColors.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={lightTooltipStyle}
                        formatter={(value, _name, props) => {
                          const payload = props.payload as
                            | { value: number; percentual: number }
                            | undefined;

                          return modoGraficoCategoria === "valor"
                            ? [
                                formatCurrency(Number(value)),
                                `Total (${formatPercent(payload?.percentual ?? 0)})`,
                              ]
                            : [
                                formatPercent(Number(value)),
                                `Percentual (${formatCurrency(payload?.value ?? 0)})`,
                              ];
                        }}
                      />
                      <Legend
                        align="center"
                        iconType="circle"
                        verticalAlign="bottom"
                        wrapperStyle={{ color: "#64748b", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="flex min-h-[350px] flex-col rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-blue-50 p-2 text-blue-500">
                  <BarChart3 size={20} />
                </span>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Saldo do período
                </h3>
              </div>
              <div className="mt-6 h-80 flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={saldoAnual}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke={chartGridColor}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="mes"
                      tick={chartTick}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={chartTick}
                      tickFormatter={(value) => String(Number(value) / 1000)}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={lightTooltipStyle}
                      cursor={{ fill: "#f8fafc" }}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Bar dataKey="saldo" name="Saldo" radius={[6, 6, 0, 0]}>
                      {saldoAnual.map((entry) => (
                        <Cell
                          key={entry.mes}
                          fill={entry.saldo >= 0 ? "#10b981" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="flex min-h-[350px] flex-col rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-violet-50 p-2 text-violet-600 dark:bg-violet-950/50">
                  <Landmark size={20} />
                </span>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Distribuição entre contas
                </h3>
              </div>
              <div className="mt-6 h-80 flex-grow">
                {distribuicaoContasQuery.isLoading ? (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    Carregando contas...
                  </div>
                ) : distribuicaoContas.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
                    Cadastre contas com saldo positivo para visualizar a distribuição.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distribuicaoContas}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={68}
                        outerRadius={110}
                        paddingAngle={3}
                      >
                        {distribuicaoContas.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={lightTooltipStyle}
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                      <Legend
                        align="center"
                        iconType="circle"
                        verticalAlign="bottom"
                        wrapperStyle={{ color: "#64748b", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-50 p-2 text-emerald-500">
                  <LineChartIcon size={20} />
                </span>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Evolução de saldo, receitas e despesas
                </h3>
              </div>
              <div className="mt-6 h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={serieFluxo}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke={chartGridColor}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="mes"
                      tick={chartTick}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={chartTick}
                      tickFormatter={(value) => String(Number(value) / 1000)}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={lightTooltipStyle}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend
                      height={36}
                      iconType="circle"
                      verticalAlign="top"
                      wrapperStyle={{ color: "#64748b", fontSize: 12 }}
                    />
                    <Line
                      dataKey="saldo"
                      name="Saldo"
                      type="monotone"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      dataKey="receitas"
                      name="Receitas"
                      type="monotone"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      dataKey="despesas"
                      name="Despesas"
                      type="monotone"
                      stroke="#ef4444"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function toMonthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  })
    .format(new Date(year, month - 1, 1))
    .replace(".", "");
}

function addMonthsToInput(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  return toMonthInput(new Date(year, month - 1 + offset, 1));
}

function monthsBetween(start: string, end: string) {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return (endYear - startYear) * 12 + endMonth - startMonth + 1;
}

function lastDayOfMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}
