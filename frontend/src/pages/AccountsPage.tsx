import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Landmark, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { BankBadge } from "../components/BankBadge";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { principaisBancos } from "../constants/banks";
import { queryKeys } from "../hooks/queries/queryKeys";
import { useContas, useDistribuicaoContas } from "../hooks/queries/useFinanceQueries";
import * as financeService from "../services/financeService";
import type { ContaBancaria, ContaBancariaRequest } from "../types/finance";
import {
  formatCurrency,
  formatCurrencyInput,
  maskBrlCurrencyInput,
  parseBrlCurrency,
} from "../utils/date";

type AccountForm = {
  nomeCustomizado: string;
  codigoBanco: string;
  valorEmConta: string;
};

const emptyForm: AccountForm = {
  nomeCustomizado: "",
  codigoBanco: "001",
  valorEmConta: "",
};

export function AccountsPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const contasQuery = useContas();
  const distribuicaoQuery = useDistribuicaoContas();
  const contas = contasQuery.data ?? [];
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const saldos = new Map(
    (distribuicaoQuery.data ?? []).map((conta) => [conta.id, conta.saldoAtual]),
  );

  async function invalidarContas() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contas }),
      queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
      queryClient.invalidateQueries({ queryKey: ["extrato"] }),
      queryClient.invalidateQueries({ queryKey: ["extrato-paginado"] }),
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    const valorDesejadoEmConta = parseBrlCurrency(form.valorEmConta);
    const contaAtual = editingId
      ? contas.find((conta) => conta.id === editingId)
      : null;
    const saldoAtual = contaAtual
      ? saldos.get(contaAtual.id) ?? contaAtual.saldoInicial
      : 0;
    const movimentacaoJaRegistrada = contaAtual
      ? saldoAtual - contaAtual.saldoInicial
      : 0;

    const request: ContaBancariaRequest = {
      nomeCustomizado: form.nomeCustomizado.trim(),
      codigoBanco: form.codigoBanco,
      saldoInicial: editingId
        ? valorDesejadoEmConta - movimentacaoJaRegistrada
        : valorDesejadoEmConta,
    };

    try {
      if (editingId) {
        await financeService.atualizarContaBancaria(editingId, request);
      } else {
        await financeService.criarContaBancaria(request);
      }

      fecharModal();
      await invalidarContas();
    } catch {
      setErro("Não foi possível salvar a conta bancária.");
    }
  }

  function abrirNovaConta() {
    setEditingId(null);
    setForm(emptyForm);
    setErro(null);
    setIsModalOpen(true);
  }

  function editar(conta: ContaBancaria) {
    setEditingId(conta.id);
    setForm({
      nomeCustomizado: conta.nomeCustomizado,
      codigoBanco: conta.codigoBanco,
      valorEmConta: formatCurrencyInput(saldos.get(conta.id) ?? conta.saldoInicial),
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

  async function excluir(conta: ContaBancaria) {
    const confirmed = await confirm({
      title: "Excluir conta bancária",
      message: `Deseja excluir "${conta.nomeCustomizado}"? As transações existentes serão preservadas sem vínculo com a conta.`,
      confirmLabel: "Excluir",
      variant: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      await financeService.excluirContaBancaria(conta.id);
      await invalidarContas();
    } catch {
      setErro("Não foi possível excluir a conta bancária.");
    }
  }

  async function favoritar(conta: ContaBancaria) {
    setErro(null);
    setFavoritingId(conta.id);

    try {
      await financeService.favoritarContaBancaria(conta.id);
      await invalidarContas();
    } catch {
      setErro("Não foi possível definir a conta favorita.");
    } finally {
      setFavoritingId(null);
    }
  }

  return (
    <AppLayout>
      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Patrimônio
            </p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Contas bancárias
            </h2>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--app-accent)] px-6 py-4 text-base font-bold text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90 dark:bg-emerald-500 dark:text-slate-950"
            type="button"
            onClick={abrirNovaConta}
          >
            <Plus size={22} />
            Adicionar conta
          </button>
        </div>

        {erro && !isModalOpen && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {erro}
          </div>
        )}

        {contasQuery.isLoading || distribuicaoQuery.isLoading ? (
          <div className="rounded-2xl bg-[var(--app-card)] p-6 text-slate-500">
            Carregando contas...
          </div>
        ) : contasQuery.isError || distribuicaoQuery.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            Não foi possível carregar as contas.
          </div>
        ) : contas.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--app-card-border)] bg-[var(--app-card)] p-8 text-center">
            <Landmark className="text-[var(--app-accent)]" size={38} />
            <p className="mt-3 font-semibold text-slate-900 dark:text-white">
              Nenhuma conta cadastrada
            </p>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Cadastre uma conta para acompanhar onde está seu dinheiro.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contas.map((conta) => (
              <article
                className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                key={conta.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <BankBadge codigoBanco={conta.codigoBanco} />
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-slate-900 dark:text-white">
                        {conta.nomeCustomizado}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Banco {conta.codigoBanco}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className={`rounded-xl p-2 transition ${
                        conta.isFavorita
                          ? "text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          : "text-slate-400 hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-slate-800"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      type="button"
                      title={
                        conta.isFavorita
                          ? "Conta favorita"
                          : "Definir como favorita"
                      }
                      disabled={favoritingId === conta.id}
                      onClick={() => favoritar(conta)}
                    >
                      <Star
                        size={18}
                        fill={conta.isFavorita ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      className="rounded-xl p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
                      type="button"
                      title="Editar conta"
                      onClick={() => editar(conta)}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                      type="button"
                      title="Excluir conta"
                      onClick={() => excluir(conta)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="mt-5 border-t border-[color:var(--app-card-border)] pt-4">
                  <p className="text-sm text-slate-500">Valor em conta</p>
                  <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                    {formatCurrency(saldos.get(conta.id) ?? conta.saldoInicial)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Base ajustável: {formatCurrency(conta.saldoInicial)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ContaModal
        isOpen={isModalOpen}
        isEditing={Boolean(editingId)}
        form={form}
        erro={erro}
        onClose={fecharModal}
        onChange={setForm}
        onSubmit={handleSubmit}
      />
      {dialog}
    </AppLayout>
  );
}

function ContaModal({
  isOpen,
  isEditing,
  form,
  erro,
  onClose,
  onChange,
  onSubmit,
}: {
  isOpen: boolean;
  isEditing: boolean;
  form: AccountForm;
  erro: string | null;
  onClose: () => void;
  onChange: (form: AccountForm) => void;
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
          <span className="rounded-xl bg-[var(--app-card-muted)] p-2 text-[var(--app-accent)]">
            {isEditing ? <Pencil size={20} /> : <Plus size={20} />}
          </span>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {isEditing ? "Editar conta" : "Adicionar conta"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isEditing
                ? "Atualize o cadastro e ajuste o valor atual da conta."
                : "Cadastre a conta e informe o valor disponível nela."}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Nome da conta
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={form.nomeCustomizado}
              placeholder="Ex: Conta principal"
              maxLength={100}
              required
              onChange={(event) =>
                onChange({ ...form, nomeCustomizado: event.target.value })
              }
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Banco
            </span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={form.codigoBanco}
              onChange={(event) =>
                onChange({ ...form, codigoBanco: event.target.value })
              }
            >
              {principaisBancos.map((banco) => (
                <option key={banco.codigo} value={banco.codigo}>
                  {banco.codigo} - {banco.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Valor em conta
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              inputMode="decimal"
              value={form.valorEmConta}
              placeholder="R$ 0,00"
              onChange={(event) =>
                onChange({
                  ...form,
                  valorEmConta: maskBrlCurrencyInput(event.target.value),
                })
              }
            />
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
            Salvar conta
          </button>
        </div>
      </form>
    </div>
  );
}
