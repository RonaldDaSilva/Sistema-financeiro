import { type ReactNode, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
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
import { InfoTooltip } from "../components/InfoTooltip";
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
import {
  buildReportSearchParams,
  formatNegativeRanges,
  getNegativeRanges,
  normalizarPeriodo,
  readReportFilters,
  type ReportFilters,
  type StatusRelatorio,
} from "./reportPageHelpers";

type TabRelatorio = "projecao" | "previsto" | "evolucao" | "compromissos" | "categorias";

const chartTick = { fill: "currentColor", fontSize: 12 };

export function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filtros = useMemo(() => readReportFilters(searchParams), [searchParams]);
  const {
    inicioMes,
    fimMes,
    contaBancariaId,
    cartaoCreditoId,
    categoriaIds,
    tipoTransacao,
    status,
    somenteRecorrentes,
    somenteParceladas,
  } = filtros;
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
        dataReferencia: item.data,
        saidasNegativas: -Math.abs(item.saidas),
      })),
    [relatorio?.projecaoDiaria],
  );
  const periodosNegativos = useMemo(
    () => getNegativeRanges(chartData),
    [chartData],
  );
  const totalCategorias = (relatorio?.despesasPorCategoria ?? []).reduce(
    (total, item) => total + item.valor,
    0,
  );

  function updateFilters(partial: Partial<ReportFilters>) {
    setSearchParams(buildReportSearchParams({ ...filtros, ...partial }));
  }

  function toggleCategoria(id: string) {
    updateFilters(
      categoriaIds.includes(id)
        ? { categoriaIds: categoriaIds.filter((categoriaId) => categoriaId !== id) }
        : { categoriaIds: [...categoriaIds, id] },
    );
  }

  function limparFiltros() {
    updateFilters({
      contaBancariaId: "",
      cartaoCreditoId: "",
      categoriaIds: [],
      tipoTransacao: "todos",
      status: "todos",
      somenteRecorrentes: false,
      somenteParceladas: false,
    });
  }

  function abrirExtratoDaCategoria(categoriaId: string | null) {
    if (!categoriaId) {
      return;
    }

    const params = new URLSearchParams();
    params.set("inicio", periodo.dataInicial);
    params.set("fim", periodo.dataFinal);
    params.set("categoria", categoriaId);
    params.set("categorias", categoriaId);
    if (contaBancariaId) {
      params.set("conta", contaBancariaId);
    }

    navigate(`/?${params.toString()}#movimentacoes-recentes`);
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

          <div className="min-w-0 rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:min-w-[760px]">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <MonthField
                label="De"
                value={inicioMes}
                onChange={(value) => updateFilters({ inicioMes: value })}
              />
              <MonthField
                label="Até"
                value={fimMes}
                onChange={(value) => updateFilters({ fimMes: value })}
              />
              <button
                className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-card-border)] px-4 text-sm font-black text-slate-700 transition hover:bg-[var(--app-card-muted)] dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
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
                  onChange={(value) => updateFilters({ contaBancariaId: value })}
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
                  onChange={(value) => updateFilters({ cartaoCreditoId: value })}
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
                  onChange={(value) =>
                    updateFilters({ tipoTransacao: value as TipoTransacaoFiltro })
                  }
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
                  onChange={(value) =>
                    updateFilters({ status: value as StatusRelatorio })
                  }
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
                    onChange={(event) =>
                      updateFilters({ somenteRecorrentes: event.target.checked })
                    }
                  />
                  Somente recorrentes
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-card-border)] px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={somenteParceladas}
                    onChange={(event) =>
                      updateFilters({ somenteParceladas: event.target.checked })
                    }
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
                        className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={categoriaIds.includes(categoria.id)}
                          onChange={() => toggleCategoria(categoria.id)}
                        />
                        <span className="min-w-0 break-words">{categoria.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  className="rounded-2xl border border-[color:var(--app-card-border)] px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-[var(--app-card-muted)] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 md:col-span-2 xl:col-span-3"
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

        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-2 dark:border-slate-800 dark:bg-slate-900" aria-label="Abas de relatórios">
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
                  ? "bg-[var(--app-accent)] text-[var(--app-accent-contrast)] dark:bg-blue-600 dark:text-white"
                  : "text-slate-500 hover:bg-[var(--app-card-muted)] dark:text-slate-300 dark:hover:bg-slate-800"
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
            {periodosNegativos.length > 0 && (
              <div className="mt-4 rounded-2xl border border-[color:var(--app-danger)] bg-[var(--app-danger-soft)] p-3 text-sm font-semibold text-[var(--app-danger)] dark:text-red-200">
                Atenção: saldo projetado negativo em{" "}
                {formatNegativeRanges(periodosNegativos)}.
              </div>
            )}
            <div className="mt-5 h-[340px] min-h-[300px] min-w-0 overflow-hidden md:h-[460px]">
              {relatoriosQuery.isLoading ? (
                <Skeleton className="h-full" />
              ) : chartData.length === 0 ? (
                <EmptyState message="Sem dados para projetar neste período." />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={240}
                  minHeight={300}
                >
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
                      dataKey="dataReferencia"
                      minTickGap={18}
                      tick={chartTick}
                      tickFormatter={(value) => formatDate(String(value)).slice(0, 5)}
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
                    <RechartsTooltip
                      content={<ChartTooltip />}
                    />
                    <Legend />
                    <ReferenceLine yAxisId="saldo" y={0} stroke="var(--app-card-border)" />
                    {periodosNegativos.map((periodo) => (
                      <ReferenceArea
                        key={`${periodo.start}-${periodo.end}`}
                        yAxisId="saldo"
                        x1={periodo.start}
                        x2={periodo.end}
                        fill="var(--app-danger-soft)"
                        fillOpacity={0.8}
                      />
                    ))}
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
                      fill="var(--app-danger)"
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
                    <button
                      key={`${item.categoriaId ?? item.categoriaNome}-${index}`}
                      className="w-full space-y-2 rounded-2xl p-2 text-left transition hover:bg-[var(--app-card-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)] disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-slate-800"
                      type="button"
                      disabled={!item.categoriaId}
                      onClick={() => abrirExtratoDaCategoria(item.categoriaId)}
                      aria-label={
                        item.categoriaId
                          ? `Filtrar extrato pela categoria ${item.categoriaNome}`
                          : `Categoria ${item.categoriaNome} sem filtro disponível`
                      }
                    >
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
                    </button>
                  );
                })
              )}
            </div>
          </section>
        )}

        {tab === "previsto" && (
          <SimpleListSection
            title="Previsto versus realizado"
            subtitle="Visão de consumo por competência; pagamento de fatura impacta apenas caixa"
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
            subtitle="Consumo por competência, sem duplicar pagamento de fatura"
            rows={(relatorio?.evolucaoMensal ?? []).map((item) => ({
              label: `${String(item.mes).padStart(2, "0")}/${item.ano}`,
              value: `Resultado ${formatCurrency(item.saldo)}`,
              detail: `R ${formatCurrency(item.receitas)} · D ${formatCurrency(item.despesas)} · I ${formatCurrency(item.investimentos)}`,
            }))}
            loading={relatoriosQuery.isLoading}
          />
        )}

        {tab === "compromissos" && (
          <CompromissosFuturosSection
            compromissos={relatorio?.compromissosFuturos ?? []}
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
  const resumo = relatorio?.resumoAuditavel;
  const disponivel = relatorio?.disponivelAposCompromissos;
  const comparisonPeriod = formatComparisonPeriod(relatorio);
  const dataLimite = disponivel?.dataLimite ?? resumo?.dataLimite;
  const dataLimiteText = dataLimite ? formatDate(dataLimite) : "a data final";

  return (
    <div className="space-y-5">
      <KpiSection title="Desempenho do período">
        {isLoading ? (
          <SkeletonGrid count={4} />
        ) : (
          <>
            <KpiCard
              title="Receitas realizadas"
              value={kpis?.receitas}
              colorClass="text-emerald-600 dark:text-emerald-300"
              tooltip="Total de receitas efetivamente recebidas dentro do período selecionado."
              comparisonPeriod={comparisonPeriod}
            />
            <KpiCard
              title="Despesas do período"
              value={kpis?.despesas}
              colorClass="text-red-600 dark:text-red-300"
              tooltip="Total de despesas reconhecidas no período, incluindo compras de cartão por competência, sem duplicar o pagamento da fatura."
              comparisonPeriod={comparisonPeriod}
            />
            <KpiCard
              title="Investimentos realizados"
              value={kpis?.investimentos}
              colorClass="text-blue-600 dark:text-blue-300"
              tooltip="Total de investimentos efetivamente realizados dentro do período."
              comparisonPeriod={comparisonPeriod}
            />
            <KpiCard
              title="Resultado líquido"
              value={kpis?.resultadoLiquido}
              colorClass="text-[var(--app-primary)] dark:text-white"
              tooltip="Receitas realizadas menos despesas do período e investimentos realizados."
              comparisonPeriod={comparisonPeriod}
            />
          </>
        )}
      </KpiSection>

      <KpiSection title="Posição financeira">
        {isLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-52 md:col-span-2" />
          </>
        ) : (
          <>
            <MetricCard
              title="Saldo atual"
              value={formatCurrency(disponivel?.saldoAtual ?? resumo?.saldoAtual ?? 0)}
              tooltip="Valor efetivamente disponível nas contas neste momento, sem receitas futuras."
            />
            <MetricCard
              title="Obrigações em aberto"
              value={formatCurrency(
                disponivel?.obrigacoesPendentesAteDataLimite ?? resumo?.obrigacoesEmAberto ?? 0,
              )}
              helper={`Até ${dataLimiteText}`}
              tooltip="Despesas, parcelas, faturas e investimentos que ainda precisam ser pagos até a data final selecionada."
            />
            <DisponivelCompromissosCard
              disponivel={disponivel}
              saldoPrevisto={kpis?.saldoPrevistoFimPeriodo}
              dataLimite={dataLimite}
            />
          </>
        )}
      </KpiSection>

      <KpiSection title="Indicadores secundários">
        {isLoading ? (
          <SkeletonGrid count={4} />
        ) : (
          <>
            <KpiCard
              title="Taxa de economia"
              value={kpis?.taxaEconomia}
              colorClass="text-purple-600 dark:text-purple-300"
              tooltip="Percentual das receitas realizadas que não foi consumido pelas despesas do período."
              comparisonPeriod={comparisonPeriod}
            />
            <MetricCard
              title="Comparação"
              value={comparisonPeriod ?? "Sem período anterior"}
              helper="Base dos percentuais exibidos nos cards."
              tooltip="Variação em relação ao período imediatamente anterior de mesma duração."
            />
            <MetricCard
              title="Receitas previstas"
              value={formatCurrency(disponivel?.receitasPrevistas ?? resumo?.receitasPrevistas ?? 0)}
              helper={`Entre hoje e ${dataLimiteText}`}
              tooltip="Receitas futuras ainda não recebidas entre hoje e a data final selecionada."
            />
            <MetricCard
              title="Cenário com receitas previstas"
              value={formatCurrency(disponivel?.disponivelConsiderandoReceitasPrevistas ?? 0)}
              helper="Simulação secundária, sem antecipar receita no disponível principal."
              tooltip="Simulação do disponível caso todas as receitas previstas sejam recebidas."
            />
          </>
        )}
      </KpiSection>
    </div>
  );
}

function KpiSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">{children}</div>
    </section>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-32" />
      ))}
    </>
  );
}

function DisponivelCompromissosCard({
  disponivel,
  saldoPrevisto,
  dataLimite,
}: {
  disponivel?: RelatorioGraficos["disponivelAposCompromissos"];
  saldoPrevisto?: RelatorioComparativoValor;
  dataLimite?: string;
}) {
  const dataLimiteText = dataLimite ? formatDate(dataLimite) : "o fim do período";
  return (
    <article className="min-w-0 rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 md:col-span-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="min-w-0 text-sm font-bold text-slate-500 dark:text-slate-400">
              Disponível após compromissos
            </p>
            <InfoTooltip label="Disponível após compromissos">
              Saldo atual descontando as obrigações e investimentos ainda pendentes até a data final selecionada.
            </InfoTooltip>
          </div>
          <p className="mt-3 max-w-full whitespace-nowrap text-[clamp(2rem,4vw,2.75rem)] font-black leading-tight text-[var(--app-primary)]">
            {formatCurrency(disponivel?.disponivelAposCompromissos ?? 0)}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Considerando obrigações ainda não pagas até {dataLimiteText}.
          </p>
          {disponivel?.observacao && (
            <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-200">
              {disponivel.observacao}
            </p>
          )}
        </div>
        <dl className="grid min-w-0 gap-2 lg:min-w-[360px]">
          <MetricDetail
            label="Saldo atual"
            value={formatCurrency(disponivel?.saldoAtual ?? 0)}
          />
          <MetricDetail
            label="(-) Obrigações em aberto"
            value={formatCurrency(disponivel?.obrigacoesPendentesAteDataLimite ?? 0)}
          />
          <MetricDetail
            label="(-) Investimentos pendentes"
            value={formatCurrency(disponivel?.investimentosPendentesAteDataLimite ?? 0)}
          />
          <MetricDetail
            label="(-) Reserva mínima"
            value={formatCurrency(disponivel?.reservaMinimaConfigurada ?? 0)}
          />
          <MetricDetail
            label={dataLimite ? `Saldo previsto em ${formatDate(dataLimite)}` : "Saldo previsto"}
            value={formatKpiValue(saldoPrevisto, false)}
            tooltip="Estimativa de saldo ao final do período após considerar as saídas pendentes. Receitas futuras não são antecipadas no cenário conservador."
            strong
          />
          <MetricDetail
            label="Receitas previstas"
            value={formatCurrency(disponivel?.receitasPrevistas ?? 0)}
            tooltip="Receitas futuras ainda não recebidas entre hoje e a data final selecionada."
          />
          <MetricDetail
            label="Cenário com receitas previstas"
            value={formatCurrency(disponivel?.disponivelConsiderandoReceitasPrevistas ?? 0)}
            tooltip="Simulação do disponível caso todas as receitas previstas sejam recebidas."
          />
        </dl>
      </div>
    </article>
  );
}

