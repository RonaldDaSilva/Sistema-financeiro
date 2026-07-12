import { useMemo, useState } from "react";
import {
  CalendarDays,
  Landmark,
  LineChart as LineChartIcon,
  ListOrdered,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "../components/AppLayout";
import {
  useContas,
  useDashboardRelatorios,
} from "../hooks/queries/useFinanceQueries";
import { formatCurrency, formatDate } from "../utils/date";

const chartTick = { fill: "#64748b", fontSize: 12 };
const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
  color: "#0f172a",
};

export function ReportsPage() {
  const today = new Date();
  const [mesReferencia, setMesReferencia] = useState(toMonthInput(today));
  const [contaBancariaId, setContaBancariaId] = useState<string>("");
  const { mes, ano } = useMemo(
    () => parseMonthInput(mesReferencia),
    [mesReferencia],
  );

  const contasQuery = useContas();
  const relatoriosQuery = useDashboardRelatorios(
    mes,
    ano,
    contaBancariaId || null,
  );

  const rankingCategorias = relatoriosQuery.data?.rankingCategorias ?? [];
  const projecaoDiaria = useMemo(
    () =>
      (relatoriosQuery.data?.projecaoDiaria ?? []).map((item) => ({
        ...item,
        dataLabel: formatDate(item.data).slice(0, 5),
      })),
    [relatoriosQuery.data?.projecaoDiaria],
  );

  const totalCategorias = rankingCategorias.reduce(
    (total, item) => total + item.valorTotal,
    0,
  );

  return (
    <AppLayout>
      <section className="mx-auto max-w-[1400px] space-y-6 px-4 py-5 sm:px-6 md:space-y-8 md:py-8 lg:px-8">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Relatórios
            </p>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Análise financeira
            </h2>
          </div>

          <div className="grid gap-3 rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 xl:min-w-[620px]">
            <label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Mês
              <div className="mt-1 flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <CalendarDays size={18} className="shrink-0 text-slate-500" />
                <input
                  className="w-full bg-transparent text-sm font-bold outline-none"
                  type="month"
                  value={mesReferencia}
                  onChange={(event) => setMesReferencia(event.target.value)}
                />
              </div>
            </label>

            <label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Conta
              <div className="mt-1 flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <Landmark size={18} className="shrink-0 text-slate-500" />
                <select
                  className="w-full bg-transparent text-sm font-bold outline-none"
                  value={contaBancariaId}
                  onChange={(event) => setContaBancariaId(event.target.value)}
                  disabled={contasQuery.isLoading}
                >
                  <option value="">Todas as contas</option>
                  {(contasQuery.data ?? []).map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nomeCustomizado}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>
        </div>

        {relatoriosQuery.isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            Não foi possível carregar os relatórios.
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.35fr]">
          <section className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-[var(--app-primary-soft)] p-3 text-[var(--app-primary)] dark:bg-emerald-950/50 dark:text-emerald-300">
                  <ListOrdered size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Ranking de categorias
                  </h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Despesas agrupadas no mês
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 dark:bg-slate-950 dark:text-slate-300">
                {formatCurrency(totalCategorias)}
              </span>
            </div>

            {relatoriosQuery.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-950"
                  />
                ))}
              </div>
            ) : rankingCategorias.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                Nenhuma despesa encontrada para o filtro selecionado.
              </div>
            ) : (
              <div className="space-y-4">
                {rankingCategorias.map((item, index) => (
                  <div key={`${item.nomeCategoria}-${index}`} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                          {item.nomeCategoria}
                        </p>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {formatPercent(item.percentual)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-black text-red-500">
                        {formatCurrency(item.valorTotal)}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[var(--app-primary)] transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, item.percentual))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                <LineChartIcon size={20} />
              </span>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Projeção diária
                </h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Evolução projetada do saldo acumulado
                </p>
              </div>
            </div>

            <div className="h-[360px] md:h-[430px]">
              {relatoriosQuery.isLoading ? (
                <div className="h-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-950" />
              ) : projecaoDiaria.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  Sem dados para projetar neste período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={projecaoDiaria}
                    margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="dataLabel"
                      minTickGap={18}
                      tick={chartTick}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={chartTick}
                      tickFormatter={(value) => `${Number(value) / 1000}k`}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [
                        formatCurrency(Number(value)),
                        labelTooltip(String(name)),
                      ]}
                      labelFormatter={(_, payload) => {
                        const data = payload?.[0]?.payload?.data as string | undefined;
                        return data ? formatDate(data) : "";
                      }}
                    />
                    <Line
                      dataKey="saldoAcumulado"
                      name="saldoAcumulado"
                      type="monotone"
                      stroke="var(--app-primary)"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      dataKey="entradas"
                      name="entradas"
                      type="monotone"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="4 4"
                    />
                    <Line
                      dataKey="saidas"
                      name="saidas"
                      type="monotone"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="4 4"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>
      </section>
    </AppLayout>
  );
}

function toMonthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthInput(value: string) {
  const [ano, mes] = value.split("-").map(Number);
  return { mes, ano };
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function labelTooltip(name: string) {
  return {
    saldoAcumulado: "Saldo acumulado",
    entradas: "Entradas",
    saidas: "Saídas",
  }[name] ?? name;
}
