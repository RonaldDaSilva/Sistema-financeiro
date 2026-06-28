import { memo, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CreditCard,
  Pencil,
  Trash2,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { ExtratoMensalItem, FaturaConsolidada } from "../types/finance";
import { formatCurrency, formatDate, parseLocalDate } from "../utils/date";

type TransactionListProps = {
  items: ExtratoMensalItem[];
  faturas?: FaturaConsolidada[];
  onEdit: (item: ExtratoMensalItem) => void;
  onDelete: (item: ExtratoMensalItem) => void;
  onAnticipate: (item: ExtratoMensalItem) => void;
  onTogglePagamento: (item: ExtratoMensalItem) => void;
};

export const TransactionList = memo(function TransactionList({
  items,
  faturas = [],
  onEdit,
  onDelete,
  onAnticipate,
  onTogglePagamento,
}: TransactionListProps) {
  const [expandedFaturas, setExpandedFaturas] = useState<Set<string>>(
    new Set(),
  );
  const faturasPorChave = useMemo(() => {
    return new Map(faturas.map((fatura) => [faturaKey(fatura), fatura]));
  }, [faturas]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-8 text-center text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        Nenhuma movimentação encontrada para o período.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="hidden grid-cols-[120px_1fr_170px_170px_120px] gap-3 border-b border-[color:var(--app-card-border)] bg-slate-50/50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 md:grid">
        <span>Data</span>
        <span>Movimentação</span>
        <span className="hidden md:block">Categoria</span>
        <span className="text-right">Valor</span>
        <span className="hidden text-right md:block">Ações</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((item, index) => {
          const isReceita = item.tipo === 1 || item.tipo === "Receita";
          const isInvestimento =
            item.tipo === 3 || item.tipo === "Investimento";
          const hojeInicio = new Date();
          hojeInicio.setHours(0, 0, 0, 0);
          const isAtrasada =
            !isReceita &&
            !item.isPaga &&
            parseLocalDate(item.dataOcorrencia) < hojeInicio;
          const valueClass = isReceita
            ? "text-emerald-700"
            : isInvestimento
              ? "text-indigo-700"
              : "text-red-700";
          const MovementIcon = isReceita ? ArrowUpCircle : ArrowDownCircle;
          const movementIconClass = isReceita
            ? "bg-emerald-50 text-emerald-500"
            : "bg-red-50 text-red-500";
          const isFatura =
            item.origem === "FaturaCartao" && item.cartaoCreditoId;
          const fatura = isFatura
            ? faturasPorChave.get(`${item.cartaoCreditoId}-${item.dataOcorrencia}`)
            : undefined;
          const isExpanded = Boolean(
            fatura && expandedFaturas.has(faturaKey(fatura)),
          );
          const canManage =
            (Boolean(item.id) && (!item.isProjetada || item.isFixa)) ||
            (item.isProjetada &&
              (item.origem === "CompraParcelada" || item.origem === "Carne") &&
              Boolean(item.compraParceladaId) &&
              Boolean(item.numeroParcela));
          const canAnticipate =
            item.isProjetada &&
            (item.origem === "CompraParcelada" || item.origem === "Carne") &&
            Boolean(item.compraParceladaId) &&
            Boolean(item.numeroParcela) &&
            isFutureMonth(item.dataOcorrencia);

          return (
            <div
              key={`${item.id ?? item.compraParceladaId ?? item.descricao}-${item.dataOcorrencia}-${item.numeroParcela ?? index}`}
            >
              <div className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-4 px-4 py-5 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/40 sm:px-5 md:grid-cols-[120px_1fr_170px_170px_120px] md:items-center md:gap-3 md:px-6">
                <div className="relative col-start-1 row-start-1 min-h-7 overflow-visible md:col-auto md:row-auto md:min-h-[42px]">
                  <StatusButton item={item} onToggle={onTogglePagamento} />
                  <div className="transition-transform duration-200 ease-out md:group-hover:translate-x-8">
                    <span className="whitespace-nowrap text-sm font-medium text-slate-600 dark:text-slate-300">
                      {formatDate(item.dataOcorrencia)}
                    </span>
                    {item.isPaga && !isReceita && (
                      <span className="mt-1 block w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        Pago
                      </span>
                    )}
                    {isAtrasada && (
                      <span className="mt-1 block w-fit rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        Atrasada
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 row-start-2 flex min-w-0 items-center gap-3 md:col-auto md:row-auto md:gap-4">
                  <MovementIcon
                    size={36}
                    className={`flex-shrink-0 rounded-full p-1 ${movementIconClass}`}
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-base font-bold text-slate-900 dark:text-white">
                        {item.descricao}
                      </p>
                    {fatura && (
                      <button
                        className="rounded-full border border-slate-300 p-1 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                        type="button"
                        onClick={() => {
                          setExpandedFaturas((current) => {
                            const next = new Set(current);
                            const key = faturaKey(fatura);

                            if (next.has(key)) {
                              next.delete(key);
                            } else {
                              next.add(key);
                            }

                            return next;
                          });
                        }}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.isProjetada && (
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Projetada
                      </span>
                    )}
                    {item.numeroParcela && item.quantidadeParcelas && (
                      <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        {item.numeroParcela}/{item.quantidadeParcelas}
                      </span>
                    )}
                    {item.origem === "Carne" && (
                      <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        Carnê/Crediário
                      </span>
                    )}
                    {item.isFixa && (
                      <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        Fixa
                      </span>
                    )}
                    {item.isDividida && (
                      <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                        <UsersRound size={12} />
                        Dividida
                      </span>
                    )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {item.formaPagamento}
                    </p>
                  </div>
                </div>
                <div className="col-start-1 row-start-3 flex min-w-0 items-center gap-2 md:col-auto md:row-auto">
                  <CategoryIcon item={item} />
                  <span className="truncate text-sm text-slate-600 dark:text-slate-300">
                    {item.categoriaNome}
                  </span>
                </div>
                <div className="col-start-2 row-start-3 flex min-w-0 items-center justify-end gap-3 md:col-auto md:row-auto">
                  <div className="text-right">
                    <span className={`block whitespace-nowrap font-semibold ${valueClass}`}>
                      {isReceita ? "+" : "-"} {formatCurrency(item.valor)}
                    </span>
                    {isFatura &&
                    item.valorTotalOriginal != null &&
                    item.valorTotalOriginal !== item.valor ? (
                      <span className="mt-1 block whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span className="md:hidden">
                          Total: ({formatCurrency(item.valorTotalOriginal)})
                        </span>
                        <span className="hidden md:inline">
                          Total da fatura: ({formatCurrency(item.valorTotalOriginal)})
                        </span>
                      </span>
                    ) : item.isDividida && item.valorTotalOriginal != null ? (
                      <span className="ml-1 whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400">
                        ({formatCurrency(item.valorTotalOriginal)})
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="col-start-2 row-start-1 flex justify-end gap-1 md:col-auto md:row-auto md:gap-2">
                  {canAnticipate && (
                    <button
                      className="rounded-xl p-2 text-slate-300 opacity-100 transition-colors hover:bg-[var(--app-primary-soft)] hover:text-[var(--app-primary)] md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                      type="button"
                      onClick={() => onAnticipate(item)}
                      title="Antecipar parcela"
                    >
                      <CalendarClock size={18} />
                    </button>
                  )}
                  <button
                    className="rounded-xl p-2 text-slate-300 opacity-100 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-100 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                    type="button"
                    disabled={!canManage}
                    onClick={() => onEdit(item)}
                    title={
                      canManage
                        ? "Editar transação"
                        : "Esta projeção não pode ser editada diretamente."
                    }
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className="rounded-xl p-2 text-slate-300 opacity-100 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                    type="button"
                    disabled={!canManage}
                    onClick={() => onDelete(item)}
                    title={
                      canManage
                        ? "Excluir transação"
                        : "Esta projeção não pode ser excluída diretamente."
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {fatura && isExpanded && (
                <div className="border-t border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] px-6 py-3 dark:border-slate-800 dark:bg-slate-950 md:pl-[150px]">
                  <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Compras da fatura • {formatDate(fatura.inicioCompetencia)}{" "}
                    até {formatDate(fatura.fimCompetencia)}
                  </div>
                  <div className="space-y-2">
                    {fatura.detalhes.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Nenhuma compra nesta fatura.
                      </p>
                    ) : (
                      fatura.detalhes.map((detalhe, detalheIndex) => (
                        <div
                          className="grid gap-2 rounded-lg bg-[var(--app-card)] px-3 py-2 text-sm dark:bg-slate-900 md:grid-cols-[110px_1fr_150px_120px_110px] md:items-center"
                          key={`${detalhe.transacaoId ?? detalhe.compraParceladaId ?? detalhe.descricao}-${detalhe.numeroParcela ?? detalheIndex}`}
                        >
                          <span className="text-slate-500 dark:text-slate-400">
                            {formatDate(detalhe.dataOcorrencia)}
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-800 dark:text-white">
                              {detalhe.descricao}
                            </span>
                            {detalhe.numeroParcela &&
                              detalhe.quantidadeParcelas && (
                                <span className="ml-2 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                  {detalhe.numeroParcela}/
                                  {detalhe.quantidadeParcelas}
                                </span>
                              )}
                            {detalhe.isDividida && (
                              <span className="ml-2 inline-flex items-center gap-1 rounded bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                                <UsersRound size={12} />
                                Dividida
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{
                                backgroundColor: detalhe.categoriaCorHexa,
                              }}
                            />
                            <span className="truncate text-slate-600 dark:text-slate-300">
                              {detalhe.categoriaNome}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-red-700">
                              - {formatCurrency(detalhe.valor)}
                            </span>
                            {detalhe.isDividida &&
                              detalhe.valorTotalOriginal != null && (
                                <span className="ml-1 whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400">
                                  ({formatCurrency(detalhe.valorTotalOriginal)})
                                </span>
                              )}
                          </div>
                          <div className="flex justify-end gap-2">
                            {detalhe.compraParceladaId &&
                              detalhe.numeroParcela &&
                              detalhe.origem !== "Transacao" &&
                              isFutureMonth(fatura.dataVencimento) && (
                                <button
                                  className="rounded-full p-2 text-slate-400 hover:bg-[var(--app-primary-soft)] hover:text-[var(--app-primary)]"
                                  type="button"
                                  onClick={() =>
                                    onAnticipate(
                                      mapFaturaDetalheToExtratoItem(
                                        fatura,
                                        detalhe,
                                      ),
                                    )
                                  }
                                  title="Antecipar parcela"
                                >
                                  <CalendarClock size={16} />
                                </button>
                              )}
                            <button
                              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              type="button"
                              onClick={() =>
                                onEdit(
                                  mapFaturaDetalheToExtratoItem(
                                    fatura,
                                    detalhe,
                                  ),
                                )
                              }
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"
                              type="button"
                              onClick={() =>
                                onDelete(
                                  mapFaturaDetalheToExtratoItem(
                                    fatura,
                                    detalhe,
                                  ),
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function StatusButton({
  item,
  onToggle,
}: {
  item: ExtratoMensalItem;
  onToggle: (item: ExtratoMensalItem) => void;
}) {
  const isReceita = item.tipo === 1 || item.tipo === "Receita";
  const isFatura = item.origem === "FaturaCartao" && item.cartaoCreditoId;
  const isCompraCartao = item.formaPagamento === "Cartão de crédito";
  const isParcelaCarneProjetada =
    item.origem === "Carne" &&
    item.isProjetada &&
    Boolean(item.compraParceladaId) &&
    Boolean(item.numeroParcela);
  const canToggle =
    !isReceita &&
    !isCompraCartao &&
    (Boolean(item.id) && (!item.isProjetada || item.isFixa) ||
      Boolean(isFatura) ||
      isParcelaCarneProjetada);
  const Icon = item.isPaga ? CheckCircle2 : Circle;

  if (!canToggle) {
    return null;
  }

  return (
    <button
      className={`absolute left-0 top-0 -translate-x-2 rounded-full p-1 opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 ${
        item.isPaga
          ? "text-emerald-600 hover:bg-emerald-50"
          : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
      }`}
      type="button"
      onClick={() => onToggle(item)}
      title={item.isPaga ? "Marcar como pendente" : "Marcar como pago"}
      aria-label={item.isPaga ? "Marcar como pendente" : "Marcar como pago"}
    >
      <Icon size={20} />
    </button>
  );
}

function CategoryIcon({ item }: { item: ExtratoMensalItem }) {
  const Icon =
    item.origem === "FaturaCartao" || item.formaPagamento === "Cartão de crédito"
      ? CreditCard
      : item.categoriaNome.toLowerCase().includes("carro")
        ? Car
        : Wallet;

  return (
    <Icon
      size={16}
      className="flex-shrink-0"
      style={{ color: item.categoriaCorHexa }}
    />
  );
}

function faturaKey(fatura: FaturaConsolidada) {
  return `${fatura.cartaoCreditoId}-${fatura.dataVencimento}`;
}

function isFutureMonth(value: string) {
  const data = parseLocalDate(value);
  const hoje = new Date();
  const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const mesDaParcela = new Date(data.getFullYear(), data.getMonth(), 1);

  return mesDaParcela > mesAtual;
}

function mapFaturaDetalheToExtratoItem(
  fatura: FaturaConsolidada,
  detalhe: FaturaConsolidada["detalhes"][number],
): ExtratoMensalItem {
  return {
    id: detalhe.transacaoId,
    codigoExibicao: null,
    tipo: 2,
    descricao: detalhe.descricao,
    valor: detalhe.valor,
    dataOcorrencia: detalhe.dataOcorrencia,
    categoriaId: detalhe.categoriaId,
    categoriaNome: detalhe.categoriaNome,
    categoriaCorHexa: detalhe.categoriaCorHexa,
    formaPagamento: "Cartão de crédito",
    cartaoCreditoId: fatura.cartaoCreditoId,
    contaBancariaId: null,
    cartaoCreditoApelido: fatura.nomeCartao,
    isFixa: detalhe.origem === "DespesaFixa",
    isPaga: false,
    isDividida: detalhe.isDividida,
    valorTotalOriginal: detalhe.valorTotalOriginal,
    percentualDivisao: detalhe.percentualDivisao,
    isProjetada: detalhe.origem !== "Transacao",
    origem: detalhe.origem,
    compraParceladaId: detalhe.compraParceladaId,
    numeroParcela: detalhe.numeroParcela,
    quantidadeParcelas: detalhe.quantidadeParcelas,
  };
}
