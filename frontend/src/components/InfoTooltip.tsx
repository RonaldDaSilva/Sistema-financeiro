import { Info } from "lucide-react";
import { useId, useState } from "react";

type InfoTooltipProps = {
  label: string;
  children: string;
};

export function InfoTooltip({ label, children }: InfoTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 outline-none transition hover:bg-[var(--app-card-muted)] hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[var(--app-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-card)] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label={`Ajuda: ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <Info size={17} aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 text-left text-xs font-semibold leading-relaxed text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          {children}
        </span>
      )}
    </span>
  );
}
