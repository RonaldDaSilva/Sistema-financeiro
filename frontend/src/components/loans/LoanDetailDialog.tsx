import axios from "axios";
import { Archive, ArchiveRestore, Calendar, Check, CreditCard, Landmark, Pencil, ReceiptText, RotateCcw, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { useAlterarRecorrenciaEmprestimo, useAtualizarEmprestimo, useDefinirArquivamentoEmprestimo, useDesfazerPagamentoEmprestimo, useEncerrarRecorrenciaEmprestimo, useExcluirEmprestimo, useRegistrarPagamentoEmprestimo } from "../../hooks/mutations/useLoanMutations";
import type { CartaoCreditoOpcao, ContaBancaria } from "../../types/finance";
import type { ContatoEmprestimo, EmprestimoDetalhe, ParcelaEmprestimo } from "../../types/loan";
import { EscopoAlteracaoRecorrenciaEmprestimo, OrigemFinanceiraEmprestimo, StatusEmprestimo, StatusParcelaEmprestimo, TipoEmprestimo } from "../../types/loan";
import { formatCurrency, formatCurrencyInput, formatDate, maskBrlCurrencyInput, parseBrlCurrency, toDateInputValue } from "../../utils/date";
import { Dialog } from "../Dialog";

type LoanDetailDialogProps = {
  emprestimo: EmprestimoDetalhe;
  contatos: ContatoEmprestimo[];
  cartoes: CartaoCreditoOpcao[];
  contas: ContaBancaria[];
  onClose: () => void;
  onChanged: (message: string) => void;
  requestDelete?: boolean;
};

export function LoanDetailDialog({ emprestimo, contatos, cartoes, contas, onClose, onChanged, requestDelete = false }: LoanDetailDialogProps) {
  const [mode, setMode] = useState<"detail" | "edit" | "payment">("detail");
  const [confirmDelete, setConfirmDelete] = useState(requestDelete);
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const atualizar = useAtualizarEmprestimo();
  const excluir = useExcluirEmprestimo();
  const desfazerPagamento = useDesfazerPagamentoEmprestimo();
  const definirArquivamento = useDefinirArquivamentoEmprestimo();
  const origemNome = emprestimo.origemFinanceira === OrigemFinanceiraEmprestimo.CartaoCredito
    ? cartoes.find((cartao) => cartao.id === emprestimo.cartaoCreditoId)?.apelidoCartao ?? "Cartão"
    : contas.find((conta) => conta.id === emprestimo.contaBancariaId)?.nomeCustomizado ?? "Conta bancária";
  const canDelete = emprestimo.pagamentos.length === 0 && emprestimo.parcelasPagas === 0;
  const canPay = emprestimo.status === StatusEmprestimo.EmAberto || emprestimo.status === StatusEmprestimo.ParcialmentePago;

  async function handleDelete() {
    if (excluir.isPending || !canDelete) return;
    setErro(null);
    try {
      await excluir.mutateAsync({ id: emprestimo.id, origemFinanceira: emprestimo.origemFinanceira });
      onChanged("Empréstimo excluído.");
      onClose();
    } catch (error) {
      setErro(getErrorMessage(error, "Não foi possível excluir o empréstimo."));
      setConfirmDelete(false);
    }
  }

  async function handleUndoPayment() {
    if (!confirmUndoId || desfazerPagamento.isPending) return;
    setErro(null);
    try {
      await desfazerPagamento.mutateAsync({ id: emprestimo.id, pagamentoId: confirmUndoId });
      setConfirmUndoId(null);
      onChanged("Recebimento desfeito e parcelas reabertas.");
    } catch (error) {
      setErro(getErrorMessage(error, "Não foi possível desfazer o recebimento."));
    }
  }

  async function handleArchive(arquivar: boolean) {
    if (definirArquivamento.isPending) return;
    setErro(null);
    try {
      await definirArquivamento.mutateAsync({ id: emprestimo.id, arquivar });
      onChanged(arquivar ? "Empréstimo arquivado." : "Empréstimo restaurado.");
      onClose();
    } catch (error) {
      setErro(getErrorMessage(error, "Não foi possível alterar o arquivamento."));
    }
  }

  return (
    <Dialog title="Detalhes do empréstimo" description={`Empréstimo para ${emprestimo.contatoNome}`} onClose={onClose} className="max-w-3xl" isDismissable={!atualizar.isPending && !excluir.isPending && !desfazerPagamento.isPending && !definirArquivamento.isPending}>
      <div className="p-5 sm:p-7">
        {mode === "edit" ? (
          <EditLoanForm emprestimo={emprestimo} contatos={contatos} isSubmitting={atualizar.isPending} onCancel={() => setMode("detail")} onSubmit={async (request) => {
            setErro(null);
            try {
              await atualizar.mutateAsync({ id: emprestimo.id, request });
              setMode("detail");
              onChanged("Informações atualizadas.");
            } catch (error) {
              setErro(getErrorMessage(error, "Não foi possível atualizar o empréstimo."));
            }
          }} />
        ) : mode === "payment" ? (
          <PaymentForm emprestimo={emprestimo} contas={contas} onCancel={() => setMode("detail")} onSuccess={() => { setMode("detail"); onChanged("Pagamento registrado."); }} />
        ) : (
          <>
            <header className="flex flex-col gap-4 pr-10 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--app-accent)]">{emprestimo.contatoNome}</p>
                <h2 className="mt-1 break-words text-2xl font-black text-slate-950 dark:text-white">{emprestimo.descricao}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  {emprestimo.origemFinanceira === 1 ? <CreditCard size={17} /> : <Landmark size={17} />}
                  <span>{origemNome}</span><span>·</span><span>{formatDate(emprestimo.data)}</span>
                  {emprestimo.tipo === TipoEmprestimo.Fixo && <><span>·</span><strong>Fixo mensal</strong></>}
                </div>
              </div>
              <StatusBadge status={emprestimo.status} />
            </header>

            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card-border)] dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-3">
              <Metric label="Total" value={formatCurrency(emprestimo.valorTotal)} />
              <Metric label="Recebido" value={formatCurrency(emprestimo.valorPago)} positive />
              <Metric label="A receber" value={formatCurrency(emprestimo.saldoReceber)} emphasis />
            </dl>

            {emprestimo.observacao && <p className="mt-5 rounded-lg bg-[var(--app-card-muted)] p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300"><strong className="mb-1 block text-slate-900 dark:text-white">Observação</strong>{emprestimo.observacao}</p>}

            {emprestimo.tipo === TipoEmprestimo.Fixo && (
              <RecurrenceControls emprestimo={emprestimo} onChanged={onChanged} />
            )}

            <section className="mt-7">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><Calendar size={19} /> Cronograma</h3>
              <div className="mt-3 divide-y divide-[color:var(--app-card-border)] overflow-hidden rounded-lg border border-[color:var(--app-card-border)] dark:divide-slate-800 dark:border-slate-800">
                {emprestimo.parcelas.map((parcela) => (
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-[var(--app-card)] px-4 py-3 dark:bg-slate-900" key={parcela.id}>
                    <strong className="text-sm text-slate-900 dark:text-white">{emprestimo.tipo === TipoEmprestimo.Fixo ? "Mensal" : `${parcela.numeroParcela}/${parcela.quantidadeTotal}`}</strong>
                    <span className="min-w-0 text-sm text-slate-500 dark:text-slate-400">{formatMonth(parcela.dataVencimento)} · {formatCurrency(parcela.valor)}</span>
                    <ParcelaBadge status={parcela.status} />
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-7">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><ReceiptText size={19} /> Histórico de pagamentos</h3>
              {emprestimo.pagamentos.length === 0 ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Nenhum pagamento registrado.</p> : (
                <div className="mt-3 divide-y divide-[color:var(--app-card-border)] dark:divide-slate-800">
                  {emprestimo.pagamentos.map((pagamento) => <div className="py-3" key={pagamento.id}><div className="flex items-start justify-between gap-4"><div><p className="font-bold text-slate-900 dark:text-white">{formatDate(pagamento.data)}</p><p className="text-xs text-slate-500 dark:text-slate-400">{pagamento.parcelaIds.length} {pagamento.parcelaIds.length === 1 ? "parcela" : "parcelas"}{pagamento.observacao ? ` · ${pagamento.observacao}` : ""}</p></div><div className="flex flex-col items-end gap-2"><strong className="text-emerald-600 dark:text-emerald-300">{formatCurrency(pagamento.valorTotal)}</strong><button className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-300" type="button" onClick={() => setConfirmUndoId(pagamento.id)}><RotateCcw size={14} /> Desfazer</button></div></div>{confirmUndoId === pagamento.id && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30"><p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Todas as parcelas deste recebimento voltarão para pendente e a entrada na conta será removida.</p><div className="mt-3 flex flex-wrap gap-2"><button className={secondaryButtonClass} type="button" onClick={() => setConfirmUndoId(null)} disabled={desfazerPagamento.isPending}>Manter pago</button><button className={dangerButtonClass} type="button" onClick={handleUndoPayment} disabled={desfazerPagamento.isPending}>{desfazerPagamento.isPending ? "Desfazendo..." : "Desfazer recebimento"}</button></div></div>}</div>)}
                </div>
              )}
            </section>

            {erro && <ErrorMessage>{erro}</ErrorMessage>}
            {confirmDelete && canDelete && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"><h3 className="font-black text-red-900 dark:text-red-100">Excluir empréstimo?</h3><p className="mt-1 text-sm text-red-800 dark:text-red-200">Este registro e seus efeitos financeiros relacionados serão removidos. Essa ação não pode ser desfeita.</p><dl className="mt-3 grid gap-2 text-sm text-red-900 dark:text-red-100 sm:grid-cols-3"><div><dt className="font-bold">Pessoa</dt><dd>{emprestimo.contatoNome}</dd></div><div><dt className="font-bold">Descrição</dt><dd>{emprestimo.descricao}</dd></div><div><dt className="font-bold">Valor</dt><dd>{formatCurrency(emprestimo.valorTotal)}</dd></div></dl>{emprestimo.quantidadeParcelas > 1 && <p className="mt-3 text-sm font-semibold text-red-800 dark:text-red-200">As parcelas futuras relacionadas também serão removidas.</p>}<div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className={secondaryButtonClass} type="button" onClick={() => setConfirmDelete(false)} disabled={excluir.isPending}>Cancelar</button><button className={dangerButtonClass} type="button" onClick={handleDelete} disabled={excluir.isPending}>{excluir.isPending ? "Excluindo..." : "Excluir"}</button></div></div>}
            {!canDelete && <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><h3 className="font-black text-amber-900 dark:text-amber-100">Não é possível excluir</h3><p className="mt-1 text-sm text-amber-800 dark:text-amber-200">Este empréstimo possui pagamentos registrados. Para preservar o histórico financeiro, ele não pode ser excluído diretamente.</p>{emprestimo.tipo === TipoEmprestimo.Fixo && emprestimo.recorrenciaAtiva && <p className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-200">Considere encerrar a recorrência.</p>}</div>}

            <footer className="mt-7 flex flex-col gap-3 border-t border-[color:var(--app-card-border)] pt-5 dark:border-slate-800 sm:flex-row sm:items-center">
              {canDelete && !confirmDelete && <button className={`${secondaryButtonClass} text-red-600 dark:text-red-300`} type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={17} /> Excluir empréstimo</button>}
              {emprestimo.status === StatusEmprestimo.Pago && <button className={secondaryButtonClass} type="button" onClick={() => void handleArchive(!emprestimo.isArquivado)} disabled={definirArquivamento.isPending}>{emprestimo.isArquivado ? <ArchiveRestore size={17} /> : <Archive size={17} />}{definirArquivamento.isPending ? "Salvando..." : emprestimo.isArquivado ? "Desarquivar" : "Arquivar"}</button>}
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
                <button className={secondaryButtonClass} type="button" onClick={() => setMode("edit")}><Pencil size={17} /> Editar</button>
                {canPay && <button className={primaryButtonClass} type="button" onClick={() => setMode("payment")}><Check size={18} /> Registrar pagamento</button>}
              </div>
            </footer>
          </>
        )}
        {erro && mode !== "detail" && <ErrorMessage>{erro}</ErrorMessage>}
      </div>
    </Dialog>
  );
}

function RecurrenceControls({ emprestimo, onChanged }: { emprestimo: EmprestimoDetalhe; onChanged: (message: string) => void }) {
  const [competencia, setCompetencia] = useState(toDateInputValue(new Date()));
  const [valor, setValor] = useState(emprestimo.valorTotal);
  const [escopo, setEscopo] = useState<1 | 2>(EscopoAlteracaoRecorrenciaEmprestimo.SomenteCompetencia);
  const [ultimaCompetencia, setUltimaCompetencia] = useState(emprestimo.dataFimRecorrencia ?? toDateInputValue(new Date()));
  const [erro, setErro] = useState<string | null>(null);
  const alterar = useAlterarRecorrenciaEmprestimo();
  const encerrar = useEncerrarRecorrenciaEmprestimo();

  async function handleChange() {
    setErro(null);
    try {
      await alterar.mutateAsync({ id: emprestimo.id, request: { competencia, valor, escopo } });
      onChanged(escopo === 1 ? "Valor desta competência atualizado." : "Valor das próximas competências atualizado.");
    } catch (error) {
      setErro(getErrorMessage(error, "Não foi possível alterar a recorrência."));
    }
  }

  async function handleEnd() {
    setErro(null);
    try {
      await encerrar.mutateAsync({ id: emprestimo.id, ultimaCompetencia });
      onChanged("Recorrência encerrada.");
    } catch (error) {
      setErro(getErrorMessage(error, "Não foi possível encerrar a recorrência."));
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-[color:var(--app-card-border)] p-4 dark:border-slate-800">
      <h3 className="font-black text-slate-950 dark:text-white">Regra mensal</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Início em {formatDate(emprestimo.data)} · {emprestimo.dataFimRecorrencia ? `até ${formatDate(emprestimo.dataFimRecorrencia)}` : "sem data final"}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Competência"><input className={inputClass} type="date" value={competencia} onChange={(event) => setCompetencia(event.target.value)} /></Field>
        <Field label="Novo valor"><input className={inputClass} inputMode="numeric" value={formatCurrencyInput(valor)} onChange={(event) => setValor(parseBrlCurrency(maskBrlCurrencyInput(event.target.value)))} /></Field>
        <Field label="Aplicar"><select className={inputClass} value={escopo} onChange={(event) => setEscopo(Number(event.target.value) as 1 | 2)}><option value={1}>Somente este mês</option><option value={2}>Deste mês em diante</option></select></Field>
      </div>
      <div className="mt-3 flex justify-end"><button className={secondaryButtonClass} type="button" onClick={() => void handleChange()} disabled={alterar.isPending || valor <= 0}>{alterar.isPending ? "Salvando..." : "Alterar valor"}</button></div>
      <div className="mt-4 flex flex-col gap-3 border-t border-[color:var(--app-card-border)] pt-4 dark:border-slate-800 sm:flex-row sm:items-end">
        <Field label="Última competência" className="flex-1"><input className={inputClass} type="date" min={emprestimo.data} value={ultimaCompetencia} onChange={(event) => setUltimaCompetencia(event.target.value)} /></Field>
        <button className={dangerButtonClass} type="button" onClick={() => void handleEnd()} disabled={encerrar.isPending}>{encerrar.isPending ? "Encerrando..." : "Encerrar recorrência"}</button>
      </div>
      {erro && <ErrorMessage>{erro}</ErrorMessage>}
    </section>
  );
}

function PaymentForm({ emprestimo, contas, onCancel, onSuccess }: { emprestimo: EmprestimoDetalhe; contas: ContaBancaria[]; onCancel: () => void; onSuccess: () => void }) {
  const pendentes = emprestimo.parcelas.filter((parcela) => parcela.status === StatusParcelaEmprestimo.Pendente);
  const chaveParcela = (parcela: ParcelaEmprestimo) => parcela.isVirtual ? `c:${parcela.competencia ?? parcela.dataVencimento}` : `p:${parcela.id}`;
  const [selecionadas, setSelecionadas] = useState<string[]>(() => emprestimo.tipo === TipoEmprestimo.Avista ? pendentes.map(chaveParcela) : []);
  const [data, setData] = useState(toDateInputValue(new Date()));
  const [contaId, setContaId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const registrar = useRegistrarPagamentoEmprestimo();
  const total = useMemo(() => pendentes.filter((parcela) => selecionadas.includes(chaveParcela(parcela))).reduce((sum, parcela) => sum + parcela.valor, 0), [pendentes, selecionadas]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registrar.isPending || selecionadas.length === 0) return;
    setErro(null);
    try {
      await registrar.mutateAsync({ id: emprestimo.id, request: {
        data,
        contaBancariaId: contaId || null,
        parcelaIds: selecionadas.filter((item) => item.startsWith("p:")).map((item) => item.slice(2)),
        competencias: selecionadas.filter((item) => item.startsWith("c:")).map((item) => item.slice(2)),
        observacao: observacao.trim() || null,
      } });
      onSuccess();
    } catch (error) {
      setErro(getErrorMessage(error, "Não foi possível registrar o pagamento."));
    }
  }

  return <form onSubmit={handleSubmit}>
    <header className="pr-10"><p className="text-sm font-bold text-[var(--app-accent)]">{emprestimo.contatoNome}</p><h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Registrar pagamento</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Selecione as parcelas recebidas. Parcelas futuras podem ser antecipadas.</p></header>
    <fieldset className="mt-6"><legend className="font-bold text-slate-900 dark:text-white">{emprestimo.tipo === TipoEmprestimo.Fixo ? "Competências pendentes" : "Parcelas pendentes"}</legend><div className="mt-3 max-h-72 divide-y divide-[color:var(--app-card-border)] overflow-y-auto rounded-lg border border-[color:var(--app-card-border)] dark:divide-slate-800 dark:border-slate-800">{pendentes.map((parcela) => { const chave = chaveParcela(parcela); return <label className="flex cursor-pointer items-center gap-3 bg-[var(--app-card)] px-4 py-3 dark:bg-slate-900" key={chave}><input className="h-5 w-5" type="checkbox" checked={selecionadas.includes(chave)} disabled={emprestimo.tipo === TipoEmprestimo.Avista} onChange={(event) => setSelecionadas(event.target.checked ? [...selecionadas, chave] : selecionadas.filter((id) => id !== chave))} /><span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{emprestimo.tipo === TipoEmprestimo.Fixo ? formatMonth(parcela.dataVencimento) : `${parcela.numeroParcela}/${parcela.quantidadeTotal} · ${formatMonth(parcela.dataVencimento)}`}</span><strong className="text-slate-950 dark:text-white">{formatCurrency(parcela.valor)}</strong></label>; })}</div></fieldset>
    <div className="mt-5 rounded-lg bg-[var(--app-card-muted)] p-4 dark:bg-slate-900"><span className="text-sm text-slate-500 dark:text-slate-400">Total calculado</span><output className="mt-1 block text-2xl font-black text-slate-950 dark:text-white" aria-label="Total calculado">{formatCurrency(total)}</output></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Data do recebimento"><input className={inputClass} type="date" value={data} onChange={(event) => setData(event.target.value)} required /></Field><Field label="Receber em conta (opcional)"><select className={inputClass} value={contaId} onChange={(event) => setContaId(event.target.value)}><option value="">Não informar</option>{contas.filter((conta) => !conta.isArquivada).map((conta) => <option key={conta.id} value={conta.id}>{conta.nomeCustomizado}</option>)}</select></Field><Field label="Observação" className="sm:col-span-2"><textarea className={`${inputClass} min-h-20`} value={observacao} onChange={(event) => setObservacao(event.target.value)} maxLength={500} /></Field></div>
    {erro && <ErrorMessage>{erro}</ErrorMessage>}
    <footer className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button className={secondaryButtonClass} type="button" onClick={onCancel} disabled={registrar.isPending}>Voltar</button><button className={primaryButtonClass} type="submit" disabled={registrar.isPending || selecionadas.length === 0}>{registrar.isPending ? "Registrando..." : `Registrar ${formatCurrency(total)}`}</button></footer>
  </form>;
}

function EditLoanForm({ emprestimo, contatos, isSubmitting, onCancel, onSubmit }: { emprestimo: EmprestimoDetalhe; contatos: ContatoEmprestimo[]; isSubmitting: boolean; onCancel: () => void; onSubmit: (request: { contatoId: string; descricao: string; observacao: string | null }) => Promise<void> }) {
  const [contatoId, setContatoId] = useState(emprestimo.contatoId);
  const [descricao, setDescricao] = useState(emprestimo.descricao);
  const [observacao, setObservacao] = useState(emprestimo.observacao ?? "");
  return <form onSubmit={(event) => { event.preventDefault(); void onSubmit({ contatoId, descricao: descricao.trim(), observacao: observacao.trim() || null }); }}><header className="pr-10"><p className="text-sm font-bold text-[var(--app-accent)]">Edição segura</p><h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Editar informações</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Origem, valor e cronograma permanecem inalterados.</p></header><div className="mt-6 grid gap-4"><Field label="Pessoa"><select className={inputClass} value={contatoId} onChange={(event) => setContatoId(event.target.value)}>{contatos.map((contato) => <option key={contato.id} value={contato.id}>{contato.nome}</option>)}</select></Field><Field label="Descrição"><input className={inputClass} value={descricao} onChange={(event) => setDescricao(event.target.value)} maxLength={180} required /></Field><Field label="Observação"><textarea className={`${inputClass} min-h-24`} value={observacao} onChange={(event) => setObservacao(event.target.value)} maxLength={500} /></Field></div><footer className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button className={secondaryButtonClass} type="button" onClick={onCancel} disabled={isSubmitting}>Voltar</button><button className={primaryButtonClass} type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar alterações"}</button></footer></form>;
}

function Metric({ label, value, positive, emphasis }: { label: string; value: string; positive?: boolean; emphasis?: boolean }) { return <div className="bg-[var(--app-card)] p-4 dark:bg-slate-900"><dt className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label}</dt><dd className={`mt-1 break-words font-black ${emphasis ? "text-amber-600 dark:text-amber-300" : positive ? "text-emerald-600 dark:text-emerald-300" : "text-slate-950 dark:text-white"}`}>{value}</dd></div>; }
function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) { return <label className={className}><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span><span className="mt-2 block">{children}</span></label>; }
function StatusBadge({ status }: { status: number }) { const styles = status === 3 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : status === 4 ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : status === 2 ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"; return <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${styles}`}>{statusLabel(status)}</span>; }
function ParcelaBadge({ status }: { status: number }) { return <span className={`rounded-full px-2 py-1 text-xs font-bold ${status === 2 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : status === 3 ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>{status === 2 ? "Pago" : status === 3 ? "Cancelado" : "Pendente"}</span>; }
function ErrorMessage({ children }: { children: React.ReactNode }) { return <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{children}</p>; }
function statusLabel(status: number) { return ({ 1: "Em aberto", 2: "Parcialmente pago", 3: "Pago", 4: "Cancelado" } as Record<number, string>)[status] ?? "Indefinido"; }
function formatMonth(value: string) { return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function getErrorMessage(error: unknown, fallback: string) { return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? fallback : error instanceof Error ? error.message : fallback; }
const inputClass = "w-full rounded-lg border border-[color:var(--app-card-border)] bg-white px-3 py-3 text-slate-950 outline-none focus:border-[var(--app-accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const primaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-5 font-bold text-[var(--app-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 font-bold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200";
const dangerButtonClass = "min-h-11 rounded-lg bg-red-600 px-4 font-bold text-white disabled:opacity-60";
