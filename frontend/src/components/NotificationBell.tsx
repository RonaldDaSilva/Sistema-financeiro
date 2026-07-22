import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import * as notificationService from "../services/notificationService";
import { useNotificacoesNaoLidas } from "../hooks/queries/useNotificationQueries";
import { queryKeys } from "../hooks/queries/queryKeys";

type NotificationBellProps = {
  placement?: "header" | "sidebar";
};

export function NotificationBell({ placement = "header" }: NotificationBellProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [canLoadNotifications, setCanLoadNotifications] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: notificacoes = [], isLoading } = useNotificacoesNaoLidas(
    canLoadNotifications || isOpen,
  );
  const menuRef = useRef<HTMLDivElement | null>(null);
  const marcarComoLidasMutation = useMutation({
    mutationFn: notificationService.marcarTodasComoLidas,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.notificacoesNaoLidas, []);
      setError(null);
      setIsOpen(false);
    },
    onError: () => {
      setError("Não foi possível marcar as notificações como lidas.");
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setCanLoadNotifications(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarcarComoLidas() {
    if (marcarComoLidasMutation.isPending || notificacoes.length === 0) {
      return;
    }

    marcarComoLidasMutation.mutate();
  }

  const dropdownClass =
    placement === "sidebar"
      ? "absolute bottom-0 left-full z-[90] ml-4 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      : "absolute right-0 top-full z-[90] mt-3 w-[calc(100vw-2rem)] max-w-80 overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-2xl dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        type="button"
        aria-label="Notificações"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Bell size={20} />
        {notificacoes.length > 0 && (
          <span className="absolute right-1 top-1 min-w-4 rounded-full border-2 border-white bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white dark:border-slate-900">
            {notificacoes.length > 99 ? "99+" : notificacoes.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={dropdownClass}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="min-w-0 truncate font-semibold text-slate-900 dark:text-white">
              Notificações
            </p>
            <button
              className="shrink-0 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white"
              type="button"
              disabled={notificacoes.length === 0 || marcarComoLidasMutation.isPending}
              onClick={handleMarcarComoLidas}
            >
              {marcarComoLidasMutation.isPending ? "Marcando..." : "Marcar todas como lidas"}
            </button>
          </div>

          <div className="max-h-[min(24rem,calc(100vh-8rem))] overflow-y-auto">
            {error && (
              <p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" role="alert">
                {error}
              </p>
            )}
            {isLoading && notificacoes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                Carregando...
              </p>
            ) : notificacoes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                Nenhuma notificação não lida.
              </p>
            ) : (
              notificacoes.map((notificacao) => (
                <article
                  className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800"
                  key={notificacao.id}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-600" />
                    <p className="font-medium text-slate-900 dark:text-white">
                      {notificacao.titulo}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {notificacao.mensagem}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDateTime(notificacao.dataCriacao)}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
