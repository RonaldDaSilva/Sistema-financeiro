import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import type { Categoria, PeriodoFiltro, TipoTransacaoFiltro } from '../types/finance';
import {
  addDays,
  parseLocalDate,
  toDateInputValue,
} from '../utils/date';

type PeriodFilterProps = {
  value: PeriodoFiltro;
  categorias: Categoria[];
  onChange: (value: PeriodoFiltro) => void;
};

export function PeriodFilter({ value, categorias, onChange }: PeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const today = new Date();
  const inicio = value.tipo === 'intervalo' ? value.inicio : toDateInputValue(today);
  const fim = value.tipo === 'intervalo' ? value.fim : toDateInputValue(today);
  const tipoTransacao = value.tipoTransacao ?? 'todos';
  const categoriaId = value.categoriaId ?? 'todas';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function aplicarIntervalo(nextInicio: string, nextFim: string) {
    const start = parseLocalDate(nextInicio);
    const end = parseLocalDate(nextFim);

    if (end < start) {
      setErro('A data final deve ser maior ou igual a data inicial.');
      return;
    }

    setErro(null);
    onChange({
      tipo: 'intervalo',
      inicio: nextInicio,
      fim: nextFim,
      tipoTransacao,
      categoriaId: value.categoriaId ?? null,
    });
  }

  function aplicarAtalho(dias: 7 | 15 | 30) {
    const end = new Date();
    const start = addDays(end, -(dias - 1));

    setErro(null);
    setIsOpen(false);
    onChange({
      tipo: 'intervalo',
      inicio: toDateInputValue(start),
      fim: toDateInputValue(end),
      tipoTransacao,
      categoriaId: value.categoriaId ?? null,
    });
  }

  function aplicarMes(offset: number) {
    const base = parseLocalDate(inicio);
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const firstDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);

    setErro(null);
    onChange({
      tipo: 'intervalo',
      inicio: toDateInputValue(firstDay),
      fim: toDateInputValue(lastDay),
      tipoTransacao,
      categoriaId: value.categoriaId ?? null,
    });
  }

  function aplicarTipoTransacao(nextTipoTransacao: TipoTransacaoFiltro) {
    onChange({ ...value, tipoTransacao: nextTipoTransacao });
  }

  function aplicarCategoria(nextCategoriaId: string) {
    onChange({
      ...value,
      categoriaId: nextCategoriaId === 'todas' ? null : nextCategoriaId,
    });
  }

  return (
    <div className="relative z-30 w-full min-w-0 overflow-visible rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end">
        <div className="relative min-w-0" ref={menuRef}>
          <button
            className="flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            type="button"
            onClick={() => setIsOpen((current) => !current)}
          >
            <Filter size={16} className="mr-2 text-slate-500 dark:text-slate-400" />
            Filtros
          </button>

          {isOpen && (
            <div className="absolute left-0 z-[80] mt-2 w-72 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Período
              </p>
              <div className="mt-2 grid gap-2">
                {[7, 15, 30].map((dias) => (
                  <button
                    key={dias}
                    className="rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    type="button"
                    onClick={() => aplicarAtalho(dias as 7 | 15 | 30)}
                  >
                    Últimos {dias} dias
                  </button>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Tipo de transação
                  <select
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-white"
                    value={tipoTransacao}
                    onChange={(event) =>
                      aplicarTipoTransacao(event.target.value as TipoTransacaoFiltro)
                    }
                  >
                    <option value="todos">Todos</option>
                    <option value="receita">Receitas</option>
                    <option value="despesa">Despesas</option>
                    <option value="investimento">Investimentos</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Categoria
                  <select
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-white"
                    value={categoriaId}
                    onChange={(event) => aplicarCategoria(event.target.value)}
                  >
                    <option value="todas">Todas as categorias</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">
            Data inicial
            <div className="relative mt-1 min-w-0 overflow-hidden rounded-xl">
              <Calendar size={18} className="pointer-events-none absolute left-3 top-2.5 text-slate-500 dark:text-slate-400" />
              <input
                className="block w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-2.5 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-white sm:text-base"
                type="date"
                value={inicio}
                onChange={(event) => aplicarIntervalo(event.target.value, fim)}
              />
            </div>
          </label>
          <label className="block min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">
            Data final
            <div className="relative mt-1 min-w-0 overflow-hidden rounded-xl">
              <Calendar size={18} className="pointer-events-none absolute left-3 top-2.5 text-slate-500 dark:text-slate-400" />
              <input
                className="block w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-2.5 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-white sm:text-base"
                type="date"
                value={fim}
                onChange={(event) => aplicarIntervalo(inicio, event.target.value)}
              />
            </div>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            aria-label="Mês anterior"
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            type="button"
            onClick={() => aplicarMes(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            aria-label="Próximo mês"
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            type="button"
            onClick={() => aplicarMes(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
