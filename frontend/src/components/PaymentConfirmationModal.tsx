import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { ContaBancaria, ExtratoMensalItem } from "../types/finance";
import { formatCurrency, formatDate } from "../utils/date";

type PaymentConfirmationModalProps = {
  item: ExtratoMensalItem | null;
  contas: ContaBancaria[];
  isLoadingContas?: boolean;
  onClose: () => void;
  onConfirm: (contaBancariaId: string | null) => Promise<void>;
};

export function PaymentConfirmationModal({
  item,
  contas,
  isLoadingContas = false,
  onClose,
  onConfirm,
}: PaymentConfirmationModalProps) {
  const contaPadraoId = useMemo(() => {
    if (!item) {
      return "";
    }

    return item.contaBancariaId ??
      contas.find((conta) => conta.isFavorita)?.id ??
      "";
  }, [contas, item]);
  const [contaBancariaId, setContaBancariaId] = useState(contaPadraoId);
  const [erro, setErro] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setContaBancariaId(contaPadraoId);
    setErro(null);
    setIsSubmitting(false);
  }, [contaPadraoId, item]);

  if (!item) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setIsSubmitting(true);

    try {
      await onConfirm(contaBancariaId || null);
      onClose();
    } catch {
      setErro("Não foi possível registrar a baixa desta transação.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
      <form
        className="relative w-full max-w-md rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onSubmit={handleSubmit}
      >
        <button
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          type="button"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X size={19} />
        </button>

        <div className="flex items-start gap-4 pr-10">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 size={24} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Confirmar pagamento
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Selecione a conta usada para esta baixa.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-[var(--app-card-muted)] p-4 dark:bg-slate-950">
          <p className="truncate font-bold text-slate-900 dark:text-white">
            {item.descricao}
          </p>
          <div className="mt-2 flex items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>{formatDate(item.dataOcorrencia)}</span>
            <strong className="text-red-600 dark:text-red-300">
              {formatCurrency(item.valor)}
            </strong>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Conta de saída
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-[color:var(--app-card-border)] bg-transparent px-4 py-3 text-slate-900 outline-none transition focus:border-[var(--app-primary)] dark:border-slate-700 dark:text-white"
            value={contaBancariaId}
            disabled={isLoadingContas || isSubmitting}
            onChange={(event) => setContaBancariaId(event.target.value)}
          >
            <option value="">Não informar</option>
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nomeCustomizado}
                {conta.isFavorita ? " - favorita" : ""}
              </option>
            ))}
          </select>
        </label>

        {erro && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {erro}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-2xl px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="rounded-2xl bg-[var(--app-accent)] px-5 py-3 text-sm font-bold text-[var(--app-accent-contrast)] shadow-lg shadow-slate-900/10 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting || isLoadingContas}
          >
            {isSubmitting ? "Salvando..." : "Confirmar baixa"}
          </button>
        </div>
      </form>
    </div>
  );
}
