import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Landmark, Pencil, Plus, Star, Trash2 } from "lucide-react";
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

const emptyForm = {
  nomeCustomizado: "",
  codigoBanco: "001",
  saldoInicial: "",
};

export function AccountsPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const contasQuery = useContas();
  const distribuicaoQuery = useDistribuicaoContas();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const saldos = new Map(
    (distribuicaoQuery.data ?? []).map((conta) => [conta.id, conta.saldoAtual]),
  );

  async function invalidarContas() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contas }),
      queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    const request: ContaBancariaRequest = {
      nomeCustomizado: form.nomeCustomizado.trim(),
      codigoBanco: form.codigoBanco,
      saldoInicial: parseBrlCurrency(form.saldoInicial),
    };

    try {
      if (editingId) {
        await financeService.atualizarContaBancaria(editingId, request);
      } else {
        await financeService.criarContaBancaria(request);
      }

      setForm(emptyForm);
      setEditingId(null);
      await invalidarContas();
    } catch {
      setErro("Não foi possível salvar a conta bancária.");
    }
  }

  function editar(conta: ContaBancaria) {
    setEditingId(conta.id);
    setForm({
      nomeCustomizado: conta.nomeCustomizado,
      codigoBanco: conta.codigoBanco,
      saldoInicial: formatCurrencyInput(conta.saldoInicial),
    });
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
      <section className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <form
          className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-8 lg:self-start"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-[var(--app-card-muted)] p-2 text-[var(--app-accent)]">
              {editingId ? <Pencil size={20} /> : <Plus size={20} />}
            </span>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {editingId ? "Editar conta" : "Nova conta"}
            </h2>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
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
                  setForm({ ...form, nomeCustomizado: event.target.value })
                }
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Banco
              </span>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.codigoBanco}
                onChange={(event) =>
                  setForm({ ...form, codigoBanco: event.target.value })
                }
              >
                {principaisBancos.map((banco) => (
                  <option key={banco.codigo} value={banco.codigo}>
                    {banco.codigo} - {banco.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Saldo inicial
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                inputMode="decimal"
                value={form.saldoInicial}
                placeholder="R$ 0,00"
                onChange={(event) =>
                  setForm({
                    ...form,
                    saldoInicial: maskBrlCurrencyInput(event.target.value),
                  })
                }
              />
            </label>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              className="rounded-xl bg-[var(--app-accent)] px-4 py-2.5 font-bold text-[var(--app-accent-contrast)] shadow-sm hover:opacity-90"
              type="submit"
            >
              Salvar
            </button>
            {editingId && (
              <button
                className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium dark:border-slate-700"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
          {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}
        </form>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Patrimônio
            </p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Contas bancárias
            </h2>
          </div>

          {contasQuery.isLoading || distribuicaoQuery.isLoading ? (
            <div className="rounded-2xl bg-[var(--app-card)] p-6 text-slate-500">
              Carregando contas...
            </div>
          ) : contasQuery.isError || distribuicaoQuery.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              Não foi possível carregar as contas.
            </div>
          ) : (contasQuery.data ?? []).length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--app-card-border)] bg-[var(--app-card)] p-8 text-center">
              <Landmark className="text-slate-400" size={32} />
              <p className="mt-3 font-semibold">Nenhuma conta cadastrada</p>
              <p className="mt-1 text-sm text-slate-500">
                Cadastre uma conta para acompanhar onde está seu dinheiro.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(contasQuery.data ?? []).map((conta) => (
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
                    <p className="text-sm text-slate-500">Saldo atual</p>
                    <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                      {formatCurrency(saldos.get(conta.id) ?? conta.saldoInicial)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      {dialog}
    </AppLayout>
  );
}
