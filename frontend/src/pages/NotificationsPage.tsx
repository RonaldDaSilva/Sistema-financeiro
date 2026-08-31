import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock3,
  Split,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { LoadingState } from "../components/LoadingState";
import { useNotificacoes } from "../hooks/queries/useNotificationQueries";
import { queryKeys } from "../hooks/queries/queryKeys";
import * as financeService from "../services/financeService";
import * as notificationService from "../services/notificationService";
import type { DivisaoTransacao } from "../types/finance";
import type {
  CategoriaNotificacao,
  FiltroNotificacao,
  Notificacao,
} from "../types/notification";

const filtros: Array<{ value: FiltroNotificacao; label: string }> = [
  { value: "Todas", label: "Todas" },
  { value: "NaoLidas", label: "Não lidas" },
  { value: "Pendentes", label: "Pendentes" },
  { value: "Concluidas", label: "Concluídas" },
];

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<FiltroNotificacao>("Todas");
  const [categoria, setCategoria] = useState<CategoriaNotificacao>(null);
  const query = useNotificacoes(pagina, filtro, categoria);
  const marcarTodas = useMutation({
    mutationFn: notificationService.marcarTodasComoLidas,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificacoesScope }),
  });

  function alterarFiltro(next: FiltroNotificacao) {
    setFiltro(next);
    setPagina(1);
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--app-accent)]">Central</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Notificações</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Acompanhe avisos e resolva decisões pendentes sem perder o histórico.
            </p>
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-4 text-sm font-bold text-slate-700 transition hover:bg-[var(--app-card-muted)] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            disabled={marcarTodas.isPending || query.data?.itens.every((item) => item.lida)}
            onClick={() => marcarTodas.mutate()}
            type="button"
          >
            <CheckCheck size={18} />
            {marcarTodas.isPending ? "Marcando..." : "Marcar todas como lidas"}
          </button>
        </header>

        <section className="mt-6 space-y-3" aria-label="Filtros de notificações">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filtros.map((item) => (
              <button
                className={`min-h-10 shrink-0 rounded-lg px-4 text-sm font-bold transition ${
                  filtro === item.value
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "border border-[color:var(--app-card-border)] bg-[var(--app-card)] text-slate-600 hover:bg-[var(--app-card-muted)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
                key={item.value}
                onClick={() => alterarFiltro(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="block max-w-xs space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Categoria</span>
            <select
              aria-label="Categoria de notificação"
              className="min-h-11 w-full rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              value={categoria ?? ""}
              onChange={(event) => {
                setCategoria((event.target.value || null) as CategoriaNotificacao);
                setPagina(1);
              }}
            >
              <option value="">Todas as categorias</option>
              <option value="Divisoes">Divisões e alterações</option>
              <option value="Sistema">Sistema</option>
            </select>
          </label>
        </section>

        <section className="mt-6 space-y-3" aria-live="polite">
          {query.isLoading ? (
            <LoadingState label="Carregando notificações" />
          ) : query.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert">
              Não foi possível carregar as notificações.
              <button className="ml-2 underline" onClick={() => query.refetch()} type="button">Tentar novamente</button>
            </div>
          ) : query.data?.itens.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--app-card-border)] bg-[var(--app-card)] p-8 text-center dark:border-slate-700 dark:bg-slate-900">
              <Bell size={28} className="text-slate-400" />
              <p className="mt-3 font-black text-slate-900 dark:text-white">Nenhuma notificação neste filtro</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Novos avisos e decisões aparecerão aqui.</p>
            </div>
          ) : (
            query.data?.itens.map((notificacao) => (
              <NotificationCard key={notificacao.id} notificacao={notificacao} />
            ))
          )}
        </section>

        {(query.data?.totalPaginas ?? 0) > 1 && (
          <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Paginação de notificações">
            <button className={paginationClass} disabled={pagina === 1} onClick={() => setPagina((current) => current - 1)} type="button">
              <ChevronLeft size={18} /> Anterior
            </button>
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
              Página {pagina} de {query.data?.totalPaginas}
            </span>
            <button className={paginationClass} disabled={pagina >= (query.data?.totalPaginas ?? 0)} onClick={() => setPagina((current) => current + 1)} type="button">
              Próxima <ChevronRight size={18} />
            </button>
          </nav>
        )}
      </div>
    </AppLayout>
  );
}

function NotificationCard({ notificacao }: { notificacao: Notificacao }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [cartaoCreditoId, setCartaoCreditoId] = useState("");
  const detailsQuery = useQuery({
    queryKey: queryKeys.divisaoTransacao(notificacao.entidadeId ?? ""),
    queryFn: ({ signal }) => financeService.obterDivisaoTransacao(notificacao.entidadeId!, signal),
    enabled: expanded && notificacao.entidade === "DivisaoTransacao" && Boolean(notificacao.entidadeId),
    staleTime: 30 * 1000,
  });
  const classificationEnabled = expanded && classifying && Boolean(detailsQuery.data);
  const financialClassificationEnabled = classificationEnabled && !detailsQuery.data?.compraParceladaId;
  const categoriasQuery = useQuery({
    queryKey: queryKeys.categorias,
    queryFn: ({ signal }) => financeService.listarCategorias(signal),
    enabled: financialClassificationEnabled,
    staleTime: 10 * 60 * 1000,
  });
  const contasQuery = useQuery({
    queryKey: queryKeys.contas,
    queryFn: ({ signal }) => financeService.listarContasBancarias(signal),
    enabled: financialClassificationEnabled,
    staleTime: 10 * 60 * 1000,
  });
  const cartoesQuery = useQuery({
    queryKey: queryKeys.cartoesOpcoes,
    queryFn: ({ signal }) => financeService.listarCartoesCreditoOpcoes(signal),
    enabled: classificationEnabled,
    staleTime: 20 * 60 * 1000,
  });
  const marcarLida = useMutation({
    mutationFn: () => notificationService.marcarComoLida(notificacao.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificacoesScope }),
  });
  const Icon = notificationIcon(notificacao);
  const isPending = Boolean(notificacao.acaoPendente);

  async function execute(action: NotificationAction) {
    const divisao = detailsQuery.data;
    if (!divisao) return;
    if (action === "recusar" && !window.confirm("Essa despesa não será adicionada ao seu extrato. O criador será notificado.")) return;
    if (action === "assumir" && !window.confirm("Você passará a assumir a parte recusada desta despesa.")) return;
    if (action === "manter-parte" && !window.confirm("Você manterá somente sua responsabilidade atual. Continuar?")) return;

    setActionLoading(true);
    setError(null);
    setMessage(null);
    try {
      const participantId = notificacao.participanteDivisaoId;
      const participant = divisao.participantes.find((item) =>
        (!participantId || item.id === participantId) &&
        !isCreator(item.tipoParticipante) &&
        isStatus(item.status, "Pendente", 1));
      const version = divisao.versoes.find((item) => isStatus(item.status, "PropostaPendente", 2));

      if (action === "aceitar" && participant) await financeService.aceitarDivisao(participant.id);
      else if (action === "aceitar-classificar" && participant) {
        await financeService.aceitarClassificarDivisao(participant.id, {
          categoriaId: categoriaId || null,
          contaBancariaId: contaBancariaId || null,
          cartaoCreditoId: cartaoCreditoId || null,
        });
      }
      else if (action === "recusar" && participant) await financeService.recusarDivisao(participant.id);
      else if (action === "assumir") await financeService.assumirValorDivisao(divisao.id, participantId);
      else if (action === "reenviar") await financeService.reenviarDivisao(divisao.id, { participanteId: participantId });
      else if (action === "manter-parte" && participantId) await financeService.manterParteCriadorDivisao(participantId);
      else if (action === "aceitar-alteracao" && version) await financeService.aceitarAlteracaoDivisao(version.id);
      else if (action === "recusar-alteracao" && version) await financeService.recusarAlteracaoDivisao(version.id);
      else if (action === "manter-anterior" && version) await financeService.manterVersaoAnteriorDivisao(version.id);
      else if (action === "reenviar-alteracao" && version) await financeService.reenviarAlteracaoDivisao(version.id);
      else if (action === "cancelar") await financeService.excluirDivisao(divisao.id);
      else throw new Error("A ação não está mais disponível.");

      setMessage(actionSuccess(action));
      setClassifying(false);
      await Promise.all(invalidationKeys(action, divisao.id).map((queryKey) =>
        queryClient.invalidateQueries({ queryKey })));
    } catch {
      setError("Não foi possível concluir esta ação.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <article className={`rounded-lg border bg-[var(--app-card)] shadow-sm dark:bg-slate-900 ${notificacao.lida ? "border-[color:var(--app-card-border)] dark:border-slate-800" : "border-[var(--app-accent)]/40 dark:border-emerald-500/40"}`}>
      <div className="flex gap-3 p-4 sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--app-primary-soft)] text-[var(--app-primary)] dark:bg-slate-800 dark:text-emerald-300">
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-black text-slate-950 dark:text-white">{notificacao.titulo}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{notificacao.mensagem}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!notificacao.lida && <StatusBadge icon={BellRing} label="Não lida" tone="info" />}
              {isPending ? <StatusBadge icon={Clock3} label="Pendente" tone="warning" /> : notificacao.statusAcao === "Concluida" ? <StatusBadge icon={CircleCheck} label="Concluída" tone="success" /> : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <time dateTime={notificacao.dataCriacao}>{formatDateTime(notificacao.dataCriacao)}</time>
            {!notificacao.lida && (
              <button className="font-bold text-[var(--app-accent)] hover:underline" disabled={marcarLida.isPending} onClick={() => marcarLida.mutate()} type="button">
                Marcar como lida
              </button>
            )}
          </div>
        </div>
      </div>

      {notificacao.entidade === "DivisaoTransacao" && notificacao.entidadeId && (
        <div className="border-t border-[color:var(--app-card-border)] dark:border-slate-800">
          <button className="flex min-h-11 w-full items-center justify-between px-4 text-sm font-bold text-slate-700 hover:bg-[var(--app-card-muted)] dark:text-slate-200 dark:hover:bg-slate-800 sm:px-5" onClick={() => setExpanded((current) => !current)} type="button" aria-expanded={expanded}>
            {expanded ? "Ocultar detalhes" : "Ver detalhes e ações"}
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {expanded && (
            <div className="border-t border-[color:var(--app-card-border)] p-4 dark:border-slate-800 sm:p-5">
              {detailsQuery.isLoading ? <LoadingState label="Carregando detalhes" /> : detailsQuery.isError ? (
                <p className="text-sm font-semibold text-red-600" role="alert">Não foi possível carregar os detalhes.</p>
              ) : detailsQuery.data ? (
                <>
                  <DivisionDetails divisao={detailsQuery.data} notification={notificacao} />
                  {isPending && (
                    <NotificationActions
                      action={notificacao.acaoPendente!}
                      disabled={actionLoading}
                      execute={execute}
                      onClassify={() => setClassifying((current) => !current)}
                      type={notificacao.tipoNotificacao}
                    />
                  )}
                  {classifying && detailsQuery.data && (
                    <ClassificationFields
                      cartaoCreditoId={cartaoCreditoId}
                      cartoes={cartoesQuery.data ?? []}
                      categoriaId={categoriaId}
                      categorias={categoriasQuery.data ?? []}
                      contaBancariaId={contaBancariaId}
                      contas={contasQuery.data ?? []}
                      disabled={actionLoading || categoriasQuery.isLoading || contasQuery.isLoading || cartoesQuery.isLoading}
                      isInstallment={Boolean(detailsQuery.data.compraParceladaId)}
                      onCartaoChange={setCartaoCreditoId}
                      onCategoriaChange={setCategoriaId}
                      onContaChange={setContaBancariaId}
                      onSubmit={() => execute("aceitar-classificar")}
                    />
                  )}
                  {message && <p className="mt-4 text-sm font-bold text-emerald-700 dark:text-emerald-300" role="status">{message}</p>}
                  {error && <p className="mt-4 text-sm font-bold text-red-600" role="alert">{error}</p>}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function DivisionDetails({ divisao, notification }: { divisao: DivisaoTransacao; notification: Notificacao }) {
  const participant = divisao.participantes.find((item) =>
    (!notification.participanteDivisaoId || item.id === notification.participanteDivisaoId) && !isCreator(item.tipoParticipante));
  const version = divisao.versoes.find((item) => isStatus(item.status, "PropostaPendente", 2));
  const versionParticipant = version?.participantes?.find((item) =>
    !notification.participanteDivisaoId || item.participanteId === notification.participanteDivisaoId);
  return (
    <div className="grid gap-3 rounded-lg bg-[var(--app-card-muted)] p-4 text-sm dark:bg-slate-950 sm:grid-cols-2">
      <Detail label="Descrição" value={divisao.descricaoOrigem || notification.mensagem} />
      <Detail label="Valor total" value={formatCurrency(divisao.valorTotal)} />
      {participant && <Detail label={notification.acaoPendente === "DecidirRecusaDivisao" ? "Parte recusada" : "Sua parte"} value={`${formatCurrency(participant.valor)} · ${participant.percentual.toLocaleString("pt-BR")}%`} />}
      {divisao.dataSugeridaConvidado && <Detail label="Data/vencimento" value={formatDate(divisao.dataSugeridaConvidado)} />}
      {version && <>
        <Detail label="Valor total" value={`${formatCurrency(version.valorTotalAnterior)} → ${formatCurrency(version.valorTotalProposto)}`} />
        <Detail label="Parte proposta" value={`${formatCurrency(versionParticipant?.valorAnterior ?? version.valorParticipanteAnterior)} → ${formatCurrency(versionParticipant?.valorProposto ?? version.valorParticipanteProposto)}`} />
        <Detail label="Escopo" value={version.escopo === "EstaEProximas" ? "Este mês e próximos" : "Somente esta ocorrência"} />
      </>}
    </div>
  );
}

type NotificationAction = "aceitar" | "aceitar-classificar" | "recusar" | "assumir" | "reenviar" | "manter-parte" | "aceitar-alteracao" | "recusar-alteracao" | "manter-anterior" | "reenviar-alteracao" | "cancelar";

function NotificationActions({ action, disabled, execute, onClassify, type }: { action: string; disabled: boolean; execute: (action: NotificationAction) => void; onClassify: () => void; type: Notificacao["tipoNotificacao"] }) {
  const actions = action === "ResponderDivisao"
    ? [["aceitar", "Aceitar"], ["aceitar-classificar", "Aceitar e classificar"], ["recusar", "Recusar"]]
    : action === "DecidirRecusaDivisao"
      ? [["assumir", "Assumir despesa integralmente"], ["reenviar", "Reenviar convite"], ["manter-parte", "Manter somente minha parte"]]
      : action === "ResponderAlteracaoDivisao"
        ? [["aceitar-alteracao", "Aceitar alteração"], ["recusar-alteracao", "Recusar alteração"]]
        : type === "AlteracaoDivisaoRecusada" || type === 10
          ? [["manter-anterior", "Manter versão anterior"], ["reenviar-alteracao", "Reenviar alteração"], ["cancelar", "Cancelar divisão"]]
          : [];
  return <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions.map(([value, label]) => (
    <button className={`min-h-11 rounded-lg px-4 text-sm font-black transition disabled:opacity-50 ${value.includes("recusar") || value === "cancelar" ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" : "bg-[var(--app-accent)] text-[var(--app-accent-contrast)] hover:opacity-90 dark:bg-white dark:text-slate-950"}`} disabled={disabled} key={value} onClick={() => value === "aceitar-classificar" ? onClassify() : execute(value as NotificationAction)} type="button">{label}</button>
  ))}</div>;
}