function MetricDetail({
  label,
  value,
  tooltip,
  strong,
}: {
  label: string;
  value: string;
  tooltip?: string;
  strong?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-3 dark:border-slate-700 dark:bg-slate-950/80 ${strong ? "ring-1 ring-[var(--app-primary)]/30" : ""}`}>
      <dt className="flex min-w-0 items-center justify-between gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
        <span className="min-w-0 break-words">{label}</span>
        {tooltip && <InfoTooltip label={label}>{tooltip}</InfoTooltip>}
      </dt>
      <dd className={`mt-1 max-w-full whitespace-nowrap text-base font-black ${strong ? "text-[var(--app-primary)] dark:text-blue-200" : "text-slate-900 dark:text-white"}`}>
        {value}
      </dd>
    </div>
  );
}

function CompromissosFuturosSection({
  compromissos,
  loading,
}: {
  compromissos: NonNullable<RelatorioGraficos["compromissosFuturos"]>;
  loading: boolean;
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <SectionTitle
        icon={<ListOrdered size={20} />}
        title="Compromissos futuros"
        subtitle="Valores projetados com base em faturas, parcelas, despesas e receitas recorrentes cadastradas."
      />
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-44" />
          ))
        ) : compromissos.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState message="Nenhum compromisso futuro encontrado." />
          </div>
        ) : (
          compromissos.map((item) => (
            <article
              key={`${item.mes}-${item.ano}`}
              className="min-w-0 rounded-2xl border border-[color:var(--app-card-border)] p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {String(item.mes).padStart(2, "0")}/{item.ano}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Obrigações futuras
                  </p>
                </div>
                <p className="max-w-full whitespace-nowrap text-xl font-black text-red-600">
                  {formatCurrency(item.obrigacoesFuturas)}
                </p>
              </div>
              <dl className="mt-4 grid gap-2 text-sm">
                <CommitmentRow label="Faturas" value={item.faturas} />
                <CommitmentRow label="Parcelas fora de fatura" value={item.parcelasForaDeFatura} />
                <CommitmentRow label="Despesas fixas" value={item.despesasFixas} />
                <CommitmentRow label="Outras despesas" value={item.outrasDespesas} />
                <CommitmentRow label="Receitas previstas" value={item.receitasPrevistas} />
                <CommitmentRow
                  label="Impacto líquido"
                  value={item.impactoLiquido}
                  signed
                  strong
                />
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function CommitmentRow({
  label,
  value,
  signed = false,
  strong = false,
}: {
  label: string;
  value: number;
  signed?: boolean;
  strong?: boolean;
}) {
  const valueText = signed ? formatSignedCurrency(value) : formatCurrency(value);
  return (
    <div className={`flex min-w-0 items-center justify-between gap-3 ${strong ? "border-t border-[color:var(--app-card-border)] pt-2" : ""}`}>
      <dt className="min-w-0 break-words font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className={`shrink-0 text-right font-black ${strong ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-200"}`}>
        {valueText}
      </dd>
    </div>
  );
}

function MetricCard({
  title,
  value,
  helper,
  tooltip,
}: {
  title: string;
  value: string;
  helper?: string;
  tooltip: string;
}) {
  return (
    <article className="min-w-0 rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-3 max-w-full whitespace-nowrap text-[clamp(1.875rem,3vw,2.25rem)] font-black leading-tight text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
        <InfoTooltip label={title}>{tooltip}</InfoTooltip>
      </div>
      {helper && (
        <p className="mt-3 break-words text-sm font-bold text-slate-500 dark:text-slate-400">
          {helper}
        </p>
      )}
    </article>
  );
}

function KpiCard({
  title,
  value,
  colorClass,
  tooltip,
  comparisonPeriod,
}: {
  title: string;
  value?: RelatorioComparativoValor;
  colorClass: string;
  tooltip: string;
  comparisonPeriod?: string | null;
}) {
  const isPercent = title === "Taxa de economia";
  return (
    <article className="min-w-0 rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</p>
          <p className={`mt-3 max-w-full whitespace-nowrap text-[clamp(1.875rem,3vw,2.25rem)] font-black leading-tight ${colorClass}`}>
            {formatKpiValue(value, isPercent)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <InfoTooltip label={title}>{tooltip}</InfoTooltip>
          <span className="hidden rounded-2xl bg-[var(--app-card-muted)] p-3 text-[var(--app-primary)] dark:bg-slate-950 dark:text-blue-300 sm:inline-flex">
            <TrendingUp size={20} />
          </span>
        </div>
      </div>
      <p
        className={`mt-3 text-sm font-bold ${
          value?.tendencia === "Melhora"
            ? "text-emerald-600 dark:text-emerald-300"
            : value?.tendencia === "Piora"
              ? "text-red-600 dark:text-red-300"
              : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {value?.mensagem ?? "Sem base para comparação"}
      </p>
      {comparisonPeriod && (
        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Comparado a {comparisonPeriod}
        </p>
      )}
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
      <div className="mt-1 flex h-12 min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        <CalendarDays size={18} className="shrink-0 text-slate-500" />
        <input
          className="min-w-0 w-full bg-transparent text-sm font-bold outline-none"
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
      <div className="mt-1 flex h-12 min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        {icon && <span className="shrink-0">{icon}</span>}
        <select
          className="min-w-0 w-full bg-transparent text-sm font-bold outline-none"
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 rounded-2xl bg-[var(--app-primary-soft)] p-3 text-[var(--app-primary)] dark:bg-emerald-950/50 dark:text-emerald-300">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
          <p className="break-words text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
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
    <div className="max-w-[calc(100vw-2rem)] rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-950">
      <p className="mb-2 font-black text-slate-900 dark:text-white">
        {label ? formatDate(label) : ""}
      </p>
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

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatKpiValue(value: RelatorioComparativoValor | undefined, isPercent: boolean) {
  if (value?.valorAtual === null || value?.valorAtual === undefined) {
    return "Sem base";
  }

  return isPercent ? formatPercent(value.valorAtual) : formatCurrency(value.valorAtual);
}

function formatComparisonPeriod(relatorio: RelatorioGraficos | undefined) {
  if (!relatorio?.dataInicialPeriodoAnterior || !relatorio.dataFinalPeriodoAnterior) {
    return null;
  }

  return `${formatDate(relatorio.dataInicialPeriodoAnterior)}-${formatDate(
    relatorio.dataFinalPeriodoAnterior,
  )}`;
}

function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatCurrency(Math.abs(value))}`;
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
