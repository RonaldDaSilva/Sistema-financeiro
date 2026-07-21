import { Info } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type InfoTooltipProps = {
  label: string;
  children: string;
};

export function InfoTooltip({ label, children }: InfoTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  function updatePosition() {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;

    if (!trigger || !tooltip) {
      return;
    }

    const margin = 12;
    const gap = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width || 288;
    const tooltipHeight = tooltipRect.height || 80;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const hasSpaceBelow = triggerRect.bottom + gap + tooltipHeight <= viewportHeight - margin;

    const preferredLeft = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    const left = Math.min(
      Math.max(preferredLeft, margin),
      Math.max(margin, viewportWidth - tooltipWidth - margin),
    );
    const top = hasSpaceBelow
      ? triggerRect.bottom + gap
      : Math.max(margin, triggerRect.top - tooltipHeight - gap);

    setPosition({ left, top });
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);

    return () => window.cancelAnimationFrame(frame);
  }, [open, children]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <span
      className="inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
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
      {open && createPortal(
        <span
          ref={tooltipRef}
          id={id}
          role="tooltip"
          className="fixed z-[9999] w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 text-left text-xs font-semibold leading-relaxed text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          style={{
            left: position?.left ?? -9999,
            top: position?.top ?? -9999,
            maxHeight: "min(18rem, calc(100dvh - 1.5rem))",
            overflowY: "auto",
          }}
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
