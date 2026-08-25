import { CalendarDays, CreditCard, Repeat2, UsersRound } from "lucide-react";
import type { DivisaoCompartilhada } from "../types/finance";
import { formatCurrency, formatDate } from "../utils/date";

type SharedTransactionsListProps = {
  items: DivisaoCompartilhada[];
  hiddenValues: boolean;
  isMutating?: boolean;
  onAccept?: (item: DivisaoCompartilhada) => void;
  onDecline?: (item: DivisaoCompartilhada) => void;
  onCancel?: (item: DivisaoCompartilhada) => void;
};

export function SharedTransactionsList({
  items,
  hiddenValues,
  isMutating = false,
  onAccept,
  onDecline,
  onCancel,
}: SharedTransactionsListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[color:var(--app-card-border)] bg-[var(--app-card)] px-5 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
        <UsersRound className="mx-auto text-slate-400" size={28} />
        <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
          Nenhuma divisão compartilhada neste período.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => {
        const participanteAtual = item.participantes.find((participante) => participante.souEu);
        const podeResponder = item.meuPapel === "Convidado" &&
          statusParticipante(participanteAtual?.status) === "Pendente";
        const podeCancelar = item.meuPapel === "Criador" ||
          statusParticipante(participanteAtual?.status) === "Aceito";

        return (
          <article
            className="rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            key={item.divisaoId}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="break-words font-bold text-slate-900 dark:text-white">
                  {item.descricao}
                </h4>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {item.meuPapel === "Criador"
                    ? "Criada por você"
                    : `Compartilhada por ${item.nomeCriador}`}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Valor label="Valor total" value={item.valorTotal} hidden={hiddenValues} />
              <Valor label="Sua parte" value={item.minhaParte} hidden={hiddenValues} emphasis />
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <CalendarDays size={15} />
                <span>{formatDate(item.dataReferencia)}</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-right text-slate-500 dark:text-slate-400">
                {iconeOrigem(item.origem)}
                <span>{rotuloOrigem(item)}</span>
              </div>
            </div>

            <details className="mt-4 border-t border-[color:var(--app-card-border)] pt-3 dark:border-slate-800">
              <summary className="cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-200">
                Participantes
              </summary>
              <div className="mt-3 space-y-2">
                {item.participantes.map((participante) => (
                  <div
                    className="flex items-center justify-between gap-3 text-sm"
                    key={participante.id}
                  >
                    <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                      {participante.souEu ? "Você" : participante.nomeExibicao}
                      <span className="ml-1 text-xs text-slate-400">
                        {formatPercent(participante.percentual)} · {statusParticipante(participante.status)}
                      </span>
                    </span>
                    <strong className="shrink-0 text-slate-800 dark:text-slate-100">
                      {hiddenValues ? "R$ •••••" : formatCurrency(participante.valor)}
                    </strong>
                  </div>
                ))}
              </div>
              {item.quantidadeParcelas > 1 && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Total da série: {hiddenValues ? "R$ •••••" : formatCurrency(item.valorTotalSerie)}
                </p>
              )}
            </details>

            {(podeResponder || podeCancelar) && (
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[color:var(--app-card-border)] pt-3 dark:border-slate-800">
                {podeResponder && (
                  <>
                    <button
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
                      type="button"
                      disabled={isMutating}
                      onClick={() => onDecline?.(item)}
                    >
                      Recusar
                    </button>
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                      type="button"
                      disabled={isMutating}
                      onClick={() => onAccept?.(item)}
                    >
                      Aceitar
                    </button>
                  </>
                )}
                {!podeResponder && podeCancelar && (
                  <button
                    className="rounded-lg border border-[color:var(--app-card-border)] px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                    type="button"
                    disabled={isMutating}
                    onClick={() => onCancel?.(item)}
                  >
                    {item.meuPapel === "Criador" ? "Cancelar divisão" : "Remover participação"}
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Valor({
  label,
  value,
  hidden,
  emphasis = false,
}: {
  label: string;
  value: number;
  hidden: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className={emphasis ? "text-right" : undefined}>
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className={`mt-1 font-bold ${emphasis ? "text-emerald-600 dark:text-emerald-300" : "text-slate-800 dark:text-slate-100"}`}>
        {hidden ? "R$ •••••" : formatCurrency(value)}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: number | string }) {
  const label = statusDivisao(status);
  const tone = label === "Aceita"
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
    : label === "Cancelada"
      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>;
}

function statusDivisao(status: number | string) {
  const labels: Record<string, string> = {
    "1": "Pendente",
    "2": "Parcialmente aceita",
    "3": "Aceita",
    "4": "Recusa pendente",
    "5": "Alteração pendente",
    "6": "Cancelada",
    "7": "Expirada",
  };
  return labels[String(status)] ?? String(status).replace(/([a-z])([A-Z])/g, "$1 $2");
}

function statusParticipante(status: number | string | undefined) {
  const labels: Record<string, string> = {
    "1": "Pendente",
    "2": "Aceito",
    "3": "Recusado",
    "4": "Cancelado",
    "5": "Expirado",
  };
  return status === undefined ? "Pendente" : labels[String(status)] ?? String(status);
}

function rotuloOrigem(item: DivisaoCompartilhada) {
  if (item.quantidadeParcelas > 1) {
    const parcela = item.parcelaInicial === item.parcelaFinal
      ? `${item.parcelaInicial}/${item.quantidadeParcelas}`
      : `${item.parcelaInicial}-${item.parcelaFinal}/${item.quantidadeParcelas}`;
    return `${parcela} · ${item.origem === "Carne" ? "Carnê" : "Parcelada"}`;
  }
  const labels: Record<string, string> = {
    CartaoCredito: "Cartão de crédito",
    CartaoRecorrente: "Cartão recorrente",
    Fixa: "Fixa",
    Avulsa: "Avulsa",
  };
  return labels[item.origem] ?? item.origem;
}

function iconeOrigem(origem: string) {
  return origem.startsWith("Cartao")
    ? <CreditCard size={15} />
    : <Repeat2 size={15} />;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;
}
