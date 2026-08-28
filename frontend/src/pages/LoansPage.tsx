import {
  AlertCircle,
  BanknoteArrowDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  HandCoins,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { LoadingState } from "../components/LoadingState";
import { LoanDetailDialog } from "../components/loans/LoanDetailDialog";
import { LoanFormDialog } from "../components/loans/LoanFormDialog";
import { useCartoesOpcoes, useContas } from "../hooks/queries/useFinanceQueries";
import {
  useContatosEmprestimo,
  useEmprestimoDetalhe,
  useResumoEmprestimosMensal,
} from "../hooks/queries/useLoanQueries";
import { StatusParcelaEmprestimo, TipoEmprestimo } from "../types/loan";
import type { EmprestimoMensalItem } from "../types/loan";
import { formatCurrency } from "../utils/date";

export function LoansPage() {
  const hoje = useMemo(() => new Date(), []);
  const [periodo, setPeriodo] = useState({ mes: hoje.getMonth() + 1, ano: hoje.getFullYear() });
  const [contatoId, setContatoId] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteRequestedId, setDeleteRequestedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<"date" | "person">("date");
  const [showArchived, setShowArchived] = useState(false);
  const contatosQuery = useContatosEmprestimo();
  const resumoQuery = useResumoEmprestimosMensal(
    periodo.mes,
    periodo.ano,
    contatoId,
    showArchived,
    pagina,
  );
  const detalheQuery = useEmprestimoDetalhe(selectedId);
  const needsSources = isNewOpen || Boolean(selectedId);
  const cartoesQuery = useCartoesOpcoes(needsSources);
  const contasQuery = useContas(needsSources);
  const grupos = useMemo(
    () => groupLoans(resumoQuery.data?.itens ?? [], groupMode),
    [resumoQuery.data?.itens, groupMode],
  );

  const alterarPeriodo = (delta: number) => {
    const data = new Date(periodo.ano, periodo.mes - 1 + delta, 1);
    setPeriodo({ mes: data.getMonth() + 1, ano: data.getFullYear() });
    setPagina(1);
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--app-accent)]">Valores a receber</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Empréstimos</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Acompanhe as obrigações do mês sem perder a visão do saldo total.
            </p>
          </div>
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-5 font-black text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90"
            type="button"
            onClick={() => { setMessage(null); setIsNewOpen(true); }}
          >
            <Plus size={19} /> Novo empréstimo
          </button>
        </header>

        {message && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200">
            <span>{message}</span>
            <button type="button" aria-label="Fechar mensagem" onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        <MonthSelector
          mes={periodo.mes}
          ano={periodo.ano}
          onPrevious={() => alterarPeriodo(-1)}
          onNext={() => alterarPeriodo(1)}
          onChange={(mes, ano) => { setPeriodo({ mes, ano }); setPagina(1); }}
        />

        <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Resumo de empréstimos">
          <SummaryCard
            icon={<CircleDollarSign size={21} />}
            label="A receber total"
            value={formatCurrency(resumoQuery.data?.aReceberTotal ?? 0)}
            tone="amber"
          />
          <SummaryCard
            icon={<HandCoins size={21} />}
            label="Previsto neste mês"
            value={formatCurrency(resumoQuery.data?.previstoNoMes ?? 0)}
            tone="blue"
          />
          <SummaryCard
            icon={<BanknoteArrowDown size={21} />}
            label="Recebido neste mês"
            value={formatCurrency(resumoQuery.data?.recebidoNoMes ?? 0)}
            tone="green"
          />
        </section>

        <section className="mt-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Registros</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Competência mensal calculada pelo backend.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="grid grid-cols-2 rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-1 dark:border-slate-700 dark:bg-slate-900" aria-label="Organizar registros">
                <GroupButton active={groupMode === "date"} icon={<CalendarDays size={16} />} label="Por data" onClick={() => setGroupMode("date")} />
                <GroupButton active={groupMode === "person"} icon={<UsersRound size={16} />} label="Por pessoa" onClick={() => setGroupMode("person")} />
              </div>
              <label className="block sm:w-64">
                <span className="sr-only">Filtrar por pessoa</span>
                <select
                  className="w-full rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-3 py-3 font-semibold text-slate-900 outline-none focus:border-[var(--app-accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={contatoId ?? ""}
                  onChange={(event) => { setContatoId(event.target.value || null); setPagina(1); }}
                  disabled={contatosQuery.isLoading}
                >
                  <option value="">Todas as pessoas</option>
                  {(contatosQuery.data ?? []).map((contato) => (
                    <option key={contato.id} value={contato.id}>{contato.nome}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <input
              className="h-4 w-4 accent-[var(--app-accent)]"
              type="checkbox"
              checked={showArchived}
              onChange={(event) => { setShowArchived(event.target.checked); setPagina(1); }}
            />
            Mostrar arquivados
          </label>

          {resumoQuery.isLoading ? (
            <LoadingState className="mt-4" label="Carregando empréstimos" />
          ) : resumoQuery.isError ? (
            <StatePanel icon={<AlertCircle size={28} />} title="Não foi possível carregar" description="Verifique a conexão e tente novamente.">
              <button className={retryButtonClass} type="button" onClick={() => resumoQuery.refetch()}>
                <RefreshCw size={17} /> Tentar novamente
              </button>
            </StatePanel>
          ) : (resumoQuery.data?.itens.length ?? 0) === 0 ? (
            <StatePanel
              icon={<Users size={28} />}
              title={contatoId ? "Nenhum empréstimo para esta pessoa" : "Nenhum empréstimo registrado"}
              description={contatoId ? "Escolha outra pessoa ou registre um novo empréstimo." : "Registre o primeiro valor pago em benefício de outra pessoa."}
            >
              {!contatoId && <button className={retryButtonClass} type="button" onClick={() => setIsNewOpen(true)}><Plus size={17} /> Novo empréstimo</button>}
            </StatePanel>
          ) : (
            <>
              <div className="mt-5 space-y-7">
                {grupos.map((grupo) => (
                  <section key={grupo.key} aria-labelledby={`loan-group-${grupo.key}`}>
                    <div className="flex items-center gap-3">
                      <h3 id={`loan-group-${grupo.key}`} className="text-sm font-black uppercase text-slate-600 dark:text-slate-300">{grupo.label}</h3>
                      <span className="h-px flex-1 bg-[var(--app-card-border)] dark:bg-slate-800" />
                    </div>
                    <LoanList
                      emprestimos={grupo.items}
                      onSelect={(id) => { setDeleteRequestedId(null); setSelectedId(id); }}
                      onDelete={(id) => { setDeleteRequestedId(id); setSelectedId(id); }}
                    />
                  </section>
                ))}
              </div>
              {(resumoQuery.data?.totalPaginas ?? 0) > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button className={retryButtonClass} type="button" disabled={pagina === 1} onClick={() => setPagina((value) => value - 1)}>Anterior</button>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Página {pagina} de {resumoQuery.data?.totalPaginas}</span>
                  <button className={retryButtonClass} type="button" disabled={pagina >= (resumoQuery.data?.totalPaginas ?? 1)} onClick={() => setPagina((value) => value + 1)}>Próxima</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {isNewOpen && (
        <LoanFormDialog
          contatos={contatosQuery.data ?? []}
          cartoes={cartoesQuery.data ?? []}
          contas={contasQuery.data ?? []}
          isLoadingCartoes={cartoesQuery.isLoading}
          isLoadingContas={contasQuery.isLoading}
          onClose={() => setIsNewOpen(false)}
          onCreated={(id) => { setIsNewOpen(false); setSelectedId(id); setMessage("Empréstimo criado."); }}
        />
      )}
      {selectedId && detalheQuery.isLoading && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><LoadingState label="Carregando detalhes" /></div>}
      {selectedId && detalheQuery.isError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-[var(--app-card)] p-6 text-center dark:bg-slate-900">
            <AlertCircle className="mx-auto text-red-500" size={30} />
            <h2 className="mt-3 font-black text-slate-950 dark:text-white">Detalhes indisponíveis</h2>
            <div className="mt-5 flex justify-center gap-2">
              <button className={retryButtonClass} type="button" onClick={() => { setSelectedId(null); setDeleteRequestedId(null); }}>Fechar</button>
              <button className={retryButtonClass} type="button" onClick={() => detalheQuery.refetch()}>Tentar novamente</button>
            </div>
          </div>
        </div>
      )}
      {selectedId && detalheQuery.data && (
        <LoanDetailDialog
          emprestimo={detalheQuery.data}
          contatos={contatosQuery.data ?? []}
          cartoes={cartoesQuery.data ?? []}
          contas={contasQuery.data ?? []}
          requestDelete={deleteRequestedId === selectedId}
          onClose={() => { setSelectedId(null); setDeleteRequestedId(null); }}
          onChanged={setMessage}
        />
      )}
    </AppLayout>
  );
}

function MonthSelector({ mes, ano, onPrevious, onNext, onChange }: { mes: number; ano: number; onPrevious: () => void; onNext: () => void; onChange: (mes: number, ano: number) => void }) {
  const value = `${ano}-${String(mes).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(ano, mes - 1, 1));
  return (
    <section className="mt-7 flex items-center justify-center gap-2" aria-label="Selecionar competência">
      <button className={monthButtonClass} type="button" title="Mês anterior" aria-label="Mês anterior" onClick={onPrevious}><ChevronLeft size={20} /></button>
      <label className="relative min-w-0">
        <span className="sr-only">Selecionar mês</span>
        <span className="pointer-events-none flex min-h-11 min-w-52 items-center justify-center rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] px-4 font-black capitalize text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white">{label}</span>
        <input
          className="absolute inset-0 cursor-pointer opacity-0"
          type="month"
          aria-label="Selecionar mês"
          value={value}
          onChange={(event) => {
            const [nextAno, nextMes] = event.target.value.split("-").map(Number);
            if (nextMes && nextAno) onChange(nextMes, nextAno);
          }}
        />
      </label>
      <button className={monthButtonClass} type="button" title="Próximo mês" aria-label="Próximo mês" onClick={onNext}><ChevronRight size={20} /></button>
    </section>
  );
}

function LoanList({ emprestimos, onSelect, onDelete }: { emprestimos: EmprestimoMensalItem[]; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <>
      <div className="mt-3 hidden overflow-hidden rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] dark:border-slate-800 dark:bg-slate-900 md:block">
        <table className="w-full table-fixed">
          <thead className="bg-[var(--app-card-muted)] text-left text-xs font-black uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr><th className="w-[16%] px-4 py-3">Pessoa</th><th className="w-[20%] px-4 py-3">Descrição</th><th className="w-[14%] px-4 py-3">Origem</th><th className="px-4 py-3 text-right">No mês</th><th className="px-4 py-3 text-right">A receber</th><th className="w-[14%] px-4 py-3">Próximo vencimento</th><th className="w-[11%] px-4 py-3">Status</th><th className="w-14 px-2 py-3"><span className="sr-only">Ações</span></th></tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--app-card-border)] dark:divide-slate-800">
            {emprestimos.map((item) => (
              <tr className="cursor-pointer transition hover:bg-[var(--app-card-muted)] dark:hover:bg-slate-800" key={item.id} tabIndex={0} onClick={() => onSelect(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(item.id); }}>
                <td className="truncate px-4 py-4 font-bold text-slate-900 dark:text-white">{item.contatoNome}</td>
                <td className="truncate px-4 py-4 text-slate-600 dark:text-slate-300">{item.descricao}</td>
                <td className="truncate px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{item.origemNome}{item.tipo === TipoEmprestimo.Fixo && <span className="block text-xs font-bold text-[var(--app-accent)]">Fixo mensal</span>}</td>
                <td className="px-4 py-4 text-right"><strong className="text-slate-900 dark:text-white">{formatCurrency(item.valorCompetencia)}</strong>{item.numeroParcelaCompetencia && <span className="block text-xs text-slate-500">{item.numeroParcelaCompetencia}/{item.quantidadeParcelas}</span>}</td>
                <td className="px-4 py-4 text-right font-black text-amber-600 dark:text-amber-300">{formatCurrency(item.saldoReceber)}</td>
                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{formatDate(item.proximoVencimento)}</td>
                <td className="px-4 py-4"><LoanStatus status={item.status} />{item.statusCompetencia === StatusParcelaEmprestimo.Paga && <span className="mt-1 block text-[11px] font-bold text-emerald-600 dark:text-emerald-300">Parcela do mês paga</span>}</td>
                <td className="px-2 py-4"><button className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300" type="button" title="Excluir empréstimo" aria-label={`Excluir empréstimo ${item.descricao} de ${item.contatoNome}`} onClick={(event) => { event.stopPropagation(); onDelete(item.id); }}><Trash2 size={17} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-3 md:hidden">
        {emprestimos.map((item) => (
          <div className="relative cursor-pointer rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900" key={item.id} role="button" tabIndex={0} onClick={() => onSelect(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(item.id); }}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-slate-950 dark:text-white">{item.contatoNome}</strong><span className="mt-1 block truncate text-sm text-slate-500 dark:text-slate-400">{item.descricao} · {item.origemNome}{item.tipo === TipoEmprestimo.Fixo ? " · Fixo mensal" : ""}</span></div><LoanStatus status={item.status} /></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[color:var(--app-card-border)] pt-3 text-xs dark:border-slate-800">
              <div><dt className="text-slate-500 dark:text-slate-400">Previsto no mês</dt><dd className="mt-1 break-words font-bold text-slate-900 dark:text-white">{formatCurrency(item.valorCompetencia)}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">A receber total</dt><dd className="mt-1 break-words font-black text-amber-600 dark:text-amber-300">{formatCurrency(item.saldoReceber)}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Próximo vencimento</dt><dd className="mt-1 font-bold text-slate-700 dark:text-slate-200">{formatDate(item.proximoVencimento)}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Situação do mês</dt><dd className="mt-1 font-bold text-slate-700 dark:text-slate-200">{item.statusCompetencia === StatusParcelaEmprestimo.Paga ? "Pago" : item.valorCompetencia > 0 ? "Pendente" : "Sem parcela"}</dd></div>
            </dl>
            <div className="mt-2 flex justify-end"><button className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300" type="button" title="Excluir empréstimo" aria-label={`Excluir empréstimo ${item.descricao} de ${item.contatoNome}`} onClick={(event) => { event.stopPropagation(); onDelete(item.id); }}><Trash2 size={18} /></button></div>
          </div>
        ))}
      </div>
    </>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "amber" | "green" | "blue" }) {
  const colors = { amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" };
  return <article className="flex items-center gap-4 rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${colors[tone]}`}>{icon}</span><div className="min-w-0"><p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 break-words text-xl font-black text-slate-950 dark:text-white">{value}</p></div></article>;
}

function StatePanel({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children?: React.ReactNode }) {
  return <div className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 text-center dark:border-slate-700 dark:bg-slate-900"><span className="text-slate-400">{icon}</span><h3 className="mt-3 font-black text-slate-950 dark:text-white">{title}</h3><p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>{children && <div className="mt-4">{children}</div>}</div>;
}

function LoanStatus({ status }: { status: number }) {
  const style = status === 3 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : status === 4 ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : status === 2 ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  const label = ({ 1: "Em aberto", 2: "Parcial", 3: "Pago", 4: "Cancelado" } as Record<number, string>)[status];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${style}`}>{label}</span>;
}

function groupLoans(items: EmprestimoMensalItem[], mode: "date" | "person") {
  const groups = new Map<string, { key: string; label: string; items: EmprestimoMensalItem[] }>();
  for (const item of items) {
    const key = mode === "person" ? item.contatoId : item.dataCompetencia!;
    const label = mode === "person" ? item.contatoNome : formatDate(item.dataCompetencia);
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

function GroupButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition ${active ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950" : "text-slate-500 dark:text-slate-400"}`} type="button" onClick={onClick}>{icon}{label}</button>;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T00:00:00`));
}

const monthButtonClass = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[color:var(--app-card-border)] bg-[var(--app-card)] text-slate-700 transition hover:bg-[var(--app-card-muted)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const retryButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200";
