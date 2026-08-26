import axios from "axios";
import { CreditCard, Landmark, Plus, UserPlus } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  useCriarContatoEmprestimo,
  useCriarEmprestimo,
} from "../../hooks/mutations/useLoanMutations";
import type { CartaoCreditoOpcao, ContaBancaria } from "../../types/finance";
import type { ContatoEmprestimo, TipoEmprestimo as TipoEmprestimoType } from "../../types/loan";
import { OrigemFinanceiraEmprestimo, TipoEmprestimo } from "../../types/loan";
import {
  formatCurrencyInput,
  maskBrlCurrencyInput,
  parseBrlCurrency,
  toDateInputValue,
} from "../../utils/date";
import { Dialog } from "../Dialog";

type LoanFormDialogProps = {
  contatos: ContatoEmprestimo[];
  cartoes: CartaoCreditoOpcao[];
  contas: ContaBancaria[];
  isLoadingCartoes: boolean;
  isLoadingContas: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

type FormState = {
  contatoId: string;
  novoContato: boolean;
  contatoNome: string;
  descricao: string;
  origemFinanceira: 1 | 2;
  origemId: string;
  valorTotal: number;
  tipo: TipoEmprestimoType;
  quantidadeParcelas: number;
  data: string;
  semDataFinal: boolean;
  dataFimRecorrencia: string;
  observacao: string;
};

const initialForm: FormState = {
  contatoId: "",
  novoContato: false,
  contatoNome: "",
  descricao: "",
  origemFinanceira: OrigemFinanceiraEmprestimo.CartaoCredito,
  origemId: "",
  valorTotal: 0,
  tipo: TipoEmprestimo.Avista,
  quantidadeParcelas: 1,
  data: toDateInputValue(new Date()),
  semDataFinal: true,
  dataFimRecorrencia: "",
  observacao: "",
};

export function LoanFormDialog({
  contatos,
  cartoes,
  contas,
  isLoadingCartoes,
  isLoadingContas,
  onClose,
  onCreated,
}: LoanFormDialogProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [erro, setErro] = useState<string | null>(null);
  const criarContato = useCriarContatoEmprestimo();
  const criarEmprestimo = useCriarEmprestimo();
  const isSubmitting = criarContato.isPending || criarEmprestimo.isPending;
  const isCreatingContact = form.novoContato || contatos.length === 0;
  const origens =
    form.origemFinanceira === OrigemFinanceiraEmprestimo.CartaoCredito
      ? cartoes.map((cartao) => ({
          id: cartao.id,
          label: `${cartao.apelidoCartao} · ${cartao.banco}`,
        }))
      : contas
          .filter((conta) => !conta.isArquivada)
          .map((conta) => ({ id: conta.id, label: conta.nomeCustomizado }));
  const parcelaEstimada = useMemo(
    () =>
      form.quantidadeParcelas > 0
        ? form.valorTotal / form.quantidadeParcelas
        : 0,
    [form.quantidadeParcelas, form.valorTotal],
  );

  useEffect(() => {
    if (
      form.origemId &&
      !origens.some((origem) => origem.id === form.origemId)
    ) {
      setForm((current) => ({ ...current, origemId: "" }));
    }
  }, [form.origemId, origens]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setErro(null);

    try {
      let contatoId = form.contatoId;
      if (isCreatingContact) {
        const contato = await criarContato.mutateAsync({
          nome: form.contatoNome.trim(),
        });
        contatoId = contato.id;
      }

      if (!contatoId) throw new Error("Selecione ou crie uma pessoa.");
      if (!form.origemId) throw new Error("Selecione a origem financeira.");

      const criado = await criarEmprestimo.mutateAsync({
        contatoId,
        descricao: form.descricao.trim(),
        valorTotal: form.valorTotal,
        data: form.data,
        origemFinanceira: form.origemFinanceira,
        cartaoCreditoId:
          form.origemFinanceira === OrigemFinanceiraEmprestimo.CartaoCredito
            ? form.origemId
            : null,
        contaBancariaId:
          form.origemFinanceira === OrigemFinanceiraEmprestimo.ContaBancaria
            ? form.origemId
            : null,
        tipo: form.tipo,
        dataFimRecorrencia:
          form.tipo === TipoEmprestimo.Fixo && !form.semDataFinal
            ? form.dataFimRecorrencia
            : null,
        quantidadeParcelas:
          form.tipo === TipoEmprestimo.Parcelado ? form.quantidadeParcelas : 1,
        observacao: form.observacao.trim() || null,
      });
      onCreated(criado.id);
    } catch (error) {
      setErro(getErrorMessage(error));
    }
  }

  return (
    <Dialog
      title="Novo empréstimo"
      description="Registre um valor pago em benefício de outra pessoa."
      onClose={onClose}
      className="flex h-[calc(100dvh-1rem)] max-w-3xl flex-col overflow-hidden sm:h-auto sm:max-h-[calc(100dvh-2rem)]"
    >
      <form
        className="flex h-full min-h-0 flex-col sm:max-h-[calc(100dvh-2rem)]"
        onSubmit={handleSubmit}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-5 sm:px-7 sm:pt-7">
          <header className="pr-12">
            <p className="text-sm font-semibold text-[var(--app-accent)]">
              Novo empréstimo
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
              Registrar valor a receber
            </h2>
          </header>

          <div className="mt-6 rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-4 dark:border-slate-700 dark:bg-slate-900">
            <label
              className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400"
              htmlFor="loan-value"
            >
              {form.tipo === TipoEmprestimo.Fixo ? "Valor mensal" : "Valor total"}
            </label>
            <input
              id="loan-value"
              className="mt-1 w-full bg-transparent text-3xl font-black text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={
                form.valorTotal > 0 ? formatCurrencyInput(form.valorTotal) : ""
              }
              onChange={(event) =>
                setForm({
                  ...form,
                  valorTotal: parseBrlCurrency(
                    maskBrlCurrencyInput(event.target.value),
                  ),
                })
              }
              required
            />
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Pessoa
              </legend>
              {!isCreatingContact ? (
                <div className="mt-2 flex gap-2">
                  <select
                    aria-label="Pessoa"
                    className={inputClass}
                    value={form.contatoId}
                    onChange={(event) =>
                      setForm({ ...form, contatoId: event.target.value })
                    }
                    required
                  >
                    <option value="">Selecione uma pessoa</option>
                    {contatos.map((contato) => (
                      <option key={contato.id} value={contato.id}>
                        {contato.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    className={iconButtonClass}
                    type="button"
                    title="Criar contato"
                    aria-label="Criar novo contato"
                    onClick={() =>
                      setForm({ ...form, novoContato: true, contatoId: "" })
                    }
                  >
                    <UserPlus size={20} />
                  </button>
                </div>
              ) : (
                <div className="mt-2">
                  <div className="flex gap-2">
                    <input
                      aria-label="Nome da pessoa"
                      className={inputClass}
                      value={form.contatoNome}
                      onChange={(event) =>
                        setForm({ ...form, contatoNome: event.target.value })
                      }
                      placeholder="Nome da pessoa"
                      maxLength={160}
                      required
                    />
                    {contatos.length > 0 && (
                      <button
                        className="rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-200"
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            novoContato: false,
                            contatoNome: "",
                          })
                        }
                      >
                        Existente
                      </button>
                    )}
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <input type="checkbox" checked readOnly /> Salvar contato
                    para reutilizar
                  </label>
                </div>
              )}
            </fieldset>

            <Field label="Descrição">
              <input
                className={inputClass}
                value={form.descricao}
                onChange={(event) =>
                  setForm({ ...form, descricao: event.target.value })
                }
                maxLength={180}
                required
              />
            </Field>

            <fieldset>
              <legend className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Tipo
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([
                  [TipoEmprestimo.Avista, "À vista"],
                  [TipoEmprestimo.Parcelado, "Parcelado"],
                  [TipoEmprestimo.Fixo, "Fixo"],
                ] as const).map(([tipo, label]) => (
                  <button
                    key={tipo}
                    className={`min-h-11 rounded-lg border px-2 text-sm font-bold ${form.tipo === tipo ? "border-[var(--app-accent)] text-[var(--app-accent)]" : "border-[color:var(--app-card-border)] text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
                    type="button"
                    onClick={() => setForm({ ...form, tipo, quantidadeParcelas: tipo === TipoEmprestimo.Parcelado ? Math.max(2, form.quantidadeParcelas) : 1 })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Origem
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <ModeButton
                  active={form.origemFinanceira === 1}
                  icon={<CreditCard size={19} />}
                  label="Cartão"
                  onClick={() =>
                    setForm({ ...form, origemFinanceira: 1, origemId: "" })
                  }
                />
                <ModeButton
                  active={form.origemFinanceira === 2}
                  icon={<Landmark size={19} />}
                  label="Conta"
                  onClick={() =>
                    setForm({ ...form, origemFinanceira: 2, origemId: "" })
                  }
                />
              </div>
            </fieldset>

            <Field label={form.origemFinanceira === 1 ? "Cartão" : "Conta"}>
              <select
                className={inputClass}
                value={form.origemId}
                onChange={(event) =>
                  setForm({ ...form, origemId: event.target.value })
                }
                disabled={isLoadingCartoes || isLoadingContas}
                required
              >
                <option value="">
                  {isLoadingCartoes || isLoadingContas
                    ? "Carregando opções..."
                    : "Selecione"}
                </option>
                {origens.map((origem) => (
                  <option key={origem.id} value={origem.id}>
                    {origem.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={form.tipo === TipoEmprestimo.Parcelado ? "Primeira parcela" : form.tipo === TipoEmprestimo.Fixo ? "Início da recorrência" : "Data"}>
              <input
                className={inputClass}
                type="date"
                value={form.data}
                onChange={(event) =>
                  setForm({ ...form, data: event.target.value })
                }
                required
              />
            </Field>

            {form.tipo === TipoEmprestimo.Parcelado && (
              <Field label="Quantidade de parcelas">
                <input
                  className={inputClass}
                  type="number"
                  min={2}
                  max={360}
                  value={form.quantidadeParcelas}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      quantidadeParcelas: Number(event.target.value),
                    })
                  }
                  required
                />
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  Estimativa: {formatCurrencyInput(parcelaEstimada)}
                  {form.tipo === TipoEmprestimo.Parcelado && (
                    <span>
                      {" "}
                      por parcela. O fechamento exato é calculado
                      automaticamente.
                    </span>
                  )}
                </span>
              </Field>
            )}

            {form.tipo === TipoEmprestimo.Fixo && (
              <div className="rounded-lg border border-[color:var(--app-card-border)] p-4 dark:border-slate-700 sm:col-span-2">
                <label className="flex items-center justify-between gap-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                  Sem data final
                  <input type="checkbox" className="h-5 w-5" checked={form.semDataFinal} onChange={(event) => setForm({ ...form, semDataFinal: event.target.checked })} />
                </label>
                {!form.semDataFinal && (
                  <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-slate-200">
                    Última competência
                    <input className={`${inputClass} mt-2`} type="date" min={form.data} value={form.dataFimRecorrencia} onChange={(event) => setForm({ ...form, dataFimRecorrencia: event.target.value })} required />
                  </label>
                )}
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Periodicidade mensal. As competências futuras serão projetadas sem criar registros infinitos.</p>
              </div>
            )}

            <Field label="Observação" className="sm:col-span-2">
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={form.observacao}
                onChange={(event) =>
                  setForm({ ...form, observacao: event.target.value })
                }
                maxLength={500}
              />
            </Field>
          </div>

          {erro && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {erro}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-[color:var(--app-card-border)] bg-[var(--app-card)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:justify-end sm:px-7 sm:py-4">
          <button
            className={secondaryButtonClass}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            className={primaryButtonClass}
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Salvando..."
            ) : (
              <>
                <Plus size={18} /> Salvar empréstimo
              </>
            )}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-4 font-bold transition ${active ? "border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]" : "border-[color:var(--app-card-border)] text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
      type="button"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error))
    return (
      error.response?.data?.message ?? "Não foi possível salvar o empréstimo."
    );
  return error instanceof Error
    ? error.message
    : "Não foi possível salvar o empréstimo.";
}

const inputClass =
  "w-full rounded-lg border border-[color:var(--app-card-border)] bg-white px-3 py-3 text-slate-950 outline-none transition focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const iconButtonClass =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950";
const primaryButtonClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-5 font-bold text-[var(--app-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "min-h-12 rounded-lg border border-slate-300 px-5 font-bold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200";
