import { FormEvent, useEffect, useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { Dialog } from "../components/Dialog";
import { useCartoes, useContas, useFaturaMes } from "../hooks/queries/useFinanceQueries";
import { queryKeys } from "../hooks/queries/queryKeys";
import * as financeService from "../services/financeService";
import type {
  CartaoCredito,
  ContaBancaria,
  FaturaConsolidada,
  FaturaDetalhe,
} from "../types/finance";
import {
  formatCurrency,
  formatCurrencyInput,
  formatDate,
  maskBrlCurrencyInput,
  parseBrlCurrency,
} from "../utils/date";

type CardForm = {
  apelidoCartao: string;
  diaVencimento: number;
  melhorDiaCompra: number;
  limiteTotal: number;
  contaBancariaId: string | null;
};

type FaturaModalState = {
  cartao: CartaoCredito;
  mes: number;
  ano: number;
};

type PagamentoFaturaState = {
  cartao: CartaoCredito;
  fatura: FaturaConsolidada;
  erro?: string | null;
  saldoInsuficiente?: boolean;
};

const emptyForm: CardForm = {
  apelidoCartao: "",
  diaVencimento: 10,
  melhorDiaCompra: 4,
  limiteTotal: 0,
  contaBancariaId: null,
};

export function CardsPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const cartoesQuery = useCartoes();
  const contasQuery = useContas();
  const hoje = new Date();
  const faturasAtualQuery = useFaturaMes(hoje.getMonth() + 1, hoje.getFullYear());
  const cartoes = cartoesQuery.data ?? [];
  const contas = contasQuery.data ?? [];
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [faturaModal, setFaturaModal] = useState<FaturaModalState | null>(null);
  const [pagamentoFatura, setPagamentoFatura] =
    useState<PagamentoFaturaState | null>(null);
  const [isPagandoFatura, setIsPagandoFatura] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const isLoading = cartoesQuery.isLoading;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    try {
      const contaSelecionada = contas.find(
        (conta) => conta.id === form.contaBancariaId,
      );
      const request = {
        ...form,
        banco:
          contaSelecionada?.nomeCustomizado?.trim() ||
          form.apelidoCartao.trim() ||
          "Cartão",
      };

      const cartaoSalvo = editingId
        ? await financeService.atualizarCartaoCredito(editingId, request)
        : await financeService.criarCartaoCredito(request);
      const cartaoAtualizado = {
        ...cartaoSalvo,
        contaBancariaId: cartaoSalvo.contaBancariaId ?? request.contaBancariaId ?? null,
      };

      queryClient.setQueryData<CartaoCredito[]>(queryKeys.cartoes, (current) => {
        const cartoesAtuais = current ?? [];
        const existeNoCache = cartoesAtuais.some(
          (cartao) => cartao.id === cartaoAtualizado.id,
        );
        const proximosCartoes = existeNoCache
          ? cartoesAtuais.map((cartao) =>
              cartao.id === cartaoAtualizado.id ? cartaoAtualizado : cartao,
            )
          : [...cartoesAtuais, cartaoAtualizado];

        return proximosCartoes.sort((a, b) =>
          a.apelidoCartao.localeCompare(b.apelidoCartao, "pt-BR", {
            sensitivity: "base",
          }),
        );
      });

      fecharModal();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.cartoes,
        refetchType: "active",
      });
    } catch {
      setErro("Não foi possível salvar o cartão.");
    }
  }

  function abrirNovoCartao() {
    setEditingId(null);
    setForm(emptyForm);
    setErro(null);
    setIsModalOpen(true);
  }

  function editar(cartao: CartaoCredito) {
    setEditingId(cartao.id);
    setForm({
      apelidoCartao: cartao.apelidoCartao,
      diaVencimento: cartao.diaVencimento,
      melhorDiaCompra: cartao.melhorDiaCompra,
      limiteTotal: cartao.limiteTotal,
      contaBancariaId: cartao.contaBancariaId ?? null,
    });
    setErro(null);
    setIsModalOpen(true);
  }

  function fecharModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setErro(null);
  }

  async function arquivar(cartao: CartaoCredito) {
    const confirmed = await confirm({
      title: "Arquivar cartão",
      message: `Deseja arquivar "${cartao.apelidoCartao}"? O histórico será preservado e ele não aparecerá em novos lançamentos.`,
      confirmLabel: "Arquivar",
      variant: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      await financeService.arquivarCartaoCredito(cartao.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cartoes });
    } catch {
      setErro("Não foi possível arquivar o cartão.");
      setIsModalOpen(false);
    }
  }

  function abrirFatura(cartao: CartaoCredito) {
    const referencia = cartao.dataVencimentoAtual
      ? new Date(`${cartao.dataVencimentoAtual}T00:00:00`)
      : new Date();

    setFaturaModal({
      cartao,
      mes: referencia.getMonth() + 1,
      ano: referencia.getFullYear(),
    });
  }

  function abrirPagamentoFatura(cartao: CartaoCredito) {
    const fatura = obterFaturaAtual(cartao);

    if (!fatura) {
      setErro("Não foi possível localizar a fatura desta competência.");
      return;
    }

    setPagamentoFatura({ cartao, fatura, erro: null, saldoInsuficiente: false });
  }

  async function confirmarPagamentoFatura(
    contaBancariaId: string | null,
    confirmarSemSaldo = false,
  ) {
    if (!pagamentoFatura || pagamentoFatura.fatura.isPaga || isPagandoFatura) {
      return;
    }

    setIsPagandoFatura(true);
    setPagamentoFatura((current) =>
      current ? { ...current, erro: null } : current,
    );

    try {
      await financeService.alternarStatusFatura(
        pagamentoFatura.cartao.id,
        pagamentoFatura.fatura.dataVencimento,
        {
        confirmarSemSaldo,
          contaBancariaId,
        },
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.cartoes }),
        queryClient.invalidateQueries({ queryKey: ["faturas"] }),
        queryClient.invalidateQueries({ queryKey: ["extrato"] }),
        queryClient.invalidateQueries({ queryKey: ["extrato-paginado"] }),
        queryClient.invalidateQueries({ queryKey: ["contas"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["relatorios"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notificacoesNaoLidas }),
      ]);

      setPagamentoFatura(null);
    } catch (error) {
      const responseData = axios.isAxiosError(error) ? error.response?.data : null;
      const erroCodigo = responseData?.erro;
      const mensagem = responseData?.mensagem ?? responseData?.message;

      if (erroCodigo === "SALDO_INSUFICIENTE") {
        setPagamentoFatura((current) =>
          current
            ? {
                ...current,
                erro:
                  mensagem ??
                  "A conta selecionada não possui saldo suficiente para este pagamento.",
                saldoInsuficiente: true,
              }
            : current,
        );
        return;
      }

      setPagamentoFatura((current) =>
        current
          ? {
              ...current,
              erro: mensagem ?? "Não foi possível pagar a fatura.",
            }
          : current,
      );
    } finally {
      setIsPagandoFatura(false);
    }
  }

  function obterFaturaAtual(cartao: CartaoCredito) {
    return (faturasAtualQuery.data ?? []).find(
      (fatura) =>
        fatura.cartaoCreditoId === cartao.id &&
        fatura.dataVencimento === cartao.dataVencimentoAtual,
    );
  }

  return (
    <AppLayout>
      <section className="mx-auto max-w-[1400px] px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cartões</p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Limites e faturas
            </h2>
          </div>
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--app-accent)] px-6 py-4 text-base font-bold text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90 dark:bg-emerald-500 dark:text-slate-950 sm:w-auto"
            type="button"
            onClick={abrirNovoCartao}
          >
            <Plus size={22} />
            Adicionar Cartão
          </button>
        </div>

        {erro && !isModalOpen && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            {erro}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl bg-[var(--app-card)] p-6 text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
            Carregando cartões...
          </div>
        ) : cartoesQuery.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            Não foi possível carregar os cartões.
          </div>
        ) : cartoes.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CreditCard className="mx-auto text-[var(--app-accent)]" size={42} />
            <h3 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
              Nenhum cartão cadastrado
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Cadastre seus cartões para acompanhar limite utilizado, melhor dia de compra e faturas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cartoes.map((cartao) => {
              const disponivel = cartao.limiteDisponivel;
              const utilizado = cartao.valorUtilizado;
              const percentualUtilizado = Math.min(100, Math.max(0, cartao.percentualUtilizado));
              const contaDebito = contas.find(
                (conta) => conta.id === cartao.contaBancariaId,
              );
              const possuiFaturaAtual = cartao.statusFaturaAtual !== "SemFatura";
              const faturaAtual = obterFaturaAtual(cartao);
              const podePagarFatura =
                possuiFaturaAtual &&
                cartao.statusFaturaAtual !== "Paga" &&
                Boolean(faturaAtual) &&
                !faturaAtual?.isPaga;
              const alertas = [
                percentualUtilizado >= 90 ? "Uso acima de 90%" : null,
                percentualUtilizado >= 70 && percentualUtilizado < 90
                  ? "Uso acima de 70%"
                  : null,
                cartao.statusFaturaAtual === "Vencida" ? "Fatura vencida" : null,
                cartao.diasParaFechamento !== null &&
                cartao.diasParaFechamento >= 0 &&
                cartao.diasParaFechamento <= 3
                  ? "Fechamento próximo"
                  : null,
                !cartao.contaBancariaId ? "Sem conta vinculada" : null,
              ].filter(Boolean);

              return (
                <article
                  className="relative min-w-0 overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900 sm:p-6"
                  key={cartao.id}
                >
                  <div className="absolute left-0 top-0 h-full w-1.5 bg-[var(--app-accent)]" />
                  <div className="flex min-w-0 flex-col gap-3 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="shrink-0 rounded-xl bg-[var(--app-card-muted)] p-2 text-[var(--app-accent)] dark:bg-slate-950 dark:text-blue-300">
                        <CreditCard size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-slate-900 dark:text-white">
                          {cartao.apelidoCartao}
                        </h3>
                        {cartao.banco && cartao.banco !== cartao.apelidoCartao && (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {cartao.banco}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2 self-end min-[380px]:self-start">
                      <button
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-[var(--app-primary-soft)] hover:text-[var(--app-primary)] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                        type="button"
                        title="Ver fatura"
                        onClick={() => abrirFatura(cartao)}
                        aria-label={`Ver fatura do cartão ${cartao.apelidoCartao}`}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-[var(--app-primary-soft)] hover:text-[var(--app-primary)] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                        type="button"
                        onClick={() => editar(cartao)}
                        title="Editar cartão"
                        aria-label={`Editar cartão ${cartao.apelidoCartao}`}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                        type="button"
                        onClick={() => arquivar(cartao)}
                        title="Arquivar cartão"
                        aria-label={`Arquivar cartão ${cartao.apelidoCartao}`}
                      >
                        <Archive size={18} />
                      </button>
                    </div>
                  </div>

                  <section className="mt-5" aria-label="Limite do cartão">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        Utilizado
                      </span>
                      <span className="break-words font-bold text-slate-900 [overflow-wrap:anywhere] dark:text-white">
                        {formatCurrency(utilizado)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[var(--app-accent)] transition-all"
                        style={{ width: `${percentualUtilizado}%` }}
                      />
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-3 text-sm min-[380px]:grid-cols-2">
                      <MetricItem label="Limite total" value={formatCurrency(cartao.limiteTotal)} />
                      <MetricItem
                        label="Disponível"
                        value={formatCurrency(disponivel)}
                        valueClassName={disponivel >= 0 ? "text-emerald-700" : "text-red-700"}
                      />
                    </dl>
                  </section>

                  <section
                    className="mt-4 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-4 dark:border-slate-800 dark:bg-slate-950/70"
                    aria-label="Fatura atual"
                  >
                    <div className="mb-3 flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          Fatura atual
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {possuiFaturaAtual
                            ? "Competência consolidada do cartão"
                            : "Nenhuma fatura nesta competência"}
                        </p>
                      </div>
                      <span className={getFaturaStatusClass(cartao.statusFaturaAtual)}>
                        {getFaturaStatusLabel(cartao.statusFaturaAtual)}
                      </span>
                    </div>
                    <dl className="grid grid-cols-1 gap-3 text-sm min-[380px]:grid-cols-2">
                      <MetricItem label="Valor" value={formatCurrency(cartao.faturaAtual)} />
                      <MetricItem
                        label="Fechamento"
                        value={formatDateSemantic(cartao.dataFechamentoAtual, "Sem fechamento nesta competência")}
                      />
                      <MetricItem
                        label="Vencimento da fatura"
                        value={formatDateSemantic(cartao.dataVencimentoAtual, "Sem vencimento nesta competência")}
                      />
                      <MetricItem
                        label="Dia configurado"
                        value={`Dia ${cartao.diaVencimento}`}
                      />
                    </dl>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                        type="button"
                        onClick={() => abrirFatura(cartao)}
                        aria-label={`Ver fatura atual do cartão ${cartao.apelidoCartao}`}
                      >
                        Ver fatura
                      </button>
                      {podePagarFatura ? (
                        <button
                          className="rounded-xl bg-[var(--app-accent)] px-3 py-2 text-sm font-bold text-[var(--app-accent-contrast)] transition hover:opacity-90 dark:bg-emerald-500 dark:text-slate-950"
                          type="button"
                          onClick={() => abrirPagamentoFatura(cartao)}
                          aria-label={`Pagar fatura do cartão ${cartao.apelidoCartao}`}
                        >
                          Pagar fatura
                        </button>
                      ) : (
                        <span className="rounded-xl border border-transparent px-3 py-2 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                          {cartao.statusFaturaAtual === "Paga" ? "Fatura paga" : "Sem pagamento pendente"}
                        </span>
                      )}
                    </div>
                  </section>

                  <section className="mt-4" aria-label="Informações complementares">
                    <dl className="grid grid-cols-1 gap-3 text-sm min-[380px]:grid-cols-2">
                      <MetricItem label="Melhor dia de compra" value={`Dia ${cartao.melhorDiaCompra}`} />
                      <MetricItem
                        label="Conta de pagamento"
                        value={cartao.contaBancariaNome ?? contaDebito?.nomeCustomizado ?? "Nenhuma conta vinculada"}
                      />
                      <MetricItem label="Parcelas futuras" value={`${cartao.comprasParceladasFuturas}`} />
                      <MetricItem
                        label="Comprometido futuro"
                        value={formatCurrency(cartao.limiteComprometidoFuturo)}
                      />
                      <MetricItem
                        label="Próxima fatura"
                        value={
                          cartao.proximaFaturaValor > 0
                            ? `${formatCurrency(cartao.proximaFaturaValor)} em ${formatDateSemantic(
                                cartao.proximaFaturaVencimento,
                                "data não informada",
                              )}`
                            : "Nenhuma próxima fatura"
                        }
                        className="min-[380px]:col-span-2"
                      />
                    </dl>
                  </section>

                  <div className="mt-4 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-4 dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="mb-3 flex flex-col gap-2 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        Composição do limite
                      </p>
                      <span className="break-words text-xs font-semibold text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">
                        Total: {formatCurrency(cartao.valorUtilizado)}
                      </span>
                    </div>
                    <dl className="grid gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <BreakdownRow
                        label="Faturas fechadas não pagas"
                        value={cartao.valorFaturasFechadasNaoPagas}
                      />
                      <BreakdownRow
                        label="Fatura atual no limite"
                        value={cartao.valorFaturaAtual}
                      />
                      <BreakdownRow
                        label="Próximas faturas"
                        value={cartao.valorProximasFaturas}
                      />
                      <BreakdownRow
                        label={`Parcelas futuras (${cartao.quantidadeParcelasFuturas})`}
                        value={cartao.valorParcelasFuturas}
                      />
                      <BreakdownRow
                        label="Outros compromissos"
                        value={cartao.valorOutrosCompromissos}
                      />
                    </dl>
                  </div>
                  {alertas.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {alertas.map((alerta) => (
                        <span
                          key={alerta}
                          className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                        >
                          {alerta}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <CartaoModal
        isOpen={isModalOpen}
        isEditing={Boolean(editingId)}
        form={form}
        contas={contas}
        isLoadingContas={contasQuery.isLoading}
        erro={erro}
        onClose={fecharModal}
        onChange={setForm}
        onSubmit={handleSubmit}
      />
      <FaturaDetalheModal
        state={faturaModal}
        onClose={() => setFaturaModal(null)}
        onChangeCompetencia={(mes, ano) =>
          setFaturaModal((current) =>
            current ? { ...current, mes, ano } : current,
          )
        }
        onPagar={(cartao, fatura) =>
          setPagamentoFatura({ cartao, fatura, erro: null, saldoInsuficiente: false })
        }
      />
      <PagamentoFaturaModal
        state={pagamentoFatura}
        contas={contas}
        isLoadingContas={contasQuery.isLoading}
        isSubmitting={isPagandoFatura}
        onClose={() => {
          if (!isPagandoFatura) {
            setPagamentoFatura(null);
          }
        }}
        onConfirm={confirmarPagamentoFatura}
      />
      {dialog}
    </AppLayout>
  );
}

function FaturaDetalheModal({
  state,
  onClose,
  onChangeCompetencia,
  onPagar,
}: {
  state: FaturaModalState | null;
  onClose: () => void;
  onChangeCompetencia: (mes: number, ano: number) => void;
  onPagar: (cartao: CartaoCredito, fatura: FaturaConsolidada) => void;
}) {
  const faturasQuery = useFaturaMes(
    state?.mes ?? 1,
    state?.ano ?? 1,
    Boolean(state),
  );

  if (!state) {
    return null;
  }

  const { cartao, mes, ano } = state;
  const fatura = (faturasQuery.data ?? []).find(
    (item) => item.cartaoCreditoId === cartao.id,
  );
  const competenciaValue = `${ano}-${String(mes).padStart(2, "0")}`;

  function navegar(delta: number) {
    const next = new Date(ano, mes - 1 + delta, 1);
    onChangeCompetencia(next.getMonth() + 1, next.getFullYear());
  }

  function selecionarCompetencia(value: string) {
    const [ano, mes] = value.split("-").map(Number);
    if (mes >= 1 && mes <= 12 && ano > 0) {
      onChangeCompetencia(mes, ano);
    }
  }

  return (
    <Dialog
      title={`Fatura ${cartao.apelidoCartao}`}
      description="Detalhes da fatura por competência."
      onClose={onClose}
      className="flex max-w-5xl flex-col overflow-hidden"
      showCloseButton={false}
    >
        <div className="border-b border-[color:var(--app-card-border)] p-5 pr-14 dark:border-slate-800 sm:p-6">
          <button
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de fatura"
          >
            <X size={20} />
          </button>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Cartão
          </p>
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">
            {cartao.apelidoCartao}
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded-xl border border-[color:var(--app-card-border)] p-3 text-slate-600 transition hover:bg-[var(--app-card-muted)] dark:border-slate-700 dark:text-slate-200"
                type="button"
                onClick={() => navegar(-1)}
                aria-label="Competência anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[color:var(--app-card-border)] px-3 text-sm font-bold text-slate-800 dark:border-slate-700 dark:text-white min-[420px]:flex-none">
                <CalendarDays size={18} className="text-slate-500" />
                <input
                  className="min-w-0 bg-transparent outline-none"
                  type="month"
                  value={competenciaValue}
                  onChange={(event) => selecionarCompetencia(event.target.value)}
                  aria-label="Selecionar competência da fatura"
                />
              </label>
              <button
                className="rounded-xl border border-[color:var(--app-card-border)] p-3 text-slate-600 transition hover:bg-[var(--app-card-muted)] dark:border-slate-700 dark:text-slate-200"
                type="button"
                onClick={() => navegar(1)}
                aria-label="Próxima competência"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            {fatura && !fatura.isPaga && fatura.valorTotal > 0 && (
              <button
                className="rounded-xl bg-[var(--app-accent)] px-4 py-3 text-sm font-bold text-[var(--app-accent-contrast)] transition hover:opacity-90"
                type="button"
                onClick={() => onPagar(cartao, fatura)}
              >
                Pagar fatura
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {faturasQuery.isLoading ? (
            <div className="rounded-2xl bg-[var(--app-card-muted)] p-6 text-sm font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
              Carregando fatura...
            </div>
          ) : faturasQuery.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              Não foi possível carregar esta fatura.
            </div>
          ) : !fatura ? (
            <div className="rounded-2xl bg-[var(--app-card-muted)] p-6 text-center text-sm font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
              Nenhuma fatura encontrada para esta competência.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5">
                <MetricItem label="Total" value={formatCurrency(fatura.valorTotal)} />
                <MetricItem
                  label="Status"
                  value={fatura.isPaga ? "Paga" : fatura.status}
                />
                <MetricItem label="Vencimento" value={formatDate(fatura.dataVencimento)} />
                <MetricItem
                  label="Competência"
                  value={`${formatDate(fatura.inicioCompetencia)} até ${formatDate(fatura.fimCompetencia)}`}
                  className="sm:col-span-2"
                />
              </div>

              {fatura.detalhes.length === 0 ? (
                <div className="rounded-2xl bg-[var(--app-card-muted)] p-6 text-center text-sm font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  Nenhuma compra nesta fatura.
                </div>
              ) : (
                <>
                  <div className="hidden overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] dark:border-slate-800 md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--app-card-muted)] text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Compra</th>
                          <th className="px-4 py-3">Categoria</th>
                          <th className="px-4 py-3">Origem</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {fatura.detalhes.map((detalhe, index) => (
                          <tr key={detalheKey(detalhe, index)}>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                              {formatDate(detalhe.dataOcorrencia)}
                            </td>
                            <td className="px-4 py-3">
                              <DetalheDescricao detalhe={detalhe} />
                            </td>
                            <td className="px-4 py-3">
                              <CategoriaFatura detalhe={detalhe} />
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                              {formatOrigemFatura(detalhe.origem)}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-red-600">
                              - {formatCurrency(detalhe.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {fatura.detalhes.map((detalhe, index) => (
                      <article
                        key={detalheKey(detalhe, index)}
                        className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-4 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex min-w-0 flex-col gap-3 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between">
                          <DetalheDescricao detalhe={detalhe} />
                          <strong className="break-words text-red-600 [overflow-wrap:anywhere] min-[380px]:shrink-0">
                            - {formatCurrency(detalhe.valor)}
                          </strong>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <span>{formatDate(detalhe.dataOcorrencia)}</span>
                          <span>{formatOrigemFatura(detalhe.origem)}</span>
                          <span>{detalhe.status || (fatura.isPaga ? "Paga" : fatura.status)}</span>
                        </div>
                        <div className="mt-3">
                          <CategoriaFatura detalhe={detalhe} />
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
    </Dialog>
  );
}

function PagamentoFaturaModal({
  state,
  contas,
  isLoadingContas,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  state: PagamentoFaturaState | null;
  contas: ContaBancaria[];
  isLoadingContas: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (contaBancariaId: string | null, confirmarSemSaldo?: boolean) => Promise<void>;
}) {
  const contaPadraoId =
    state?.cartao.contaBancariaId ??
    contas.find((conta) => conta.isFavorita)?.id ??
    "";
  const [contaBancariaId, setContaBancariaId] = useState(contaPadraoId);

  useEffect(() => {
    setContaBancariaId(contaPadraoId);
  }, [contaPadraoId, state?.fatura.dataVencimento, state?.cartao.id]);

  if (!state) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onConfirm(contaBancariaId || null, false);
  }

  return (
    <Dialog
      title="Pagamento de fatura"
      description="Confirme conta, competência e valor da fatura."
      onClose={onClose}
      className="max-w-lg p-4 sm:p-6"
      showCloseButton={false}
      closeOnBackdrop={!isSubmitting}
    >
      <form
        className="relative"
        onSubmit={handleSubmit}
      >
        <button
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
          type="button"
          disabled={isSubmitting}
          onClick={onClose}
          aria-label="Fechar pagamento de fatura"
        >
          <X size={20} />
        </button>

        <div className="pr-10">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Confirmar pagamento
          </p>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">
            Fatura {state.cartao.apelidoCartao}
          </h2>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl bg-[var(--app-card-muted)] p-4 dark:bg-slate-900 sm:grid-cols-2">
          <MetricItem label="Competência" value={formatMonthYear(state.fatura.dataVencimento)} />
          <MetricItem label="Valor" value={formatCurrency(state.fatura.valorTotal)} />
          <MetricItem label="Vencimento" value={formatDate(state.fatura.dataVencimento)} />
          <MetricItem
            label="Status"
            value={state.fatura.isPaga ? "Paga" : state.fatura.status}
          />
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Conta para pagamento
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-[color:var(--app-card-border)] bg-transparent px-4 py-3 text-slate-900 outline-none transition focus:border-[var(--app-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-white"
            value={contaBancariaId}
            disabled={isLoadingContas || isSubmitting}
            onChange={(event) => setContaBancariaId(event.target.value)}
          >
            <option value="">Não informar</option>
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nomeCustomizado}
                {conta.id === state.cartao.contaBancariaId ? " - vinculada" : ""}
                {conta.isFavorita ? " - favorita" : ""}
              </option>
            ))}
          </select>
        </label>

        {state.erro && (
          <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{state.erro}</span>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          {state.saldoInsuficiente ? (
            <button
              className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={isSubmitting || state.fatura.isPaga}
              onClick={() => onConfirm(contaBancariaId || null, true)}
            >
              {isSubmitting ? "Confirmando..." : "Usar limite e pagar"}
            </button>
          ) : (
            <button
              className="rounded-xl bg-[var(--app-accent)] px-5 py-3 font-bold text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSubmitting || isLoadingContas || state.fatura.isPaga}
            >
              {isSubmitting ? "Pagando..." : "Confirmar pagamento"}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

function DetalheDescricao({ detalhe }: { detalhe: FaturaDetalhe }) {
  return (
    <div className="min-w-0">
      <p className="break-words font-bold text-slate-900 dark:text-white">
        {detalhe.descricao}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {detalhe.numeroParcela && detalhe.quantidadeParcelas && (
          <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
            {detalhe.numeroParcela}/{detalhe.quantidadeParcelas}
          </span>
        )}
        {detalhe.isDividida && (
          <span className="rounded bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
            Dividida
            {detalhe.percentualDivisao
              ? ` · ${detalhe.percentualDivisao.toLocaleString("pt-BR")}%`
              : ""}
          </span>
        )}
        {detalhe.status && (
          <span className={getFaturaStatusClass(detalhe.status)}>
            {getFaturaStatusLabel(detalhe.status)}
          </span>
        )}
      </div>
      {detalhe.isDividida && detalhe.valorTotalOriginal != null && (
        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Total original: {formatCurrency(detalhe.valorTotalOriginal)}
        </p>
      )}
    </div>
  );
}

function CategoriaFatura({ detalhe }: { detalhe: FaturaDetalhe }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: detalhe.categoriaCorHexa || "#64748B" }}
      />
      <span className="truncate">{detalhe.categoriaNome || "Sem categoria"}</span>
    </div>
  );
}

function detalheKey(detalhe: FaturaDetalhe, index: number) {
  return [
    detalhe.transacaoId ?? detalhe.compraParceladaId ?? detalhe.descricao,
    detalhe.dataOcorrencia,
    detalhe.numeroParcela ?? index,
    detalhe.origem,
  ].join("-");
}

function formatOrigemFatura(origem: string) {
  return {
    Transacao: "Compra",
    CompraParcelada: "Compra parcelada",
    DespesaFixa: "Despesa fixa",
  }[origem] ?? origem;
}

function formatMonthYear(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function CartaoModal({
  isOpen,
  isEditing,
  form,
  contas,
  isLoadingContas,
  erro,
  onClose,
  onChange,
  onSubmit,
}: {
  isOpen: boolean;
  isEditing: boolean;
  form: CardForm;
  contas: ContaBancaria[];
  isLoadingContas: boolean;
  erro: string | null;
  onClose: () => void;
  onChange: (form: CardForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      title={isEditing ? "Editar cartão" : "Adicionar cartão"}
      description="Defina limite, vencimento e a conta de débito da fatura."
      onClose={onClose}
      className="max-w-xl p-4 sm:p-6"
      showCloseButton={false}
    >
      <form
        className="relative"
        onSubmit={onSubmit}
      >
        <button
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          type="button"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="flex min-w-0 items-start gap-3 pr-10">
          <div className="shrink-0 rounded-xl bg-[var(--app-card-muted)] p-2 text-[var(--app-accent)] dark:bg-slate-950 dark:text-blue-300">
            {isEditing ? <Pencil size={20} /> : <Plus size={20} />}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {isEditing ? "Editar cartão" : "Adicionar cartão"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Defina limite, vencimento e a conta de débito da fatura.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              label="Apelido"
              value={form.apelidoCartao}
              onChange={(value) => onChange({ ...form, apelidoCartao: value })}
            />
          </div>
          <NumberField
            label="Dia vencimento"
            value={form.diaVencimento}
            min={1}
            max={31}
            onChange={(value) => onChange({ ...form, diaVencimento: value })}
          />
          <NumberField
            label="Melhor dia compra"
            value={form.melhorDiaCompra}
            min={1}
            max={31}
            onChange={(value) => onChange({ ...form, melhorDiaCompra: value })}
          />
          <div className="sm:col-span-2">
            <NumberField
              label="Limite total"
              value={form.limiteTotal}
              onChange={(value) => onChange({ ...form, limiteTotal: value })}
              currency
            />
          </div>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Conta para Débito Automático
            </span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={form.contaBancariaId ?? ""}
              onChange={(event) =>
                onChange({
                  ...form,
                  contaBancariaId: event.target.value || null,
                })
              }
              disabled={isLoadingContas}
            >
              <option value="">Não vincular conta</option>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.nomeCustomizado}
                </option>
              ))}
            </select>
          </label>
        </div>

        {erro && <p className="mt-4 text-sm font-medium text-red-600">{erro}</p>}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="rounded-xl bg-[var(--app-accent)] px-5 py-3 font-bold text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90 dark:bg-white dark:text-slate-950"
            type="submit"
          >
            Salvar cartão
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between min-[380px]:gap-3">
      <dt className="min-w-0 break-words">{label}</dt>
      <dd className="break-words font-semibold text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100 min-[380px]:shrink-0">
        {formatCurrency(value)}
      </dd>
    </div>
  );
}

function MetricItem({
  label,
  value,
  className = "",
  valueClassName = "text-slate-900 dark:text-white",
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="break-words text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`break-words font-semibold [overflow-wrap:anywhere] ${valueClassName}`}>{value}</dd>
    </div>
  );
}

function formatDateSemantic(value: string | null, fallback: string) {
  if (!value) {
    return fallback;
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function getFaturaStatusLabel(status: string) {
  if (status === "SemFatura") {
    return "Sem fatura";
  }

  return status || "Sem fatura";
}

function getFaturaStatusClass(status: string) {
  const base = "rounded-full px-2.5 py-1 text-xs font-bold";

  if (status === "Paga") {
    return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`;
  }

  if (status === "Vencida") {
    return `${base} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`;
  }

  if (status === "Fechada") {
    return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`;
  }

  if (status === "Aberta") {
    return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300`;
  }

  return `${base} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`;
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  currency,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  currency?: boolean;
}) {
  if (currency) {
    return (
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <input
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          inputMode="numeric"
          placeholder="R$ 0,00"
          value={value > 0 ? formatCurrencyInput(value) : ""}
          onChange={(event) =>
            onChange(parseBrlCurrency(maskBrlCurrencyInput(event.target.value)))
          }
          required
        />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        type="number"
        min={min ?? 0}
        max={max}
        step={1}
        value={value || ""}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue === "" ? 0 : Number(nextValue));
        }}
        required
      />
    </label>
  );
}