type ClassificationFieldsProps = {
  cartaoCreditoId: string;
  cartoes: Awaited<ReturnType<typeof financeService.listarCartoesCreditoOpcoes>>;
  categoriaId: string;
  categorias: Awaited<ReturnType<typeof financeService.listarCategorias>>;
  contaBancariaId: string;
  contas: Awaited<ReturnType<typeof financeService.listarContasBancarias>>;
  disabled: boolean;
  isInstallment: boolean;
  onCartaoChange: (value: string) => void;
  onCategoriaChange: (value: string) => void;
  onContaChange: (value: string) => void;
  onSubmit: () => void;
};

function ClassificationFields(props: ClassificationFieldsProps) {
  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-4 dark:border-slate-700 dark:bg-slate-950 sm:grid-cols-2">
      {!props.isInstallment && (
        <label className="space-y-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          Categoria
          <select aria-label="Categoria da divisão" className={selectClass} disabled={props.disabled} onChange={(event) => props.onCategoriaChange(event.target.value)} value={props.categoriaId}>
            <option value="">Sem categoria</option>
            {props.categorias.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        </label>
      )}
      {!props.isInstallment && (
        <label className="space-y-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          Conta
          <select aria-label="Conta da divisão" className={selectClass} disabled={props.disabled} onChange={(event) => props.onContaChange(event.target.value)} value={props.contaBancariaId}>
            <option value="">Sem conta</option>
            {props.contas.map((item) => <option key={item.id} value={item.id}>{item.nomeCustomizado}</option>)}
          </select>
        </label>
      )}
      <label className="space-y-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
        Cartão
        <select aria-label="Cartão da divisão" className={selectClass} disabled={props.disabled} onChange={(event) => props.onCartaoChange(event.target.value)} value={props.cartaoCreditoId}>
          <option value="">Sem cartão</option>
          {props.cartoes.map((item) => <option key={item.id} value={item.id}>{item.apelidoCartao}</option>)}
        </select>
      </label>
      <div className="flex items-end sm:col-span-2">
        <button className="min-h-11 w-full rounded-lg bg-[var(--app-accent)] px-4 text-sm font-black text-[var(--app-accent-contrast)] disabled:opacity-50 dark:bg-white dark:text-slate-950 sm:w-auto" disabled={props.disabled} onClick={props.onSubmit} type="button">
          Aceitar e adicionar
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ icon: Icon, label, tone }: { icon: typeof Check; label: string; tone: "info" | "warning" | "success" }) {
  const tones = { info: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200", warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200", success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200" };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${tones[tone]}`}><Icon size={13} />{label}</span>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 font-bold text-slate-900 dark:text-white">{value}</dd></div>; }
function notificationIcon(notification: Notificacao) { return notification.entidade === "DivisaoTransacao" ? Split : notification.acaoPendente ? Clock3 : Bell; }
function isCreator(value: string | number) { return value === "Criador" || value === 1; }
function isStatus(value: string | number, text: string, numeric: number) { return value === text || value === numeric; }
function formatCurrency(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function actionSuccess(action: NotificationAction) { const labels: Record<NotificationAction, string> = { aceitar: "Divisão aceita.", "aceitar-classificar": "Divisão aceita e classificada.", recusar: "Divisão recusada.", assumir: "Valor assumido.", reenviar: "Convite reenviado.", "manter-parte": "Sua parte foi mantida.", "aceitar-alteracao": "Alteração aceita.", "recusar-alteracao": "Alteração recusada.", "manter-anterior": "Versão anterior mantida.", "reenviar-alteracao": "Alteração reenviada.", cancelar: "Divisão cancelada." }; return labels[action]; }
function invalidationKeys(action: NotificationAction, divisionId: string): Array<readonly unknown[]> { const base: Array<readonly unknown[]> = [queryKeys.notificacoesScope, queryKeys.divisaoTransacao(divisionId)]; if (["recusar", "reenviar", "manter-parte", "reenviar-alteracao"].includes(action)) return base; return [...base, queryKeys.extratoScope, queryKeys.extratoPaginadoScope, queryKeys.dashboardScope, queryKeys.relatoriosScope, queryKeys.faturasScope]; }
const paginationClass = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-4 text-sm font-bold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
const selectClass = "mt-1 min-h-11 w-full rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-3 text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
