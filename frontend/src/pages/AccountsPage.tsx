import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowRightLeft,
  Landmark,
  Pencil,
  Plus,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { BankBadge } from "../components/BankBadge";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { Dialog } from "../components/Dialog";
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
  saldoInicial: string;
};

type AjusteForm = {
  saldoInformado: string;
  dataAjuste: string;
  observacao: string;
};

type TransferenciaForm = {
  contaOrigemId: string;
  contaDestinoId: string;
  valor: string;
  dataTransferencia: string;
  descricao: string;
  confirmarSemSaldo: boolean;
};

const hojeIso = new Date().toISOString().slice(0, 10);

const emptyForm: AccountForm = {
  nomeCustomizado: "",
  codigoBanco: "001",
  saldoInicial: "",
};

const emptyAjuste: AjusteForm = {
  saldoInformado: "",
  dataAjuste: hojeIso,
  observacao: "",
};

const emptyTransferencia: TransferenciaForm = {
  contaOrigemId: "",
  contaDestinoId: "",
  valor: "",
  dataTransferencia: hojeIso,
  descricao: "",
  confirmarSemSaldo: false,
};

export function AccountsPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const contasQuery = useContas();
  const distribuicaoQuery = useDistribuicaoContas();
  const contas = useMemo(() => contasQuery.data ?? [], [contasQuery.data]);
  const distribuicao = useMemo(
    () => distribuicaoQuery.data ?? [],
    [distribuicaoQuery.data],
  );
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<ContaBancaria | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [ajusteForm, setAjusteForm] = useState<AjusteForm>(emptyAjuste);
  const [transferenciaForm, setTransferenciaForm] =
    useState<TransferenciaForm>(emptyTransferencia);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const saldos = useMemo(
    () => new Map(distribuicao.map((conta) => [conta.id, conta.saldoAtual])),
    [distribuicao],
  );
  const saldoTotal = useMemo(
    () => distribuicao.reduce((total, conta) => total + conta.saldoAtual, 0),
    [distribuicao],
  );
  const contasOrdenadas = useMemo(
    () => [...contas].sort((a, b) => Number(b.isFavorita) - Number(a.isFavorita)),
    [contas],
  );

  async function invalidarDadosFinanceiros() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contas }),
      queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "relatorios"] }),
      queryClient.invalidateQueries({ queryKey: ["extrato"] }),
      queryClient.invalidateQueries({ queryKey: ["extrato-paginado"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes }),
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSaving(true);

    const contaAtual = editingId ? contas.find((conta) => conta.id === editingId) : null;
    const request: ContaBancariaRequest = {
      nomeCustomizado: form.nomeCustomizado.trim(),
      codigoBanco: form.codigoBanco,
      saldoInicial: editingId
        ? contaAtual?.saldoInicial ?? 0
        : parseBrlCurrency(form.saldoInicial),
    };

    try {
      if (editingId) {
        await financeService.atualizarContaBancaria(editingId, request);
      } else {
        await financeService.criarContaBancaria(request);
      }

      fecharModal();
      await invalidarDadosFinanceiros();
    } catch {
      setErro("Não foi possível salvar a conta bancária.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAjustarSaldo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustingAccount) {
      return;
    }

    setErro(null);
    setSaving(true);

    try {
      await financeService.ajustarSaldoContaBancaria(adjustingAccount.id, {
        saldoInformado: parseBrlCurrency(ajusteForm.saldoInformado),
        dataAjuste: ajusteForm.dataAjuste,
        observacao: ajusteForm.observacao.trim() || null,
      });
      setAdjustingAccount(null);
      setAjusteForm(emptyAjuste);
      await invalidarDadosFinanceiros();
    } catch {
      setErro("Não foi possível ajustar o saldo da conta.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransferir(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSaving(true);

    try {
      await financeService.transferirEntreContas({
        contaOrigemId: transferenciaForm.contaOrigemId,
        contaDestinoId: transferenciaForm.contaDestinoId,
        valor: parseBrlCurrency(transferenciaForm.valor),
        dataTransferencia: transferenciaForm.dataTransferencia,
        descricao: transferenciaForm.descricao.trim() || null,
        confirmarSemSaldo: transferenciaForm.confirmarSemSaldo,
      });
      setTransferOpen(false);
      setTransferenciaForm(emptyTransferencia);
      await invalidarDadosFinanceiros();
    } catch {
      setErro("Não foi possível transferir entre contas.");
    } finally {
      setSaving(false);
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
      saldoInicial: formatCurrencyInput(conta.saldoInicial),
    });
    setErro(null);
    setIsModalOpen(true);
  }

  function abrirAjuste(conta: ContaBancaria) {
    setAdjustingAccount(conta);
    setAjusteForm({
      ...emptyAjuste,
      saldoInformado: formatCurrencyInput(saldos.get(conta.id) ?? conta.saldoInicial),
    });
    setErro(null);
  }

  function abrirTransferencia() {
    setTransferenciaForm({
      ...emptyTransferencia,
      contaOrigemId: contas[0]?.id ?? "",
      contaDestinoId: contas[1]?.id ?? "",
    });
    setErro(null);
    setTransferOpen(true);
  }

  function fecharModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setErro(null);
  }

  async function arquivar(conta: ContaBancaria) {
    const confirmed = await confirm({
      title: "Arquivar conta bancária",
      message: `Deseja arquivar "${conta.nomeCustomizado}"? O histórico será preservado e ela não aparecerá em novos lançamentos.`,
      confirmLabel: "Arquivar",
      variant: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      await financeService.arquivarContaBancaria(conta.id);
      await invalidarDadosFinanceiros();
    } catch {
      setErro("Não foi possível arquivar a conta bancária.");
    }
  }

  async function favoritar(conta: ContaBancaria) {
    setErro(null);
    setFavoritingId(conta.id);

    try {
      await financeService.favoritarContaBancaria(conta.id);
      await invalidarDadosFinanceiros();
    } catch {
      setErro("Não foi possível definir a conta favorita.");
    } finally {
      setFavoritingId(null);
    }
  }

  return (
    <AppLayout>
      <section className="mx-auto max-w-[1400px] px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Patrimônio
            </p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Contas bancárias
            </h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-5 py-3 font-bold text-slate-700 shadow-sm transition hover:bg-[var(--app-card-muted)] dark:text-slate-100"
              type="button"
              onClick={abrirTransferencia}
              disabled={contas.length < 2}
            >
              <ArrowRightLeft size={20} />
              Transferir
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--app-accent)] px-6 py-3 font-bold text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90 dark:bg-emerald-500 dark:text-slate-950"
              type="button"
              onClick={abrirNovaConta}
            >
              <Plus size={22} />
              Adicionar conta
            </button>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Saldo total das contas
          </p>
          <p className="mt-1 break-words text-3xl font-black leading-tight text-slate-900 [overflow-wrap:anywhere] dark:text-white">
            {formatCurrency(saldoTotal)}
          </p>
        </div>

        {erro && !isModalOpen && !adjustingAccount && !transferOpen && (
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
            {contasOrdenadas.map((conta) => {
              const saldo = saldos.get(conta.id) ?? conta.saldoInicial;
              const percentual = saldoTotal === 0 ? 0 : (saldo / saldoTotal) * 100;

              return (
                <article
                  className={`rounded-2xl border bg-[var(--app-card)] p-5 shadow-sm transition hover:shadow-md dark:bg-slate-900 ${
                    conta.isFavorita
                      ? "border-amber-300 ring-2 ring-amber-200/70 dark:border-amber-400/70 dark:ring-amber-500/20"
                      : "border-[color:var(--app-card-border)] dark:border-slate-800"
                  }`}
                  key={conta.id}
                >
                  <div className="flex min-w-0 flex-col gap-4 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <BankBadge codigoBanco={conta.codigoBanco} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 className="min-w-0 break-words font-bold text-slate-900 dark:text-white">
                            {conta.nomeCustomizado}
                          </h3>
                          {conta.isFavorita && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              Favorita
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">Banco {conta.codigoBanco}</p>
                      </div>
                    </div>
                    <button
                      className={`rounded-xl p-2 transition ${
                        conta.isFavorita
                          ? "text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          : "text-slate-400 hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-slate-800"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      type="button"
                      aria-label={conta.isFavorita ? "Conta favorita" : "Definir como favorita"}
                      disabled={favoritingId === conta.id}
                      onClick={() => favoritar(conta)}
                    >
                      <Star size={18} fill={conta.isFavorita ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <div className="mt-5 border-t border-[color:var(--app-card-border)] pt-4">
                    <p className="text-sm text-slate-500">Valor em conta</p>
                    <p className="mt-1 break-words text-2xl font-black leading-tight text-slate-900 [overflow-wrap:anywhere] dark:text-white">
                      {formatCurrency(saldo)}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[var(--app-accent)]"
                        style={{ width: `${Math.max(0, Math.min(100, percentual))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {percentual.toFixed(1).replace(".", ",")}% do patrimônio em contas
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                    <ActionButton label="Editar" icon={<Pencil size={16} />} onClick={() => editar(conta)} />
                    <ActionButton
                      label="Ajustar"
                      icon={<SlidersHorizontal size={16} />}
                      onClick={() => abrirAjuste(conta)}
                    />
                    <ActionButton
                      label="Arquivar"
                      icon={<Archive size={16} />}
                      danger
                      onClick={() => arquivar(conta)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ContaModal
        isOpen={isModalOpen}
        isEditing={Boolean(editingId)}
        form={form}
        erro={erro}
        saving={saving}
        permiteEditarSaldoInicial={
          !editingId || contas.find((conta) => conta.id === editingId)?.permiteEditarSaldoInicial === true
        }
        onClose={fecharModal}
        onChange={setForm}
        onSubmit={handleSubmit}
      />
      <AjusteSaldoModal
        conta={adjustingAccount}
        form={ajusteForm}
        erro={erro}
        saving={saving}
        onClose={() => setAdjustingAccount(null)}
        onChange={setAjusteForm}
        onSubmit={handleAjustarSaldo}
      />
      <TransferenciaModal
        isOpen={transferOpen}
        contas={contas}
        form={transferenciaForm}
        erro={erro}
        saving={saving}
        onClose={() => setTransferOpen(false)}
        onChange={setTransferenciaForm}
        onSubmit={handleTransferir}
      />
      {dialog}
    </AppLayout>
  );
}

function ActionButton({
  label,
  icon,
  danger,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
        danger
          ? "border-red-100 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
          : "border-[color:var(--app-card-border)] text-slate-600 hover:bg-[var(--app-card-muted)] dark:text-slate-200"
      }`}
      type="button"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function ContaModal({
  isOpen,
  isEditing,
  form,
  erro,
  saving,
  permiteEditarSaldoInicial,
  onClose,
  onChange,
  onSubmit,
}: {
  isOpen: boolean;
  isEditing: boolean;
  form: AccountForm;
  erro: string | null;
  saving: boolean;
  permiteEditarSaldoInicial: boolean;
  onClose: () => void;
  onChange: (form: AccountForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={onSubmit}>
        <ModalHeader
          icon={isEditing ? <Pencil size={20} /> : <Plus size={20} />}
          title={isEditing ? "Editar conta" : "Adicionar conta"}
          description={
            isEditing
              ? "Atualize apenas os dados cadastrais da conta."
              : "Cadastre a conta e informe o saldo inicial."
          }
          onClose={onClose}
        />

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
              onChange={(event) => onChange({ ...form, codigoBanco: event.target.value })}
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
              Saldo inicial
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              inputMode="decimal"
              value={form.saldoInicial}
              placeholder="R$ 0,00"
              disabled={isEditing && !permiteEditarSaldoInicial}
              onChange={(event) =>
                onChange({
                  ...form,
                  saldoInicial: maskBrlCurrencyInput(event.target.value),
                })
              }
            />
            {isEditing && !permiteEditarSaldoInicial && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Use “Ajustar saldo” para registrar uma correção auditável.
              </p>
            )}
          </label>
        </div>

        {erro && <p className="mt-4 text-sm font-medium text-red-600">{erro}</p>}
        <ModalActions onClose={onClose} saving={saving} submitLabel="Salvar conta" />
      </form>
    </ModalShell>
  );
}

function AjusteSaldoModal({
  conta,
  form,
  erro,
  saving,
  onClose,
  onChange,
  onSubmit,
}: {
  conta: ContaBancaria | null;
  form: AjusteForm;
  erro: string | null;
  saving: boolean;
  onClose: () => void;
  onChange: (form: AjusteForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!conta) {
    return null;
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={onSubmit}>
        <ModalHeader
          icon={<SlidersHorizontal size={20} />}
          title="Ajustar saldo"
          description={`Registre uma movimentação de ajuste em ${conta.nomeCustomizado}.`}
          onClose={onClose}
        />
        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Saldo correto
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              inputMode="decimal"
              value={form.saldoInformado}
              placeholder="R$ 0,00"
              required
              onChange={(event) =>
                onChange({
                  ...form,
                  saldoInformado: maskBrlCurrencyInput(event.target.value),
                })
              }
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Data do ajuste
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              type="date"
              value={form.dataAjuste}
              required
              onChange={(event) => onChange({ ...form, dataAjuste: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Observação
            </span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={form.observacao}
              maxLength={500}
              onChange={(event) => onChange({ ...form, observacao: event.target.value })}
            />
          </label>
        </div>
        {erro && <p className="mt-4 text-sm font-medium text-red-600">{erro}</p>}
        <ModalActions onClose={onClose} saving={saving} submitLabel="Registrar ajuste" />
      </form>
    </ModalShell>
  );
}

function TransferenciaModal({
  isOpen,
  contas,
  form,
  erro,
  saving,
  onClose,
  onChange,
  onSubmit,
}: {
  isOpen: boolean;
  contas: ContaBancaria[];
  form: TransferenciaForm;
  erro: string | null;
  saving: boolean;
  onClose: () => void;
  onChange: (form: TransferenciaForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={onSubmit}>
        <ModalHeader
          icon={<ArrowRightLeft size={20} />}
          title="Transferir entre contas"
          description="A transferência cria dois lançamentos vinculados e não altera receitas ou despesas."
          onClose={onClose}
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ContaSelect
            label="Conta de origem"
            value={form.contaOrigemId}
            contas={contas}
            onChange={(value) => onChange({ ...form, contaOrigemId: value })}
          />
          <ContaSelect
            label="Conta de destino"
            value={form.contaDestinoId}
            contas={contas}
            onChange={(value) => onChange({ ...form, contaDestinoId: value })}
          />
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Valor
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              inputMode="decimal"
              value={form.valor}
              placeholder="R$ 0,00"
              required
              onChange={(event) =>
                onChange({ ...form, valor: maskBrlCurrencyInput(event.target.value) })
              }
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Data
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              type="date"
              value={form.dataTransferencia}
              required
              onChange={(event) =>
                onChange({ ...form, dataTransferencia: event.target.value })
              }
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Descrição
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={form.descricao}
              placeholder="Ex: Reserva para investimentos"
              onChange={(event) => onChange({ ...form, descricao: event.target.value })}
            />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-[color:var(--app-card-border)] p-3 text-sm text-slate-700 dark:text-slate-200 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.confirmarSemSaldo}
              onChange={(event) =>
                onChange({ ...form, confirmarSemSaldo: event.target.checked })
              }
            />
            Permitir que a conta de origem fique negativa
          </label>
        </div>
        {erro && <p className="mt-4 text-sm font-medium text-red-600">{erro}</p>}
        <ModalActions onClose={onClose} saving={saving} submitLabel="Transferir" />
      </form>
    </ModalShell>
  );
}

function ContaSelect({
  label,
  value,
  contas,
  onChange,
}: {
  label: string;
  value: string;
  contas: ContaBancaria[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <select
        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        value={value}
        required
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecione</option>
        {contas.map((conta) => (
          <option key={conta.id} value={conta.id}>
            {conta.nomeCustomizado}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <Dialog
      title="Formulário de conta"
      description="Gerencie dados cadastrais, ajustes de saldo e transferências entre contas."
      onClose={onClose}
      className="max-w-xl p-4 sm:p-6"
      showCloseButton={false}
    >
      {children}
    </Dialog>
  );
}

function ModalHeader({
  icon,
  title,
  description,
  onClose,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <>
      <button
        className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
        type="button"
        onClick={onClose}
        aria-label="Fechar"
      >
        <X size={20} />
      </button>
      <div className="flex min-w-0 items-start gap-3 pr-10">
        <span className="shrink-0 rounded-xl bg-[var(--app-card-muted)] p-2 text-[var(--app-accent)]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
    </>
  );
}

function ModalActions({
  onClose,
  saving,
  submitLabel,
}: {
  onClose: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        className="rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
        type="button"
        onClick={onClose}
        disabled={saving}
      >
        Cancelar
      </button>
      <button
        className="rounded-xl bg-[var(--app-accent)] px-5 py-3 font-bold text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
        type="submit"
        disabled={saving}
      >
        {saving ? "Salvando..." : submitLabel}
      </button>
    </div>
  );
}
