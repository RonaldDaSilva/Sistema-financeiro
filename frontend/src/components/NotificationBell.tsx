import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [classificacaoAberta, setClassificacaoAberta] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [cartaoCreditoId, setCartaoCreditoId] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const { data: notificacoes = [], isLoading } = useNotificacoesNaoLidas(
    canLoadNotifications || isOpen,
  );
  const classificacaoQueryEnabled = classificacaoAberta && Boolean(divisaoAberta);
  const classificacaoFinanceiraEnabled = classificacaoQueryEnabled &&
    !divisaoAberta?.compraParceladaId;
  const categoriasQuery = useQuery({
    queryKey: queryKeys.categorias,
    queryFn: ({ signal }) => financeService.listarCategorias(signal),
    enabled: classificacaoFinanceiraEnabled,
    staleTime: 10 * 60 * 1000,
  });
  const contasQuery = useQuery({
    queryKey: queryKeys.contas,
    queryFn: ({ signal }) => financeService.listarContasBancarias(signal),
    enabled: classificacaoFinanceiraEnabled,
    staleTime: 10 * 60 * 1000,
  });
  const cartoesQuery = useQuery({
    queryKey: queryKeys.cartoesOpcoes,
    queryFn: ({ signal }) => financeService.listarCartoesCreditoOpcoes(signal),
    enabled: classificacaoQueryEnabled,
    staleTime: 20 * 60 * 1000,
  });
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
    setMensagemSucesso(null);
    setIsActionLoading(true);
    try {
      const divisao = await financeService.obterDivisaoTransacao(notificacao.entidadeId);
      setDivisaoAberta(divisao);
      setNotificacaoAberta(notificacao);
      queryClient.setQueryData(queryKeys.divisaoTransacao(notificacao.entidadeId), divisao);
    } catch {
      setError("Não foi possível carregar os detalhes da divisão.");
    } finally {
      setIsActionLoading(false);
    }
  }

  async function executarAcaoDivisao(
    acao:
      | "aceitar"
      | "aceitar-classificar"
      | "recusar"
      | "assumir"
      | "reenviar"
      | "manter-parte"
      | "excluir"
      | "aceitar-alteracao"
      | "recusar-alteracao"
      | "manter-anterior"
      | "reenviar-alteracao",
  ) {
    if (!divisaoAberta) return;
    setError(null);
    setMensagemSucesso(null);
    if (acao === "recusar" && !window.confirm("Essa despesa não será adicionada ao seu extrato. O criador será notificado.")) {
      return;
    }
    const participanteAlvoId = notificacaoAberta?.participanteDivisaoId;
    if (acao === "manter-parte" && !participanteAlvoId) {
      setError("Não foi possível identificar a participação recusada.");
      return;
    }
    if (acao === "assumir" && !window.confirm(`Você passará a assumir ${formatCurrency(valorRecusado(divisaoAberta, participanteAlvoId))} desta despesa.`)) {
      return;
    }
    if (acao === "manter-parte" && !window.confirm("A parte recusada não será incorporada à sua despesa. Você manterá somente sua responsabilidade atual. Continuar?")) {
      return;
    }
    setIsActionLoading(true);
    try {
      const participantePendente = divisaoAberta.participantes.find((participante) =>
        isStatus(participante.status, "Pendente", 1) &&
        (!participanteAlvoId || participante.id === participanteAlvoId) &&
        participante.tipoParticipante !== "Criador" &&
        participante.tipoParticipante !== 1,
      );
      const alteracaoPendente = obterAlteracaoPendente(divisaoAberta);

      if (acao === "aceitar" && participantePendente) {
        await financeService.aceitarDivisao(participantePendente.id);
        setMensagemSucesso("Divisão aceita.");
      } else if (acao === "aceitar-classificar" && participantePendente) {
        await financeService.aceitarClassificarDivisao(participantePendente.id, {
          categoriaId: categoriaId || null,
          contaBancariaId: contaBancariaId || null,
          cartaoCreditoId: cartaoCreditoId || null,
        });
        setMensagemSucesso("Divisão aceita e classificada.");
      } else if (acao === "recusar" && participantePendente) {
        await financeService.recusarDivisao(participantePendente.id);
        setMensagemSucesso("Divisão recusada.");
      } else if (acao === "assumir") {
        await financeService.assumirValorDivisao(divisaoAberta.id, participanteAlvoId);
        setMensagemSucesso("Valor assumido.");
      } else if (acao === "reenviar") {
        await financeService.reenviarDivisao(divisaoAberta.id, {
          participanteId: participanteAlvoId,
        });
        setMensagemSucesso("Convite reenviado.");
      } else if (acao === "manter-parte" && participanteAlvoId) {
        await financeService.manterParteCriadorDivisao(participanteAlvoId);
        setMensagemSucesso("Sua parte foi mantida.");
      } else if (acao === "excluir") {
        await financeService.excluirDivisao(divisaoAberta.id);
        setMensagemSucesso("Divisão cancelada.");
      } else if (acao === "aceitar-alteracao" && alteracaoPendente) {
        await financeService.aceitarAlteracaoDivisao(alteracaoPendente.id);
        setMensagemSucesso("Alteração aceita.");
      } else if (acao === "recusar-alteracao" && alteracaoPendente) {
        await financeService.recusarAlteracaoDivisao(alteracaoPendente.id);
        setMensagemSucesso("Alteração recusada.");
      } else if (acao === "manter-anterior" && alteracaoPendente) {
        await financeService.manterVersaoAnteriorDivisao(alteracaoPendente.id);
        setMensagemSucesso("Versão anterior mantida.");
      } else if (acao === "reenviar-alteracao" && alteracaoPendente) {
        await financeService.reenviarAlteracaoDivisao(alteracaoPendente.id);
        setMensagemSucesso("Alteração reenviada.");
      }

      const invalidacoes = invalidacoesPorAcao(acao, divisaoAberta.id);
      setDivisaoAberta(null);
      setNotificacaoAberta(null);
      setClassificacaoAberta(false);
      await Promise.all(invalidacoes.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    } catch {
      setError("Não foi possível executar a ação da divisão.");
    } finally {
      setIsActionLoading(false);
    }
  }

  function abrirClassificacao() {
    setClassificacaoAberta(true);
    setCategoriaId(categoriasQuery.data?.[0]?.id ?? "");
    setContaBancariaId("");
    setCartaoCreditoId("");
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
            {mensagemSucesso && (
              <p className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100" role="status">
                {mensagemSucesso}
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
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-4">
          <div aria-modal="true" aria-labelledby="division-notification-title" role="dialog" className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[min(calc(100dvh-2rem),42rem)]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-[var(--app-card)] p-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                  Divisão
                </p>
                <h2 id="division-notification-title" className="mt-1 text-xl font-black text-slate-950 dark:text-white">
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
            <p className="mx-5 mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {notificacaoAberta.mensagem}
            </p>
            <div className="px-5"><DivisionNotificationDetails divisao={divisaoAberta} notificacao={notificacaoAberta} /></div>
            <div className="sticky bottom-0 mt-5 grid gap-2 border-t border-slate-200 bg-[var(--app-card)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
              {notificacaoAberta.acaoPendente === "ResponderDivisao" && (
                <>
                  <ActionButton disabled={isActionLoading} onClick={() => executarAcaoDivisao("aceitar")}>
                    Aceitar
                  </ActionButton>
                  <ActionButton disabled={isActionLoading} onClick={abrirClassificacao}>
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
                    Assumir despesa integralmente
                  </ActionButton>
                  <ActionButton disabled={isActionLoading} onClick={() => executarAcaoDivisao("reenviar")}>
                    Reenviar convite
                  </ActionButton>
                  <ActionButton disabled={isActionLoading} onClick={() => executarAcaoDivisao("manter-parte")}>
                    Manter somente minha parte
                  </ActionButton>
                  <p className="sm:col-span-3 text-xs text-slate-500 dark:text-slate-400">
                    A decisão afeta somente a participação recusada indicada acima e preserva os demais participantes.
                  </p>
                </>
              )}
              {(notificacaoAberta.acaoPendente === "ResponderAlteracaoDivisao" ||
                notificacaoAberta.tipoNotificacao === "DivisaoAlterada") && (
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
              {notificacaoAberta.tipoNotificacao === "AlteracaoDivisaoRecusada" && (
                <>
                  <ActionButton disabled={isActionLoading} onClick={() => executarAcaoDivisao("manter-anterior")}>
                    Manter versão anterior
                  </ActionButton>
                  <ActionButton disabled={isActionLoading} onClick={() => executarAcaoDivisao("reenviar-alteracao")}>
                    Reenviar alteração
                  </ActionButton>
                  <ActionButton tone="danger" disabled={isActionLoading} onClick={() => executarAcaoDivisao("excluir")}>
                    Cancelar divisão
                  </ActionButton>
                  <p className="sm:col-span-3 text-xs text-slate-500 dark:text-slate-400">
                    A divisão anterior continua ativa.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {classificacaoAberta && divisaoAberta && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/60 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-4">
          <div aria-modal="true" aria-labelledby="division-classification-title" role="dialog" className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[calc(100dvh-2rem)]">
            <h2 id="division-classification-title" className="text-xl font-black text-slate-950 dark:text-white">
              Aceitar e classificar
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              As opções pertencem à sua conta. Nenhuma conta, cartão ou categoria privada do criador é copiada.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Categoria</span>
                <select className={selectClass} value={categoriaId} onChange={(event) => setCategoriaId(event.target.value)}>
                  <option value="">Sem categoria</option>
                  {(categoriasQuery.data ?? []).map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
                  ))}
                </select>
              </label>
              {!divisaoAberta.compraParceladaId && (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Conta</span>
                    <select className={selectClass} value={contaBancariaId} onChange={(event) => setContaBancariaId(event.target.value)}>
                      <option value="">Não informar</option>
                      {(contasQuery.data ?? []).map((conta) => (
                        <option key={conta.id} value={conta.id}>{conta.nomeCustomizado}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Cartão</span>
                    <select className={selectClass} value={cartaoCreditoId} onChange={(event) => setCartaoCreditoId(event.target.value)}>
                      <option value="">Não informar</option>
                      {(cartoesQuery.data ?? []).map((cartao) => (
                        <option key={cartao.id} value={cartao.id}>{cartao.apelidoCartao}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                Status inicial: pendente.
              </p>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" type="button" onClick={() => setClassificacaoAberta(false)}>
                Voltar
              </button>
              <button className="min-h-11 rounded-xl bg-[var(--app-accent)] px-4 text-sm font-black text-[var(--app-accent-contrast)] disabled:opacity-60 dark:bg-white dark:text-slate-950" type="button" disabled={isActionLoading || categoriasQuery.isLoading} onClick={() => executarAcaoDivisao("aceitar-classificar")}>
                Aceitar e adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DivisionNotificationDetails({
  divisao,
  notificacao,
}: {
  divisao: DivisaoTransacao;
  notificacao: Notificacao;
}) {
  const convidado = divisao.participantes.find(
    (participante) =>
      (!notificacao.participanteDivisaoId || participante.id === notificacao.participanteDivisaoId) &&
      participante.tipoParticipante !== "Criador" &&
      participante.tipoParticipante !== 1,
  );
  const alteracao = obterAlteracaoPendente(divisao);
  const alteracaoParticipante = alteracao?.participantes?.find(
    (item) => !notificacao.participanteDivisaoId || item.participanteId === notificacao.participanteDivisaoId,
  );

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
      <DetailRow label="Valor total" value={formatCurrency(divisao.valorTotal)} />
      <DetailRow label="Descrição" value={divisao.descricaoOrigem || notificacao.mensagem} />
      {divisao.dataSugeridaConvidado && (
        <>
          <DetailRow label="Vencimento sugerido" value={formatDate(divisao.dataSugeridaConvidado)} />
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Data sugerida com base no vencimento da origem. Você pode ajustá-la depois para o seu controle.</p>
        </>
      )}
      {divisao.compraParceladaId && (
        <>
          <DetailRow
            label="Tipo"
            value={isFormaPagamentoCarne(divisao.formaPagamentoCompraParcelada)
              ? "Carnê/Crediário"
              : "Cartão de crédito"}
          />
          <DetailRow label="Parcelas" value={`${divisao.quantidadeParcelas ?? 0}x`} />
          {divisao.dataPrimeiraParcela && (
            <DetailRow label="Primeira competência" value={formatDate(divisao.dataPrimeiraParcela)} />
          )}
        </>
      )}
      {convidado && (
        <>
          {convidado.nomeExibicao && <DetailRow label="Participante" value={convidado.nomeExibicao} />}
          <DetailRow
            label={notificacao.acaoPendente === "DecidirRecusaDivisao" ? "Valor recusado" : "Sua parte"}
            value={formatCurrency(convidado.valor)}
          />
          <DetailRow label="Percentual" value={`${convidado.percentual.toLocaleString("pt-BR")}%`} />
          {convidado.expiraEm && (
            <DetailRow label="Expira em" value={formatDateTime(convidado.expiraEm)} />
          )}
        </>
      )}
      {alteracao && (
        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="font-black text-slate-900 dark:text-white">Comparação da alteração</p>
          <DetailRow label="Valor total atual" value={formatCurrency(alteracao.valorTotalAnterior)} />
          <DetailRow label="Novo valor total" value={formatCurrency(alteracao.valorTotalProposto)} />
          <DetailRow
            label="Sua parte atual"
            value={formatCurrency(alteracaoParticipante?.valorAnterior ?? alteracao.valorParticipanteAnterior)}
          />
          <DetailRow
            label="Sua nova parte"
            value={formatCurrency(alteracaoParticipante?.valorProposto ?? alteracao.valorParticipanteProposto)}
          />
          <DetailRow
            label="Escopo"
            value={alteracao.escopo === "EstaEProximas" ? "Este mês e próximos" : "Somente esta ocorrência"}
          />
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            A configuração anterior continuará válida até todos os participantes necessários aceitarem.
          </p>
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
  return divisao.versoes.find((versao) =>
    isStatus(versao.status, "PropostaPendente", 2)) ?? null;
}

function isStatus(value: string | number, text: string, numeric: number) {
  return value === text || value === numeric;
}

function isFormaPagamentoCarne(value: string | number | null | undefined) {
  return value === "Carne" || value === 2;
}

function valorRecusado(divisao: DivisaoTransacao, participanteId?: string | null) {
  const recusadoOuExpirado = divisao.participantes.filter(
    (participante) =>
      (!participanteId || participante.id === participanteId) &&
      participante.tipoParticipante !== "Criador" &&
      participante.tipoParticipante !== 1 &&
      (isStatus(participante.status, "Recusado", 3) ||
        isStatus(participante.status, "Expirado", 5)),
  );

  const participantes =
    recusadoOuExpirado.length > 0
      ? recusadoOuExpirado
      : divisao.participantes.filter(
          (participante) =>
            participante.tipoParticipante !== "Criador" &&
            participante.tipoParticipante !== 1,
        );

  return participantes.reduce((total, participante) => total + participante.valor, 0);
}

function invalidacoesPorAcao(acao: string, divisaoId: string) {
  const keys: Array<readonly unknown[]> = [
    queryKeys.notificacoesNaoLidas,
    queryKeys.divisaoTransacao(divisaoId),
  ];

  if (acao === "recusar" || acao === "reenviar" || acao === "manter-parte" || acao === "reenviar-alteracao") {
    return keys;
  }

  if (acao === "excluir" || acao === "assumir") {
    return [
      ...keys,
      queryKeys.extratoScope,
      queryKeys.extratoPaginadoScope,
      queryKeys.dashboardScope,
      queryKeys.relatoriosScope,
      queryKeys.faturasScope,
    ];
  }

  if (acao === "aceitar-alteracao") {
    return [
      ...keys,
      queryKeys.extratoScope,
      queryKeys.extratoPaginadoScope,
      queryKeys.dashboardScope,
      queryKeys.relatoriosScope,
      queryKeys.faturasScope,
    ];
  }

  return [
    ...keys,
    queryKeys.extratoScope,
    queryKeys.extratoPaginadoScope,
    queryKeys.dashboardScope,
    queryKeys.relatoriosScope,
  ];
}

const selectClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}
