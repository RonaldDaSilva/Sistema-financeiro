import { AlertCircle, BanknoteArrowDown, CalendarDays, CircleDollarSign, HandCoins, Plus, RefreshCw, Users, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { LoadingState } from "../components/LoadingState";
import { LoanDetailDialog } from "../components/loans/LoanDetailDialog";
import { LoanFormDialog } from "../components/loans/LoanFormDialog";
import { useCartoesOpcoes, useContas } from "../hooks/queries/useFinanceQueries";
import { useContatosEmprestimo, useEmprestimoDetalhe, useEmprestimos } from "../hooks/queries/useLoanQueries";
import { OrigemFinanceiraEmprestimo, StatusEmprestimo } from "../types/loan";
import type { EmprestimoResumo } from "../types/loan";
import { formatCurrency } from "../utils/date";

export function LoansPage() {
  const [contatoId, setContatoId] = useState<string | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<"date" | "person">("date");
  const [showArchived, setShowArchived] = useState(false);
  const contatosQuery = useContatosEmprestimo();
  const emprestimosQuery = useEmprestimos(contatoId, showArchived);
  const detalheQuery = useEmprestimoDetalhe(selectedId);
  const needsSources = isNewOpen || Boolean(selectedId);
  const cartoesQuery = useCartoesOpcoes(needsSources);
  const contasQuery = useContas(needsSources);
  const resumo = useMemo(() => summarizeLoans(emprestimosQuery.data ?? []), [emprestimosQuery.data]);
  const grupos = useMemo(
    () => groupLoans(emprestimosQuery.data ?? [], groupMode),
    [emprestimosQuery.data, groupMode],
  );

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--app-accent)]">Valores a receber</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Empréstimos</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Acompanhe o que você pagou por outras pessoas e o que já recebeu.</p>
          </div>
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-5 font-black text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90" type="button" onClick={() => { setMessage(null); setIsNewOpen(true); }}><Plus size={19} /> Novo empréstimo</button>
        </header>

        {message && <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200"><span>{message}</span><button type="button" aria-label="Fechar mensagem" onClick={() => setMessage(null)}>×</button></div>}

        <section className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="Resumo de empréstimos">
          <SummaryCard icon={<CircleDollarSign size={21} />} label="A receber" value={formatCurrency(resumo.aReceber)} tone="amber" />
          <SummaryCard icon={<BanknoteArrowDown size={21} />} label="Recebido" value={formatCurrency(resumo.recebido)} tone="green" />
          <SummaryCard icon={<HandCoins size={21} />} label="Em aberto" value={String(resumo.emAberto)} complement={resumo.emAberto === 1 ? "empréstimo" : "empréstimos"} tone="blue" />
        </section>

        <section className="mt-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div><h2 className="text-lg font-black text-slate-950 dark:text-white">Registros</h2><p className="text-sm text-slate-500 dark:text-slate-400">Valores consolidados pelo backend por pessoa.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="grid grid-cols-2 rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-1 dark:border-slate-700 dark:bg-slate-900" aria-label="Organizar registros">
                <GroupButton active={groupMode === "date"} icon={<CalendarDays size={16} />} label="Por data" onClick={() => setGroupMode("date")} />
                <GroupButton active={groupMode === "person"} icon={<UsersRound size={16} />} label="Por pessoa" onClick={() => setGroupMode("person")} />
              </div>
              <label className="block sm:w-64"><span className="sr-only">Filtrar por pessoa</span><select className="w-full rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-3 py-3 font-semibold text-slate-900 outline-none focus:border-[var(--app-accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-white" value={contatoId ?? ""} onChange={(event) => setContatoId(event.target.value || null)} disabled={contatosQuery.isLoading}><option value="">Todas as pessoas</option>{(contatosQuery.data ?? []).map((contato) => <option key={contato.id} value={contato.id}>{contato.nome}</option>)}</select></label>
            </div>
          </div>

          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <input className="h-4 w-4 accent-[var(--app-accent)]" type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
            Mostrar arquivados
          </label>

          {emprestimosQuery.isLoading ? <LoadingState className="mt-4" label="Carregando empréstimos" /> : emprestimosQuery.isError ? (
            <StatePanel icon={<AlertCircle size={28} />} title="Não foi possível carregar" description="Verifique a conexão e tente novamente."><button className={retryButtonClass} type="button" onClick={() => emprestimosQuery.refetch()}><RefreshCw size={17} /> Tentar novamente</button></StatePanel>
          ) : (emprestimosQuery.data?.length ?? 0) === 0 ? (
            <StatePanel icon={<Users size={28} />} title={contatoId ? "Nenhum empréstimo para esta pessoa" : "Nenhum empréstimo registrado"} description={contatoId ? "Escolha outra pessoa ou registre um novo empréstimo." : "Registre o primeiro valor pago em benefício de outra pessoa."}>{!contatoId && <button className={retryButtonClass} type="button" onClick={() => setIsNewOpen(true)}><Plus size={17} /> Novo empréstimo</button>}</StatePanel>
          ) : <div className="mt-5 space-y-7">{grupos.map((grupo) => <section key={grupo.key} aria-labelledby={`loan-group-${grupo.key}`}><div className="flex items-center gap-3"><h3 id={`loan-group-${grupo.key}`} className="text-sm font-black uppercase text-slate-600 dark:text-slate-300">{grupo.label}</h3><span className="h-px flex-1 bg-[var(--app-card-border)] dark:bg-slate-800" /></div><LoanList emprestimos={grupo.items} onSelect={setSelectedId} /></section>)}</div>}
        </section>
      </div>

      {isNewOpen && <LoanFormDialog contatos={contatosQuery.data ?? []} cartoes={cartoesQuery.data ?? []} contas={contasQuery.data ?? []} isLoadingCartoes={cartoesQuery.isLoading} isLoadingContas={contasQuery.isLoading} onClose={() => setIsNewOpen(false)} onCreated={(id) => { setIsNewOpen(false); setSelectedId(id); setMessage("Empréstimo criado."); }} />}

      {selectedId && detalheQuery.isLoading && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><LoadingState label="Carregando detalhes" /></div>}
      {selectedId && detalheQuery.isError && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-md rounded-lg bg-[var(--app-card)] p-6 text-center dark:bg-slate-900"><AlertCircle className="mx-auto text-red-500" size={30} /><h2 className="mt-3 font-black text-slate-950 dark:text-white">Detalhes indisponíveis</h2><div className="mt-5 flex justify-center gap-2"><button className={retryButtonClass} type="button" onClick={() => setSelectedId(null)}>Fechar</button><button className={retryButtonClass} type="button" onClick={() => detalheQuery.refetch()}>Tentar novamente</button></div></div></div>}
      {selectedId && detalheQuery.data && <LoanDetailDialog emprestimo={detalheQuery.data} contatos={contatosQuery.data ?? []} cartoes={cartoesQuery.data ?? []} contas={contasQuery.data ?? []} onClose={() => setSelectedId(null)} onChanged={setMessage} />}
    </AppLayout>
  );
}

