import { FormEvent, useCallback, useEffect, useState } from "react";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { hasUsableStoredAuth } from "../services/authStorage";
import * as financeService from "../services/financeService";
import type { CartaoCredito } from "../types/finance";
import {
  formatCurrency,
  formatCurrencyInput,
  maskBrlCurrencyInput,
  parseBrlCurrency,
} from "../utils/date";

type CardForm = {
  apelidoCartao: string;
  banco: string;
  diaVencimento: number;
  melhorDiaCompra: number;
  limiteTotal: number;
};

const emptyForm: CardForm = {
  apelidoCartao: "",
  banco: "",
  diaVencimento: 10,
  melhorDiaCompra: 4,
  limiteTotal: 0,
};

export function CardsPage() {
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!hasUsableStoredAuth()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErro(null);

    try {
      const cartoesResponse = await financeService.listarCartoesCredito();
      setCartoes(cartoesResponse);
    } catch {
      setErro("Nao foi possivel carregar os cartões.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    try {
      if (editingId) {
        await financeService.atualizarCartaoCredito(editingId, form);
      } else {
        await financeService.criarCartaoCredito(form);
      }

      setForm(emptyForm);
      setEditingId(null);
      await carregar();
    } catch {
      setErro("Não foi possível salvar o cartão.");
    }
  }

  function editar(cartao: CartaoCredito) {
    setEditingId(cartao.id);
    setForm({
      apelidoCartao: cartao.apelidoCartao,
      banco: cartao.banco,
      diaVencimento: cartao.diaVencimento,
      melhorDiaCompra: cartao.melhorDiaCompra,
      limiteTotal: cartao.limiteTotal,
    });
  }

  async function excluir(id: string) {
    try {
      await financeService.excluirCartaoCredito(id);
      await carregar();
    } catch {
      setErro("Não foi possível excluir o cartão.");
    }
  }

  return (
    <AppLayout>
      <section className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <form
          className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-24 lg:self-start"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--app-card-muted)] p-2 text-[var(--app-accent)]">
              {editingId ? <Pencil size={20} /> : <Plus size={20} />}
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {editingId ? "Editar cartão" : "Novo cartão"}
            </h2>
          </div>
          <div className="mt-5 space-y-4">
            <TextField
              label="Apelido"
              value={form.apelidoCartao}
              onChange={(value) => setForm({ ...form, apelidoCartao: value })}
            />
            <TextField
              label="Banco"
              value={form.banco}
              onChange={(value) => setForm({ ...form, banco: value })}
            />
            <NumberField
              label="Dia vencimento"
              value={form.diaVencimento}
              min={1}
              max={31}
              onChange={(value) => setForm({ ...form, diaVencimento: value })}
            />
            <NumberField
              label="Melhor dia compra"
              value={form.melhorDiaCompra}
              min={1}
              max={31}
              onChange={(value) => setForm({ ...form, melhorDiaCompra: value })}
            />
            <NumberField
              label="Limite total"
              value={form.limiteTotal}
              onChange={(value) => setForm({ ...form, limiteTotal: value })}
              currency
            />
          </div>
          <div className="mt-5 flex gap-3">
            <button
              className="rounded-lg bg-[var(--app-accent)] px-4 py-2 font-medium text-[var(--app-accent-contrast)] shadow-sm transition-colors hover:opacity-90 dark:bg-white dark:text-slate-950"
              type="submit"
            >
              Salvar
            </button>
            {editingId && (
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
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

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cartões</p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Limites e cadastro
            </h2>
          </div>
          {isLoading ? (
            <div className="rounded-2xl bg-[var(--app-card)] p-6 text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
              Carregando cartões...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {cartoes.map((cartao) => {
                const disponivel = cartao.limiteDisponivel;
                const utilizado = cartao.valorUtilizado ?? Math.max(0, cartao.limiteTotal - disponivel);
                const percentualUtilizado = cartao.limiteTotal > 0
                  ? Math.min(100, Math.max(0, (utilizado / cartao.limiteTotal) * 100))
                  : 0;

                return (
                  <article
                    className="relative overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                    key={cartao.id}
                  >
                    <div className="absolute left-0 top-0 h-full w-1.5 bg-[var(--app-accent)]" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                          <CreditCard size={20} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {cartao.apelidoCartao}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{cartao.banco}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
                          type="button"
                          onClick={() => editar(cartao)}
                          title="Editar cartão"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700"
                          type="button"
                          onClick={() => excluir(cartao.id)}
                          title="Excluir cartão"
                        >
                          <Trash2 size={18} />
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
                          className={`font-semibold ${disponivel >= 0 ? "text-emerald-700" : "text-red-700"}`}
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
                    </dl>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </AppLayout>
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
