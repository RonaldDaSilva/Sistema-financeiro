import { useEffect, useMemo, useState } from "react";
import { BarChart3, Landmark, LineChart as LineChartIcon, PieChart as PieChartIcon } from "lucide-react";
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
import { useDistribuicaoContas } from "../hooks/queries/useFinanceQueries";
import { hasUsableStoredAuth } from "../services/authStorage";
import * as financeService from "../services/financeService";
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
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState(currentMonth);
  const [extratosAno, setExtratosAno] = useState<
    Array<{ mes: number; receitas: number; despesas: number; saldo: number }>
  >([]);
  const [serieFluxo, setSerieFluxo] = useState<
    Array<{ mes: string; receitas: number; despesas: number; saldo: number }>
  >([]);
  const [modoGraficoCategoria, setModoGraficoCategoria] = useState<
    "valor" | "percentual"
  >("valor");
  const [despesasPorCategoria, setDespesasPorCategoria] = useState<
    Array<{ name: string; value: number; color: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const distribuicaoContasQuery = useDistribuicaoContas();

  useEffect(() => {
    async function carregarRelatorios() {
      if (!hasUsableStoredAuth()) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErro(null);

      try {
        const relatorio = await financeService.getRelatorioGraficos(mes, ano);

        setDespesasPorCategoria(
          relatorio.despesasPorCategoria.map((item) => ({
            name: item.categoriaNome,
            value: item.valor,
            color: item.categoriaCorHexa,
          })),
        );
        setSerieFluxo(
          relatorio.serieFluxo.map((extrato) => ({
            mes: `${monthNames[extrato.mes - 1]}/${String(extrato.ano).slice(2)}`,
            receitas: extrato.receitas,
            despesas: extrato.despesas,
            saldo: extrato.saldo,
          })),
        );
        setExtratosAno(
          relatorio.saldoAnual.map((extrato) => ({
            mes: extrato.mes,
            receitas: extrato.receitas,
            despesas: extrato.despesas,
            saldo: extrato.saldo,
          })),
        );
      } catch {
        setErro("Nao foi possivel carregar os relatorios.");
      } finally {
        setIsLoading(false);
      }
    }

    carregarRelatorios();
  }, [ano, mes]);

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
      extratosAno.map((item) => ({
        mes: monthNames[item.mes - 1],
        saldo: item.saldo,
        receitas: item.receitas,
        despesas: item.despesas,
      })),
    [extratosAno],
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
          <div className="flex flex-wrap gap-3">
            <input
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              type="month"
              value={`${ano}-${String(mes).padStart(2, "0")}`}
              onChange={(event) => {
                const [nextAno, nextMes] = event.target.value
                  .split("-")
                  .map(Number);
                setAno(nextAno);
                setMes(nextMes);
              }}
            />
            <input
              className="w-28 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              type="number"
              value={ano || ""}
              onChange={(event) => {
                const value = event.target.value;
                setAno(value === "" ? 0 : Number(value));
              }}
            />
          </div>
        </div>

        {erro && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {erro}
          </div>
        )}
        {isLoading && (
          <div className="rounded-2xl bg-[var(--app-card)] p-6 text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
            Carregando gráficos...
          </div>
        )}

        {!isLoading && (
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
                    Sem despesas no mês.
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
                  Saldo anual
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
