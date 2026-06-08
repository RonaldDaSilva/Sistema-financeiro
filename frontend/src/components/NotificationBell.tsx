import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import * as notificationService from "../services/notificationService";
import type { Notificacao } from "../types/notification";

export function NotificationBell() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async () => {
    setIsLoading(true);

    try {
      setNotificacoes(await notificationService.listarNaoLidas());
    } catch {
      setNotificacoes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const interval = window.setInterval(carregar, 5 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [carregar]);

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
    await notificationService.marcarTodasComoLidas();
    setNotificacoes([]);
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        type="button"
        aria-label="Notificações"
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
        <div className="absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="font-semibold text-slate-900 dark:text-white">
              Notificações
            </p>
            <button
              className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white"
              type="button"
              disabled={notificacoes.length === 0}
              onClick={handleMarcarComoLidas}
            >
              Marcar todas como lidas
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
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
