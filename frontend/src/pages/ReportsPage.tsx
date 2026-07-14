import { type ReactNode, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  ChevronDown,
  CreditCard,
  Filter,
  Landmark,
  LineChart as LineChartIcon,
  ListOrdered,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import {
  useCartoes,
  useCategorias,
  useContas,
  useRelatorioGraficos,
} from "../hooks/queries/useFinanceQueries";
import { formatCurrency, formatDate } from "../utils/date";
import type {
  RelatorioComparativoValor,
  RelatorioGraficos,
  TipoTransacaoFiltro,
} from "../types/finance";

type StatusRelatorio = "todos" | "realizado" | "pendente";
type TabRelatorio = "projecao" | "previsto" | "evolucao" | "compromissos" | "categorias";

const chartTick = { fill: "currentColor", fontSize: 12 };
const hoje = new Date();

export function ReportsPage() {
  const [inicioMes, setInicioMes] = useState(`${hoje.getFullYear()}-01`);
  const [fimMes, setFimMes] = useState(toMonthInput(hoje));
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [cartaoCreditoId, setCartaoCreditoId] = useState("");
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  const [tipoTransacao, setTipoTransacao] = useState<TipoTransacaoFiltro>("todos");
  const [status, setStatus] = useState<StatusRelatorio>("todos");
  const [somenteRecorrentes, setSomenteRecorrentes] = useState(false);
  const [somenteParceladas, setSomenteParceladas] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tab, setTab] = useState<TabRelatorio>("projecao");

  const periodo = useMemo(
    () => normalizarPeriodo(inicioMes, fimMes),
    [fimMes, inicioMes],
  );

  const contasQuery = useContas();
  const cartoesQuery = useCartoes();
  const categoriasQuery = useCategorias();
  const relatoriosQuery = useRelatorioGraficos({
    dataInicial: periodo.dataInicial,
    dataFinal: periodo.dataFinal,
    contaBancariaId: contaBancariaId || null,
    cartaoCreditoId: cartaoCreditoId || null,
    categoriaIds,
    tipoTransacao,
    status,
    somenteRecorrentes,
    somenteParceladas,
  });

  const relatorio = relatoriosQuery.data;
  const chartData = useMemo(
    () =>
      (relatorio?.projecaoDiaria ?? []).map((item) => ({
        ...item,
        dataLabel: formatDate(item.data).slice(0, 5),
        saidasNegativas: -Math.abs(item.saidas),
      })),
    [relatorio?.projecaoDiaria],
  );
  const totalCategorias = (relatorio?.despesasPorCategoria ?? []).reduce(
    (total, item) => total + item.valor,
    0,
  );

  function toggleCategoria(id: string) {
    setCategoriaIds((current) =>
      current.includes(id)
        ? current.filter((categoriaId) => categoriaId !== id)
        : [...current, id],
    );
  }

  function limparFiltros() {
    setContaBancariaId("");
    setCartaoCreditoId("");
    setCategoriaIds([]);
    setTipoTransacao("todos");
    setStatus("todos");
    setSomenteRecorrentes(false);
    setSomenteParceladas(false);
  }

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

          <div className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:min-w-[760px]">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <MonthField label="De" value={inicioMes} onChange={setInicioMes} />
              <MonthField label="Até" value={fimMes} onChange={setFimMes} />
              <button
                className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-card-border)] px-4 text-sm font-black text-slate-700 transition hover:bg-[var(--app-card-muted)] dark:text-white"
                type="button"
                onClick={() => setShowAdvanced((value) => !value)}
              >
                <Filter size={18} />
                Filtros
                <ChevronDown
                  size={16}
                  className={`transition ${showAdvanced ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {showAdvanced && (
              <div className="mt-4 grid gap-3 border-t border-[color:var(--app-card-border)] pt-4 md:grid-cols-2 xl:grid-cols-3">
                <SelectField
                  icon={<Landmark size={18} />}
                  label="Conta"
                  value={contaBancariaId}
                  onChange={setContaBancariaId}
                  options={[
                    { value: "", label: "Todas as contas" },
                    ...(contasQuery.data ?? []).map((conta) => ({
                      value: conta.id,
                      label: conta.nomeCustomizado,
                    })),
                  ]}
                />
                <SelectField
                  icon={<CreditCard size={18} />}
                  label="Cartão"
                  value={cartaoCreditoId}
                  onChange={setCartaoCreditoId}
                  options={[
                    { value: "", label: "Todos os cartões" },
                    ...(cartoesQuery.data ?? []).map((cartao) => ({
                      value: cartao.id,
                      label: cartao.apelidoCartao,
                    })),
                  ]}
                />
                <SelectField
                  label="Tipo"
                  value={tipoTransacao}
                  onChange={(value) => setTipoTransacao(value as TipoTransacaoFiltro)}
                  options={[
                    { value: "todos", label: "Todos" },
                    { value: "receita", label: "Receitas" },
                    { value: "despesa", label: "Despesas" },
                    { value: "investimento", label: "Investimentos" },
                  ]}
                />
                <SelectField
                  label="Status"
                  value={status}
                  onChange={(value) => setStatus(value as StatusRelatorio)}
                  options={[
                    { value: "todos", label: "Todos" },
                    { value: "realizado", label: "Realizado" },
                    { value: "pendente", label: "Pendente" },
                  ]}
                />
                <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-card-border)] px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={somenteRecorrentes}
                    onChange={(event) => setSomenteRecorrentes(event.target.checked)}
                  />
                  Somente recorrentes
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-card-border)] px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={somenteParceladas}
                    onChange={(event) => setSomenteParceladas(event.target.checked)}
                  />
                  Somente parceladas
                </label>
                <div className="md:col-span-2 xl:col-span-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                    Categorias
                  </p>
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-[color:var(--app-card-border)] p-3">
                    {(categoriasQuery.data ?? []).map((categoria) => (
                      <label
                        key={categoria.id}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={categoriaIds.includes(categoria.id)}
                          onChange={() => toggleCategoria(categoria.id)}
                        />
                        {categoria.nome}
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  className="rounded-2xl border border-[color:var(--app-card-border)] px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-[var(--app-card-muted)] dark:text-slate-200 md:col-span-2 xl:col-span-3"
                  type="button"
                  onClick={limparFiltros}
                >
                  Limpar filtros avançados
                </button>
              </div>
            )}
          </div>
        </div>

        {relatoriosQuery.isError && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
            Não foi possível carregar os relatórios.
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-100 px-3 py-2 font-black text-red-700 dark:bg-red-900/40 dark:text-red-100"
              type="button"
              onClick={() => relatoriosQuery.refetch()}
            >
              <RefreshCw size={16} />
              Tentar novamente
            </button>
          </div>
        )}

        <KpiGrid relatorio={relatorio} isLoading={relatoriosQuery.isLoading} />

        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-2 dark:border-slate-800 dark:bg-slate-900">
          {[
            ["projecao", "Projeção"],
            ["previsto", "Previsto x realizado"],
            ["evolucao", "Evolução mensal"],
            ["compromissos", "Compromissos futuros"],
            ["categorias", "Categorias"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black transition ${
                tab === value
                  ? "bg-[var(--app-accent)] text-[var(--app-accent-contrast)]"
                  : "text-slate-500 hover:bg-[var(--app-card-muted)] dark:text-slate-300"
              }`}
              type="button"
              onClick={() => setTab(value as TabRelatorio)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "projecao" && (
          <section className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <SectionTitle
              icon={<LineChartIcon size={20} />}
              title="Projeção diária"
              subtitle="Linha de saldo acumulado e barras de entradas/saídas"
            />
            <div className="mt-5 h-[380px] md:h-[460px]">
              {relatoriosQuery.isLoading ? (
                <Skeleton className="h-full" />
              ) : chartData.length === 0 ? (
                <EmptyState message="Sem dados para projetar neste período." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="var(--app-card-border)"
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
                      yAxisId="saldo"
                      axisLine={false}
                      tick={chartTick}
                      tickFormatter={formatMoneyShort}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="fluxo"
                      orientation="right"
                      axisLine={false}
                      tick={chartTick}
                      tickFormatter={formatMoneyShort}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                    />
                    <Legend />
                    <ReferenceLine yAxisId="saldo" y={0} stroke="var(--app-card-border)" />
                    <Bar
                      yAxisId="fluxo"
                      dataKey="entradas"
                      name="Entradas"
                      fill="var(--app-accent)"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      yAxisId="fluxo"
                      dataKey="saidasNegativas"
                      name="Saídas"
                      fill="#ef4444"
                      radius={[0, 0, 8, 8]}
                    />
                    <Line
                      yAxisId="saldo"
                      dataKey="saldoAcumulado"
                      name="Saldo acumulado"
                      type="monotone"
                      stroke="var(--app-primary)"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        )}

        {tab === "categorias" && (
          <section className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <SectionTitle
              icon={<ListOrdered size={20} />}
              title="Categorias"
              subtitle="Ranking e participação no total filtrado"
              badge={formatCurrency(totalCategorias)}
            />
            <div className="mt-5 space-y-4">
              {relatoriosQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-14" />
                ))
              ) : (relatorio?.despesasPorCategoria ?? []).length === 0 ? (
                <EmptyState message="Nenhuma despesa encontrada para o filtro selecionado." />
              ) : (
                relatorio!.despesasPorCategoria.map((item, index) => {
                  const percentual = totalCategorias <= 0 ? 0 : (item.valor / totalCategorias) * 100;
                  return (
                    <div key={`${item.categoriaId ?? item.categoriaNome}-${index}`} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                            {item.categoriaNome}
                          </p>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {formatPercent(percentual)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-black text-red-500">
                          {formatCurrency(item.valor)}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, percentual))}%`,
                            backgroundColor: item.categoriaCorHexa,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {tab === "previsto" && (
          <SimpleListSection
            title="Previsto versus realizado"
            subtitle="Receitas, despesas e saldo filtrados"
            rows={(relatorio?.previstoVersusRealizado ?? []).map((item) => ({
              label: item.nome,
              value: `${formatCurrency(item.realizado)} / ${formatCurrency(item.previsto)}`,
            }))}
            loading={relatoriosQuery.isLoading}
          />
        )}

        {tab === "evolucao" && (
          <SimpleListSection
            title="Evolução mensal"
            subtitle="Receitas, despesas, investimentos e resultado líquido"
            rows={(relatorio?.evolucaoMensal ?? []).map((item) => ({
              label: `${String(item.mes).padStart(2, "0")}/${item.ano}`,
              value: `Resultado ${formatCurrency(item.saldo)}`,
              detail: `R ${formatCurrency(item.receitas)} · D ${formatCurrency(item.despesas)} · I ${formatCurrency(item.investimentos)}`,
            }))}
            loading={relatoriosQuery.isLoading}
          />
        )}

        {tab === "compromissos" && (
          <SimpleListSection
            title="Compromissos futuros"
            subtitle="Faturas, parcelas, despesas fixas e receitas recorrentes"
            rows={(relatorio?.compromissosFuturos ?? []).map((item) => ({
              label: `${String(item.mes).padStart(2, "0")}/${item.ano}`,
              value: formatCurrency(item.total),
              detail: `Faturas ${formatCurrency(item.faturas)} · Parcelas ${formatCurrency(item.parcelas)} · Fixas ${formatCurrency(item.despesasFixas)}`,
            }))}
            loading={relatoriosQuery.isLoading}
          />
        )}
      </section>
    </AppLayout>
  );
}

function KpiGrid({
  relatorio,
  isLoading,
}: {
  relatorio?: RelatorioGraficos;
  isLoading: boolean;
}) {
  const kpis = relatorio?.kpis;
  const items = [
    ["Receitas", kpis?.receitas, "text-emerald-600"],
    ["Despesas", kpis?.despesas, "text-red-600"],
    ["Investimentos", kpis?.investimentos, "text-blue-600"],
    ["Resultado líquido", kpis?.resultadoLiquido, "text-[var(--app-primary)]"],
    ["Saldo previsto", kpis?.saldoPrevistoFimPeriodo, "text-slate-900 dark:text-white"],
    ["Taxa de economia", kpis?.taxaEconomia, "text-purple-600"],
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map(([title, value, color]) =>
        isLoading ? (
          <Skeleton key={title} className="h-32" />
        ) : (
          <KpiCard key={title} title={title} value={value} colorClass={color} />
        ),
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  colorClass,
}: {
  title: string;
  value?: RelatorioComparativoValor;
  colorClass: string;
}) {
  const isPercent = title === "Taxa de economia";
  return (
    <article className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</p>
          <p className={`mt-3 text-3xl font-black ${colorClass}`}>
            {isPercent
              ? formatPercent(value?.valorAtual ?? 0)
              : formatCurrency(value?.valorAtual ?? 0)}
          </p>
        </div>
        <span className="rounded-2xl bg-[var(--app-card-muted)] p-3 text-[var(--app-primary)]">
          <TrendingUp size={20} />
        </span>
      </div>
      <p
        className={`mt-3 text-sm font-bold ${
          value?.tendencia === "Melhora"
            ? "text-emerald-600"
            : value?.tendencia === "Piora"
              ? "text-red-600"
              : "text-slate-500"
        }`}
      >
        {value?.mensagem ?? "Sem base para comparação"}
      </p>
    </article>
  );
}

function MonthField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
      <div className="mt-1 flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        <CalendarDays size={18} className="shrink-0 text-slate-500" />
        <input
          className="w-full bg-transparent text-sm font-bold outline-none"
          type="month"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  icon?: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
      <div className="mt-1 flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        {icon}
        <select
          className="w-full bg-transparent text-sm font-bold outline-none"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
  badge,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="rounded-2xl bg-[var(--app-primary-soft)] p-3 text-[var(--app-primary)] dark:bg-emerald-950/50 dark:text-emerald-300">
          {icon}
        </span>
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      {badge && (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 dark:bg-slate-950 dark:text-slate-300">
          {badge}
        </span>
      )}
    </div>
  );
}

function SimpleListSection({
  title,
  subtitle,
  rows,
  loading,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string; detail?: string }>;
  loading: boolean;
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <SectionTitle icon={<ListOrdered size={20} />} title={title} subtitle={subtitle} />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))
        ) : rows.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState message="Nenhum dado encontrado para o período." />
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={`${row.label}-${row.value}`}
              className="rounded-2xl border border-[color:var(--app-card-border)] p-4"
            >
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{row.label}</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{row.value}</p>
              {row.detail && (
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {row.detail}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-950">
      <p className="mb-2 font-black text-slate-900 dark:text-white">{label}</p>
      {payload.map((item) => (
        <p key={`${item.dataKey}-${item.name}`} className="font-semibold text-slate-600 dark:text-slate-300">
          {item.name}: {formatCurrency(Math.abs(Number(item.value ?? 0)))}
        </p>
      ))}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-950 ${className}`} />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
      {message}
    </div>
  );
}

function toMonthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizarPeriodo(inicio: string, fim: string) {
  const [inicioAno, inicioMesNumero] = inicio.split("-").map(Number);
  const [fimAno, fimMesNumero] = fim.split("-").map(Number);
  const inicioDate = new Date(inicioAno, inicioMesNumero - 1, 1);
  const fimDate = new Date(fimAno, fimMesNumero, 0);
  const meses =
    (fimDate.getFullYear() - inicioDate.getFullYear()) * 12 +
    fimDate.getMonth() -
    inicioDate.getMonth() +
    1;

  if (meses > 12) {
    const novoInicio = new Date(fimDate.getFullYear(), fimDate.getMonth() - 11, 1);
    return {
      dataInicial: toDateOnly(novoInicio),
      dataFinal: toDateOnly(fimDate),
    };
  }

  return {
    dataInicial: toDateOnly(inicioDate),
    dataFinal: toDateOnly(fimDate),
  };
}

function toDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatMoneyShort(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs < 1000) {
    return `${sign}R$ ${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  }

  return `${sign}R$ ${(abs / 1000).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} mil`;
}
