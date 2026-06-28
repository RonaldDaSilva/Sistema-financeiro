import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import type {
  Categoria,
  PeriodoFiltro,
  TipoTransacaoFiltro,
} from "../types/finance";
import { addDays, parseLocalDate, toDateInputValue } from "../utils/date";

type PeriodFilterProps = {
  value: PeriodoFiltro;
  categorias: Categoria[];
  onChange: (value: PeriodoFiltro) => void;
};

export function PeriodFilter({
  value,
  categorias,
  onChange,
}: PeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const today = new Date();
  const inicio =
    value.tipo === "intervalo" ? value.inicio : toDateInputValue(today);
  const fim = value.tipo === "intervalo" ? value.fim : toDateInputValue(today);
  const tipoTransacao = value.tipoTransacao ?? "todos";
  const categoriaId = value.categoriaId ?? "todas";
  const [rangeStart, setRangeStart] = useState(inicio);
  const [rangeEnd, setRangeEnd] = useState(fim);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(
    () =>
      new Date(
        parseLocalDate(inicio).getFullYear(),
        parseLocalDate(inicio).getMonth(),
        1,
      ),
  );

  useEffect(() => {
    setRangeStart(inicio);
    setRangeEnd(fim);
  }, [fim, inicio]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (dateRef.current && !dateRef.current.contains(event.target as Node)) {
        setIsDateOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function aplicarIntervalo(nextInicio: string, nextFim: string) {
    const start = parseLocalDate(nextInicio);
    const end = parseLocalDate(nextFim);

    if (end < start) {
      setErro("A data final deve ser maior ou igual a data inicial.");
      return;
    }

    setErro(null);
    onChange({
      tipo: "intervalo",
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
      tipo: "intervalo",
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
    const lastDay = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth() + 1,
      0,
    );

    setErro(null);
    onChange({
      tipo: "intervalo",
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
      categoriaId: nextCategoriaId === "todas" ? null : nextCategoriaId,
    });
  }

  function selecionarData(date: Date) {
    const value = toDateInputValue(date);

    if (!selectingEnd) {
      setRangeStart(value);
      setRangeEnd(value);
      setSelectingEnd(true);
      return;
    }

    if (value < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(value);
    } else {
      setRangeEnd(value);
    }
    setSelectingEnd(false);
  }

  function aplicarRangeSelecionado() {
    aplicarIntervalo(rangeStart, rangeEnd);
    setIsDateOpen(false);
    setSelectingEnd(false);
  }

  return (
    <div className="relative z-30 w-full min-w-0 flex-1 overflow-visible">
      <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[auto_minmax(280px,1fr)] lg:items-center lg:gap-3">
        <div
          className="relative row-start-2 min-w-0 lg:col-start-1 lg:row-start-1"
          ref={menuRef}
        >
          <button
            className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 lg:w-auto"
            type="button"
            onClick={() => setIsOpen((current) => !current)}
          >
            <Filter
              size={16}
              className="mr-2 text-slate-500 dark:text-slate-400"
            />
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
                      aplicarTipoTransacao(
                        event.target.value as TipoTransacaoFiltro,
                      )
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

        <div
          className="relative row-start-1 flex min-w-0 items-center gap-1 lg:col-start-2 lg:row-start-1"
          ref={dateRef}
        >
          <button
            aria-label="Mês anterior"
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            type="button"
            onClick={() => aplicarMes(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="flex h-11 w-full min-w-0 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition hover:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900 dark:focus:ring-white sm:text-base"
            type="button"
            aria-expanded={isDateOpen}
            aria-label="Selecionar período"
            onClick={() => {
              setCalendarMonth(
                new Date(
                  parseLocalDate(inicio).getFullYear(),
                  parseLocalDate(inicio).getMonth(),
                  1,
                ),
              );
              setRangeStart(inicio);
              setRangeEnd(fim);
              setSelectingEnd(false);
              setIsDateOpen((current) => !current);
            }}
          >
            <Calendar
              size={19}
              className="shrink-0 text-slate-500 dark:text-slate-400"
            />
            <span className="min-w-0 truncate">
              {formatDisplayDate(inicio)} - {formatDisplayDate(fim)}
            </span>
          </button>
          <button
            aria-label="Próximo mês"
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            type="button"
            onClick={() => aplicarMes(1)}
          >
            <ChevronRight size={20} />
          </button>

          {isDateOpen && (
            <DateRangeCalendar
              calendarMonth={calendarMonth}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              selectingEnd={selectingEnd}
              onApply={aplicarRangeSelecionado}
              onChangeMonth={setCalendarMonth}
              onSelectDate={selecionarData}
            />
          )}
        </div>
      </div>

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
    </div>
  );
}

type DateRangeCalendarProps = {
  calendarMonth: Date;
  rangeStart: string;
  rangeEnd: string;
  selectingEnd: boolean;
  onApply: () => void;
  onChangeMonth: (date: Date) => void;
  onSelectDate: (date: Date) => void;
};

function DateRangeCalendar({
  calendarMonth,
  rangeStart,
  rangeEnd,
  selectingEnd,
  onApply,
  onChangeMonth,
  onSelectDate,
}: DateRangeCalendarProps) {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from(
    { length: firstWeekday + daysInMonth },
    (_, index) =>
      index < firstWeekday
        ? null
        : new Date(year, month, index - firstWeekday + 1),
  );
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(calendarMonth);

  return (
    <div className="absolute left-0 right-0 z-[90] mt-2 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:right-auto md:w-[360px]">
      <div className="flex items-center justify-between">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          type="button"
          aria-label="Mês anterior no calendário"
          onClick={() => onChangeMonth(new Date(year, month - 1, 1))}
        >
          <ChevronLeft size={19} />
        </button>
        <p className="capitalize font-bold text-slate-900 dark:text-white">
          {monthLabel}
        </p>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          type="button"
          aria-label="Próximo mês no calendário"
          onClick={() => onChangeMonth(new Date(year, month + 1, 1))}
        >
          <ChevronRight size={19} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-bold uppercase text-slate-400">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
          <span key={`${day}-${index}`} className="py-1">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((date, index) => {
          if (!date) {
            return <span key={`empty-${index}`} className="h-9" />;
          }

          const value = toDateInputValue(date);
          const isStart = value === rangeStart;
          const isEnd = value === rangeEnd;
          const isInRange = value >= rangeStart && value <= rangeEnd;

          return (
            <button
              key={value}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition ${
                isStart || isEnd
                  ? "bg-[var(--app-primary)] text-white shadow-sm"
                  : isInRange
                    ? "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
              type="button"
              aria-label={formatDisplayDate(value)}
              onClick={() => onSelectDate(date)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--app-card-border)] pt-3 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {selectingEnd
            ? "Selecione a data final"
            : "Selecione o início e o fim"}
        </p>
        <button
          className="rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-bold text-[var(--app-accent-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={selectingEnd}
          onClick={onApply}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
