import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import * as notificationService from "../services/notificationService";
import * as financeService from "../services/financeService";
import { useNotificacoesNaoLidas } from "../hooks/queries/useNotificationQueries";
import { queryKeys } from "../hooks/queries/queryKeys";
import type { DivisaoTransacao, DivisaoVersao } from "../types/finance";
import type { Notificacao } from "../types/notification";

type NotificationBellProps = {
  placement?: "header" | "sidebar";
};

export function NotificationBell({ placement = "header" }: NotificationBellProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [canLoadNotifications, setCanLoadNotifications] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [divisaoAberta, setDivisaoAberta] = useState<DivisaoTransacao | null>(null);
  const [notificacaoAberta, setNotificacaoAberta] = useState<Notificacao | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
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

  async function abrirDivisao(notificacao: Notificacao) {
    if (!notificacao.entidadeId) return;
    setError(null);
    setIsActionLoading(true);
    try {
      const divisao = await financeService.obterDivisaoTransacao(notificacao.entidadeId);
      setDivisaoAberta(divisao);
      setNotificacaoAberta(notificacao);
    } catch {
      setError("Não foi possível carregar os detalhes da divisão.");
    } finally {
      setIsActionLoading(false);
    }
  }

  async function executarAcaoDivisao(acao: "aceitar" | "aceitar-classificar" | "recusar" | "assumir" | "reenviar" | "excluir" | "aceitar-alteracao" | "recusar-alteracao") {
    if (!divisaoAberta) return;
    setError(null);
    setIsActionLoading(true);
    try {
      const participantePendente = divisaoAberta.participantes.find((participante) =>
        isStatus(participante.status, "Pendente", 1) &&
        participante.tipoParticipante !== "Criador" &&
        participante.tipoParticipante !== 1,
      );
      const alteracaoPendente = obterAlteracaoPendente(divisaoAberta);

      if (acao === "aceitar" && participantePendente) {
        await financeService.aceitarDivisao(participantePendente.id);
      } else if (acao === "aceitar-classificar" && participantePendente) {
        await financeService.aceitarClassificarDivisao(participantePendente.id, {});
      } else if (acao === "recusar" && participantePendente) {
        await financeService.recusarDivisao(participantePendente.id);
      } else if (acao === "assumir") {
        await financeService.assumirValorDivisao(divisaoAberta.id);
      } else if (acao === "reenviar") {
        await financeService.reenviarDivisao(divisaoAberta.id);
      } else if (acao === "excluir") {
        await financeService.excluirDivisao(divisaoAberta.id);
      } else if (acao === "aceitar-alteracao" && alteracaoPendente) {
        await financeService.aceitarAlteracaoDivisao(alteracaoPendente.id);
      } else if (acao === "recusar-alteracao" && alteracaoPendente) {
        await financeService.recusarAlteracaoDivisao(alteracaoPendente.id);
      }

      setDivisaoAberta(null);
      setNotificacaoAberta(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.notificacoesNaoLidas }),
        queryClient.invalidateQueries({ queryKey: queryKeys.extratoScope }),
        queryClient.invalidateQueries({ queryKey: queryKeys.extratoPaginadoScope }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardScope }),
      ]);
    } catch {
      setError("Não foi possível executar a ação da divisão.");
    } finally {
      setIsActionLoading(false);
    }
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
                  {notificacao.entidade === "DivisaoTransacao" &&
                    notificacao.entidadeId &&
                    notificacao.acaoPendente && (
                      <button
                        className="mt-3 min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => abrirDivisao(notificacao)}
                      >
                        Ver ações
                      </button>
                    )}
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {divisaoAberta && notificacaoAberta && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[min(90dvh,42rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                  Divisão
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                  {notificacaoAberta.titulo}
                </h2>
              </div>
              <button
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                type="button"
                onClick={() => {
                  setDivisaoAberta(null);
                  setNotificacaoAberta(null);
                }}
              >
                Fechar
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {notificacaoAberta.mensagem}
            </p>
            <DivisionNotificationDetails divisao={divisaoAberta} />
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {notificacaoAberta.acaoPendente === "ResponderDivisao" && (
                <>
                  <ActionButton disabled={isActionLoading} onClick={() => executarAcaoDivisao("aceitar")}>
                    Aceitar
                  </ActionButton>
                  <ActionButton disabled={isActionLoading} onClick={() => executarAcaoDivisao("aceitar-classificar")}>
                    Aceitar e classificar
                  </ActionButton>
                  <ActionButton tone="danger" disabled={isActionLoading} onClick={() => executarAcaoDivisao("recusar")}>
                    Recusar
                  </ActionButton>
                </>
              )}
              {notificacaoAberta.acaoPendente === "DecidirRecusaDivisao" && (
                <>
                  <ActionButton disabled={isActionLoading} onClick={() => executarAcaoDivisao("assumir")}>
                    Assumir valor
                  </ActionButton>
                  <ActionButton disabled={isActionLoading} onClick={() => executarAcaoDivisao("reenviar")}>
                    Reenviar
                  </ActionButton>
                  <ActionButton tone="danger" disabled={isActionLoading} onClick={() => executarAcaoDivisao("excluir")}>
                    Excluir
                  </ActionButton>
                  <p className="sm:col-span-3 text-xs text-slate-500 dark:text-slate-400">
                    Assumir incorpora a parte recusada à sua responsabilidade econômica. Excluir cancela futuras ocorrências conforme o escopo padrão.
                  </p>
                </>
              )}
              {notificacaoAberta.acaoPendente === "ResponderAlteracaoDivisao" && (
                <>
                  <ActionButton disabled={isActionLoading} onClick={() => executarAcaoDivisao("aceitar-alteracao")}>
                    Aceitar alteração
                  </ActionButton>
                  <ActionButton tone="danger" disabled={isActionLoading} onClick={() => executarAcaoDivisao("recusar-alteracao")}>
                    Recusar alteração
                  </ActionButton>
                  <p className="sm:col-span-3 text-xs text-slate-500 dark:text-slate-400">
                    Enquanto pendente, a versão anterior continua válida no extrato.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DivisionNotificationDetails({ divisao }: { divisao: DivisaoTransacao }) {
  const convidado = divisao.participantes.find(
    (participante) =>
      participante.tipoParticipante !== "Criador" &&
      participante.tipoParticipante !== 1,
  );
  const alteracao = obterAlteracaoPendente(divisao);

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
      <DetailRow label="Valor total" value={formatCurrency(divisao.valorTotal)} />
      {convidado && (
        <>
          <DetailRow label="Sua parte" value={formatCurrency(convidado.valor)} />
          <DetailRow label="Percentual" value={`${convidado.percentual.toLocaleString("pt-BR")}%`} />
          {convidado.expiraEm && (
            <DetailRow label="Expira em" value={formatDateTime(convidado.expiraEm)} />
          )}
        </>
      )}
      {alteracao && (
        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="font-black text-slate-900 dark:text-white">Comparação da alteração</p>
          <DetailRow label="Atual" value={`${formatCurrency(alteracao.valorParticipanteAnterior)} — vencimento ${alteracao.vencimentoAnterior ?? "atual"}`} />
          <DetailRow label="Proposto" value={`${formatCurrency(alteracao.valorParticipanteProposto)} — vencimento ${alteracao.vencimentoProposto ?? "sem alteração"}`} />
        </div>
      )}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  tone = "primary",
  onClick,
}: {
  children: string;
  disabled?: boolean;
  tone?: "primary" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      className={`min-h-11 rounded-xl px-4 text-sm font-black transition disabled:opacity-60 ${
        tone === "danger"
          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
          : "bg-[var(--app-accent)] text-[var(--app-accent-contrast)] hover:opacity-90 dark:bg-white dark:text-slate-950"
      }`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function obterAlteracaoPendente(divisao: DivisaoTransacao): DivisaoVersao | null {
  return (
    divisao.versoes.find((versao) => isStatus(versao.status, "Pendente", 1)) ??
    divisao.versoes.find((versao) => isStatus(versao.status, "PropostaPendente", 2)) ??
    null
  );
}

function isStatus(value: string | number, text: string, numeric: number) {
  return value === text || value === numeric;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