function LoanList({ emprestimos, onSelect }: { emprestimos: EmprestimoResumo[]; onSelect: (id: string) => void }) {
  return <>
    <div className="mt-3 hidden overflow-hidden rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] dark:border-slate-800 dark:bg-slate-900 md:block"><table className="w-full table-fixed"><thead className="bg-[var(--app-card-muted)] text-left text-xs font-black uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400"><tr><th className="w-[17%] px-4 py-3">Pessoa</th><th className="w-[22%] px-4 py-3">Descrição</th><th className="w-[13%] px-4 py-3">Origem</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Recebido</th><th className="px-4 py-3 text-right">A receber</th><th className="w-[14%] px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-[color:var(--app-card-border)] dark:divide-slate-800">{emprestimos.map((item) => <tr className="cursor-pointer transition hover:bg-[var(--app-card-muted)] dark:hover:bg-slate-800" key={item.id} tabIndex={0} onClick={() => onSelect(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(item.id); }}><td className="truncate px-4 py-4 font-bold text-slate-900 dark:text-white">{item.contatoNome}</td><td className="truncate px-4 py-4 text-slate-600 dark:text-slate-300">{item.descricao}</td><td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{item.origemFinanceira === OrigemFinanceiraEmprestimo.CartaoCredito ? "Cartão" : "Conta"}</td><td className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(item.valorTotal)}</td><td className="px-4 py-4 text-right font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(item.valorPago)}</td><td className="px-4 py-4 text-right font-black text-amber-600 dark:text-amber-300">{formatCurrency(item.saldoReceber)}</td><td className="px-4 py-4"><div className="flex flex-col items-start gap-1"><LoanStatus status={item.status} />{item.isArquivado && <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Arquivado</span>}</div></td></tr>)}</tbody></table></div>
    <div className="mt-3 grid gap-3 md:hidden">{emprestimos.map((item) => <button className="rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900" key={item.id} type="button" onClick={() => onSelect(item.id)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-slate-950 dark:text-white">{item.contatoNome}</strong><span className="mt-1 block truncate text-sm text-slate-500 dark:text-slate-400">{item.descricao}</span>{item.isArquivado && <span className="mt-1 block text-xs font-bold text-slate-500 dark:text-slate-400">Arquivado</span>}</div><LoanStatus status={item.status} /></div><dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[color:var(--app-card-border)] pt-3 text-xs dark:border-slate-800"><div><dt className="text-slate-500 dark:text-slate-400">Total</dt><dd className="mt-1 break-words font-bold text-slate-900 dark:text-white">{formatCurrency(item.valorTotal)}</dd></div><div><dt className="text-slate-500 dark:text-slate-400">Recebido</dt><dd className="mt-1 break-words font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(item.valorPago)}</dd></div><div><dt className="text-slate-500 dark:text-slate-400">Falta</dt><dd className="mt-1 break-words font-black text-amber-600 dark:text-amber-300">{formatCurrency(item.saldoReceber)}</dd></div></dl></button>)}</div>
  </>;
}

function SummaryCard({ icon, label, value, complement, tone }: { icon: React.ReactNode; label: string; value: string; complement?: string; tone: "amber" | "green" | "blue" }) { const colors = { amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" }; return <article className="flex items-center gap-4 rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${colors[tone]}`}>{icon}</span><div className="min-w-0"><p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 break-words text-xl font-black text-slate-950 dark:text-white">{value} {complement && <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{complement}</span>}</p></div></article>; }
function StatePanel({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children?: React.ReactNode }) { return <div className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 text-center dark:border-slate-700 dark:bg-slate-900"><span className="text-slate-400">{icon}</span><h3 className="mt-3 font-black text-slate-950 dark:text-white">{title}</h3><p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>{children && <div className="mt-4">{children}</div>}</div>; }
function LoanStatus({ status }: { status: number }) { const style = status === 3 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : status === 4 ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : status === 2 ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"; const label = ({ 1: "Em aberto", 2: "Parcial", 3: "Pago", 4: "Cancelado" } as Record<number, string>)[status]; return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${style}`}>{label}</span>; }
function summarizeLoans(items: EmprestimoResumo[]) { return items.reduce((summary, item) => ({ aReceber: summary.aReceber + item.saldoReceber, recebido: summary.recebido + item.valorPago, emAberto: summary.emAberto + (item.status === StatusEmprestimo.EmAberto || item.status === StatusEmprestimo.ParcialmentePago ? 1 : 0) }), { aReceber: 0, recebido: 0, emAberto: 0 }); }
function groupLoans(items: EmprestimoResumo[], mode: "date" | "person") {
  const groups = new Map<string, { key: string; label: string; items: EmprestimoResumo[] }>();
  for (const item of items) {
    const key = mode === "person" ? item.contatoId : item.data.slice(0, 7);
    const label = mode === "person" ? item.contatoNome : formatGroupMonth(item.data);
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}
function formatGroupMonth(value: string) { const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${value.slice(0, 7)}-01T00:00:00`)); return label.charAt(0).toUpperCase() + label.slice(1); }
function GroupButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) { return <button className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition ${active ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950" : "text-slate-500 dark:text-slate-400"}`} type="button" onClick={onClick}>{icon}{label}</button>; }
const retryButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200";
