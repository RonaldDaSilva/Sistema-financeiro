type LoadingStateProps = {
  label?: string;
  fullScreen?: boolean;
  className?: string;
};

export function LoadingState({
  label = "Carregando",
  fullScreen = false,
  className = "",
}: LoadingStateProps) {
  return (
    <div
      className={`flex items-center justify-center ${
        fullScreen
          ? "min-h-screen bg-[var(--app-bg)] px-4 dark:bg-slate-950"
          : "min-h-32 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 dark:border-slate-800 dark:bg-slate-900"
      } ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-3">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--app-accent)] dark:border-slate-800 dark:border-t-emerald-300" />
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
