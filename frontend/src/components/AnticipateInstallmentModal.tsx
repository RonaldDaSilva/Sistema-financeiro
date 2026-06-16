import { FormEvent, useEffect, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import type { ExtratoMensalItem } from "../types/finance";
import {
  formatCurrency,
  formatCurrencyInput,
  maskBrlCurrencyInput,
  parseBrlCurrency,
  toDateInputValue,
} from "../utils/date";

type AnticipateInstallmentModalProps = {
  item: ExtratoMensalItem | null;
  onClose: () => void;
  onConfirm: (request: {
    idCompraParcelada: string;
    numeroParcela: number;
    dataAntecipacao: string;
    valorPago: number;
  }) => Promise<void>;
};

export function AnticipateInstallmentModal({
  item,
  onClose,
  onConfirm,
}: AnticipateInstallmentModalProps) {
  const [dataAntecipacao, setDataAntecipacao] = useState(
    toDateInputValue(new Date()),
  );
  const [valorPago, setValorPago] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!item) {
      return;
    }

    setDataAntecipacao(toDateInputValue(new Date()));
    setValorPago(formatCurrencyInput(item.valor));
    setErro(null);
    setIsSubmitting(false);
  }, [item]);

  if (!item) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (!item?.compraParceladaId || !item.numeroParcela) {
      setErro("Parcela projetada inválida para antecipação.");
      return;
    }

    const valorNumerico = parseBrlCurrency(valorPago);
    if (valorNumerico <= 0) {
      setErro("Informe um valor pago maior que zero.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        idCompraParcelada: item.compraParceladaId,
        numeroParcela: item.numeroParcela,
        dataAntecipacao,
        valorPago: valorNumerico,
      });
      onClose();
    } catch {
      setErro("Não foi possível antecipar esta parcela.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <form
        className="w-full max-w-lg rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onSubmit={handleSubmit}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--app-primary-soft)] text-[var(--app-primary)]">
              <CalendarClock size={22} />
            </div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Antecipar parcela
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {item.descricao}
            </p>
          </div>
          <button
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            type="button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-5 rounded-2xl bg-[var(--app-card-muted)] p-4 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          Parcela original:{" "}
          <strong className="text-slate-900 dark:text-white">
            {formatCurrency(item.valor)}
          </strong>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Data do pagamento
            </span>
            <input
              className="w-full rounded-2xl border border-[color:var(--app-card-border)] bg-transparent px-4 py-3 text-slate-900 outline-none transition focus:border-[var(--app-primary)] dark:border-slate-700 dark:text-white"
              type="date"
              value={dataAntecipacao}
              onChange={(event) => setDataAntecipacao(event.target.value)}
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Valor pago
            </span>
            <input
              className="w-full rounded-2xl border border-[color:var(--app-card-border)] bg-transparent px-4 py-3 text-slate-900 outline-none transition focus:border-[var(--app-primary)] dark:border-slate-700 dark:text-white"
              inputMode="numeric"
              value={valorPago}
              onChange={(event) =>
                setValorPago(maskBrlCurrencyInput(event.target.value))
              }
              placeholder="R$ 0,00"
              required
            />
          </label>
        </div>

        {erro && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {erro}
          </div>
        )}

        <div className="mt-7 flex justify-end gap-3">
          <button
            className="rounded-2xl px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="rounded-2xl bg-[var(--app-primary,#2563eb)] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 ring-1 ring-black/5 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Antecipando..." : "Confirmar antecipação"}
          </button>
        </div>
      </form>
    </div>
  );
}
