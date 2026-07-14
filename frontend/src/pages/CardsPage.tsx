import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, CreditCard, Eye, Pencil, Plus, X } from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { useCartoes, useContas } from "../hooks/queries/useFinanceQueries";
import { queryKeys } from "../hooks/queries/queryKeys";
import * as financeService from "../services/financeService";
import type { CartaoCredito, ContaBancaria } from "../types/finance";
import {
  formatCurrency,
  formatCurrencyInput,
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
  const cartoes = cartoesQuery.data ?? [];
  const contas = contasQuery.data ?? [];
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  return (
    <AppLayout>
      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cartões</p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Limites e faturas
            </h2>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--app-accent)] px-6 py-4 text-base font-bold text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90 dark:bg-emerald-500 dark:text-slate-950"
            type="button"
            onClick={abrirNovoCartao}
          >
            <Plus size={22} />
            Adicionar Cartão
          </button>
        </div>

        {erro && !isModalOpen && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {erro}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl bg-[var(--app-card)] p-6 text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
            Carregando cartões...
          </div>
        ) : cartoesQuery.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
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
              const utilizado = cartao.valorUtilizado ?? Math.max(0, cartao.limiteTotal - disponivel);
              const percentualUtilizado = Math.min(100, Math.max(0, cartao.percentualUtilizado ?? 0));
              const contaDebito = contas.find(
                (conta) => conta.id === cartao.contaBancariaId,
              );
              const alertas = [
                percentualUtilizado >= 90 ? "Uso acima de 90%" : null,
                percentualUtilizado >= 70 && percentualUtilizado < 90
                  ? "Uso acima de 70%"
                  : null,
                cartao.statusFaturaAtual === "Vencida" ? "Fatura vencida" : null,
                cartao.diasParaFechamento >= 0 && cartao.diasParaFechamento <= 3
                  ? "Fechamento próximo"
                  : null,
                !cartao.contaBancariaId ? "Sem conta vinculada" : null,
              ].filter(Boolean);

              return (
                <article
                  className="relative overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  key={cartao.id}
                >
                  <div className="absolute left-0 top-0 h-full w-1.5 bg-[var(--app-accent)]" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-[var(--app-card-muted)] p-2 text-[var(--app-accent)]">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {cartao.apelidoCartao}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Vencimento dia {cartao.diaVencimento}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-[var(--app-primary-soft)] hover:text-[var(--app-primary)] dark:hover:bg-slate-800"
                        type="button"
                        title="Ver fatura"
                        aria-label={`Ver fatura do cartão ${cartao.apelidoCartao}`}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-[var(--app-primary-soft)] hover:text-[var(--app-primary)] dark:hover:bg-slate-800"
                        type="button"
                        onClick={() => editar(cartao)}
                        title="Editar cartão"
                        aria-label={`Editar cartão ${cartao.apelidoCartao}`}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700"
                        type="button"
                        onClick={() => arquivar(cartao)}
                        title="Arquivar cartão"
                        aria-label={`Arquivar cartão ${cartao.apelidoCartao}`}
                      >
                        <Archive size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        Utilizado
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(utilizado)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[var(--app-accent)] transition-all"
                        style={{ width: `${percentualUtilizado}%` }}
                      />
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Limite total</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(cartao.limiteTotal)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Disponível</dt>
                      <dd
                        className={`font-semibold ${
                          disponivel >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(disponivel)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Vencimento</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        Dia {cartao.diaVencimento}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Melhor compra</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        Dia {cartao.melhorDiaCompra}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-500 dark:text-slate-400">
                        Conta para débito automático
                      </dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {cartao.contaBancariaNome ?? contaDebito?.nomeCustomizado ?? "Não vinculada"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Fatura atual</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(cartao.faturaAtual ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Status</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {cartao.statusFaturaAtual || "Aberta"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Fechamento</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {cartao.dataFechamentoAtual
                          ? new Date(`${cartao.dataFechamentoAtual}T00:00:00`).toLocaleDateString("pt-BR")
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Vencimento</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {cartao.dataVencimentoAtual
                          ? new Date(`${cartao.dataVencimentoAtual}T00:00:00`).toLocaleDateString("pt-BR")
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Parcelas futuras</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {cartao.comprasParceladasFuturas ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Comprometido futuro</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(cartao.limiteComprometidoFuturo ?? 0)}
                      </dd>
                    </div>
                  </dl>
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
      {dialog}
    </AppLayout>
  );
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <form
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
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

        <div className="flex items-center gap-3 pr-10">
          <div className="rounded-xl bg-[var(--app-card-muted)] p-2 text-[var(--app-accent)]">
            {isEditing ? <Pencil size={20} /> : <Plus size={20} />}
          </div>
          <div>
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
    </div>
  );
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
