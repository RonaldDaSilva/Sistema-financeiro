import { useCallback, useState, type ReactNode } from "react";
import { X } from "lucide-react";

type ConfirmVariant = "default" | "danger";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        ...options,
        confirmLabel: options.confirmLabel ?? "Confirmar",
        cancelLabel: options.cancelLabel ?? "Cancelar",
        variant: options.variant ?? "default",
        resolve,
      });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      state?.resolve(result);
      setState(null);
    },
    [state],
  );

  const dialog: ReactNode = state ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="relative border-b border-[color:var(--app-card-border)] bg-slate-50/60 px-6 py-5 pr-16 dark:border-slate-800 dark:bg-slate-950/50">
          <button
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:hover:bg-slate-800 dark:hover:text-white"
            type="button"
            onClick={() => close(false)}
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {state.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {state.message}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 bg-[var(--app-card)] px-6 py-5 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            type="button"
            onClick={() => close(false)}
          >
            {state.cancelLabel}
          </button>
          <button
            className={
              state.variant === "danger"
                ? "rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-800"
                : "rounded-xl bg-[var(--app-accent)] px-5 py-2.5 text-sm font-bold text-[var(--app-accent-contrast)] shadow-sm transition-colors hover:opacity-90 dark:bg-white dark:text-slate-950"
            }
            type="button"
            onClick={() => close(true)}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
