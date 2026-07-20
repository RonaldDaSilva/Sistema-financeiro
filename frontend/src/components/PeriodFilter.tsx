import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import type {
  Categoria,
  PeriodoFiltro,
  StatusFiltro,
  TipoTransacaoFiltro,
} from "../types/finance";
import { addDays, parseLocalDate, toDateInputValue } from "../utils/date";

const STATUS_OPTIONS: Array<{
  value: Exclude<StatusFiltro, "todos">;
  label: string;
}> = [
  { value: "pagas", label: "Pagas" },
  { value: "pendentes", label: "Pendentes" },
  { value: "atrasadas", label: "Atrasadas" },
];

const TIPO_TRANSACAO_OPTIONS: Array<{
  value: TipoTransacaoFiltro;
  label: string;
}> = [
  { value: "todos", label: "Todos" },
  { value: "receita", label: "Receitas" },
  { value: "despesa", label: "Despesas" },
  { value: "investimento", label: "Investimentos" },
];

type PeriodFilterProps = {
  value: PeriodoFiltro;
  categorias: Categoria[];
  statuses: StatusFiltro[];
  onChange: (value: PeriodoFiltro) => void;
  onStatusesChange: (value: StatusFiltro[]) => void;
};

export function PeriodFilter({
  value,
  categorias,
  statuses,
  onChange,
  onStatusesChange,
}: PeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [openSections, setOpenSections] = useState({
    periodo: true,
    status: false,
    tipo: false,
    categoria: false,
  });
  const [categoriasExpanded, setCategoriasExpanded] = useState(false);
  const [categoriaBusca, setCategoriaBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const today = new Date();
  const inicio =
    value.tipo === "intervalo" ? value.inicio : toDateInputValue(today);
  const fim = value.tipo === "intervalo" ? value.fim : toDateInputValue(today);
  const tipoTransacao = value.tipoTransacao ?? "todos";
  const categoriaIds = obterCategoriaIds(value);
  const inicioMesAtual = toDateInputValue(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const fimMesAtual = toDateInputValue(
    new Date(today.getFullYear(), today.getMonth() + 1, 0),
  );
  const hasActiveFilters =
    inicio !== inicioMesAtual ||
    fim !== fimMesAtual ||
    tipoTransacao !== "todos" ||
    categoriaIds.length > 0 ||
    statuses.length > 0;
  const categoriasSelecionadas = useMemo(
    () => categorias.filter((categoria) => categoriaIds.includes(categoria.id)),
    [categoriaIds, categorias],
  );
  const categoriasFiltradas = useMemo(() => {
    const termo = normalizeSearch(categoriaBusca);

    if (!termo) {
      return categorias;
    }

    return categorias.filter((categoria) =>
      normalizeSearch(categoria.nome).includes(termo),
    );
  }, [categoriaBusca, categorias]);
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
      categoriaId: categoriaIds[0] ?? null,
      categoriaIds,
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
      categoriaId: categoriaIds[0] ?? null,
      categoriaIds,
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
      categoriaId: categoriaIds[0] ?? null,
      categoriaIds,
    });
  }

  function aplicarTipoTransacao(nextTipoTransacao: TipoTransacaoFiltro) {
    onChange({ ...value, tipoTransacao: nextTipoTransacao });
  }

  function toggleSection(section: keyof typeof openSections) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function alternarCategoria(nextCategoriaId: string) {
    const nextCategoriaIds = categoriaIds.includes(nextCategoriaId)
      ? categoriaIds.filter((id) => id !== nextCategoriaId)
      : [...categoriaIds, nextCategoriaId];

    onChange({
      ...value,
      categoriaId: nextCategoriaIds[0] ?? null,
      categoriaIds: nextCategoriaIds,
    });
  }

  function alternarStatus(nextStatus: Exclude<StatusFiltro, "todos">) {
    const nextStatuses = statuses.includes(nextStatus)
      ? statuses.filter((item) => item !== nextStatus)
      : [...statuses, nextStatus];

    onStatusesChange(nextStatuses);
  }

  function removerCategoria(nextCategoriaId: string) {
    const nextCategoriaIds = categoriaIds.filter((id) => id !== nextCategoriaId);

    onChange({
      ...value,
      categoriaId: nextCategoriaIds[0] ?? null,
      categoriaIds: nextCategoriaIds,
    });
  }

  function removerStatus(nextStatus: StatusFiltro) {
    onStatusesChange(statuses.filter((status) => status !== nextStatus));
  }

  function limparFiltros() {
    setErro(null);
    setIsOpen(false);
    onStatusesChange([]);
    onChange({
      tipo: "intervalo",
      inicio: inicioMesAtual,
      fim: fimMesAtual,
      tipoTransacao: "todos",
      categoriaId: null,
      categoriaIds: [],
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
            <div className="absolute left-0 z-[80] mt-2 w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-[color:var(--app-card-border)] p-4 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      Filtros
                    </p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Refine a visualização do extrato
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <button
                      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--app-card-border)] px-3 py-1.5 text-xs font-bold text-[var(--app-primary)] transition hover:bg-[var(--app-primary-soft)] dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800"
                      type="button"
                      onClick={limparFiltros}
                    >
                      <RotateCcw size={14} />
                      Limpar
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!hasActiveFilters ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      Nenhum filtro extra aplicado
                    </span>
                  ) : (
                    <>
                      {inicio !== inicioMesAtual || fim !== fimMesAtual ? (
                        <FilterChip
                          label={`${formatDisplayDate(inicio)} - ${formatDisplayDate(fim)}`}
                          onRemove={() =>
                            aplicarIntervalo(inicioMesAtual, fimMesAtual)
                          }
                        />
                      ) : null}
                      {statuses.map((status) => (
                        <FilterChip
                          key={status}
                          label={statusLabel(status)}
                          onRemove={() => removerStatus(status)}
                        />
                      ))}
                      {tipoTransacao !== "todos" && (
                        <FilterChip
                          label={tipoTransacaoLabel(tipoTransacao)}
                          onRemove={() => aplicarTipoTransacao("todos")}
                        />
                      )}
                      {categoriasSelecionadas.map((categoria) => (
                        <FilterChip
                          key={categoria.id}
                          label={categoria.nome}
                          color={categoria.corHexa}
                          onRemove={() => removerCategoria(categoria.id)}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="max-h-[min(72vh,620px)] overflow-y-auto p-2">
                <FilterSection
                  title="Período"
                  summary="Atalhos rápidos"
                  isOpen={openSections.periodo}
                  onToggle={() => toggleSection("periodo")}
                >
                  <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
                    {[7, 15, 30].map((dias) => (
                      <button
                        key={dias}
                        className="rounded-xl border border-[color:var(--app-card-border)] px-3 py-2 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        type="button"
                        onClick={() => aplicarAtalho(dias as 7 | 15 | 30)}
                      >
                        {dias} dias
                      </button>
                    ))}
                  </div>
                </FilterSection>

                <FilterSection
                  title="Status"
                  summary={
                    statuses.length > 0
                      ? `${statuses.length} selecionado(s)`
                      : "Todas"
                  }
                  isOpen={openSections.status}
                  onToggle={() => toggleSection("status")}
                >
                  <div className="grid gap-2 sm:grid-cols-3">
                    {STATUS_OPTIONS.map((option) => (
                      <ToggleOption
                        key={option.value}
                        label={option.label}
                        checked={statuses.includes(option.value)}
                        onChange={() => alternarStatus(option.value)}
                      />
                    ))}
                  </div>
                  {statuses.length > 0 && (
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Este filtro considera apenas despesas.
                    </p>
                  )}
                </FilterSection>

                <FilterSection
                  title="Tipo de transação"
                  summary={tipoTransacaoLabel(tipoTransacao)}
                  isOpen={openSections.tipo}
                  onToggle={() => toggleSection("tipo")}
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TIPO_TRANSACAO_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                          tipoTransacao === option.value
                            ? "border-[var(--app-primary)] bg-[var(--app-primary-soft)] text-[var(--app-primary)] dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-200"
                            : "border-[color:var(--app-card-border)] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                        type="button"
                        onClick={() => aplicarTipoTransacao(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </FilterSection>

                <FilterSection
                  title="Categorias"
                  summary={
                    categoriaIds.length > 0
                      ? `${categoriaIds.length} selecionada(s)`
                      : "Todas"
                  }
                  isOpen={openSections.categoria}
                  onToggle={() => toggleSection("categoria")}
                >
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      className="w-full rounded-xl border border-[color:var(--app-card-border)] bg-slate-50 py-2.5 pl-9 pr-9 text-sm font-medium text-slate-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-[var(--app-primary)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={categoriaBusca}
                      placeholder="Buscar categoria..."
                      onChange={(event) => {
                        setCategoriaBusca(event.target.value);
                        setCategoriasExpanded(true);
                      }}
                    />
                    {categoriaBusca && (
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                        type="button"
                        aria-label="Limpar busca"
                        onClick={() => setCategoriaBusca("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  <button
                    className="mt-3 flex w-full items-center justify-between rounded-xl border border-[color:var(--app-card-border)] px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    type="button"
                    onClick={() => setCategoriasExpanded((current) => !current)}
                  >
                    <span>
                      {categoriasExpanded || categoriaBusca
                        ? "Ocultar opções"
                        : "Ver todas as categorias"}
                    </span>
                    {categoriasExpanded || categoriaBusca ? (
                      <ChevronUp size={17} />
                    ) : (
                      <ChevronDown size={17} />
                    )}
                  </button>

                  {(categoriasExpanded || categoriaBusca) && (
                    <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[color:var(--app-card-border)] p-1 dark:border-slate-700">
                      {categoriasFiltradas.length === 0 ? (
                        <p className="px-3 py-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                          Nenhuma categoria encontrada.
                        </p>
                      ) : (
                        categoriasFiltradas.map((categoria) => (
                          <CategoryOption
                            key={categoria.id}
                            categoria={categoria}
                            checked={categoriaIds.includes(categoria.id)}
                            onChange={() => alternarCategoria(categoria.id)}
                          />
                        ))
                      )}
                    </div>
                  )}

                  {categoriaIds.length === 0 && (
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Nenhuma categoria selecionada = todas.
                    </p>
                  )}
                </FilterSection>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[color:var(--app-card-border)] p-3 dark:border-slate-800">
                <button
                  className="rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-bold text-[var(--app-accent-contrast)] transition hover:opacity-90 dark:bg-blue-600 dark:text-white"
                  type="button"
                  onClick={() => setIsOpen(false)}
                >
                  Aplicar
                </button>
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

type FilterChipProps = {
  label: string;
  color?: string;
  onRemove: () => void;
};

function FilterChip({ label, color, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--app-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--app-primary)] dark:bg-blue-500/15 dark:text-blue-200">
      {color && (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="truncate">{label}</span>
      <button
        className="-mr-1 rounded-full p-0.5 transition hover:bg-black/10"
        type="button"
        aria-label={`Remover filtro ${label}`}
        onClick={onRemove}
      >
        <X size={13} />
      </button>
    </span>
  );
}

type FilterSectionProps = {
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function FilterSection({
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: FilterSectionProps) {
  return (
    <section className="rounded-2xl">
      <button
        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span>
          <span className="block text-sm font-black text-slate-900 dark:text-white">
            {title}
          </span>
          <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
            {summary}
          </span>
        </span>
        {isOpen ? (
          <ChevronUp size={18} className="text-slate-400" />
        ) : (
          <ChevronDown size={18} className="text-slate-400" />
        )}
      </button>
      {isOpen && (
        <div className="border-b border-[color:var(--app-card-border)] px-3 pb-4 dark:border-slate-800">
          {children}
        </div>
      )}
    </section>
  );
}

type ToggleOptionProps = {
  label: string;
  checked: boolean;
  onChange: () => void;
};

function ToggleOption({ label, checked, onChange }: ToggleOptionProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${
        checked
          ? "border-[var(--app-primary)] bg-[var(--app-primary-soft)] text-[var(--app-primary)] dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-200"
          : "border-[color:var(--app-card-border)] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
      type="button"
      aria-pressed={checked}
      onClick={onChange}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          checked
            ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-white"
            : "border-slate-300 dark:border-slate-600"
        }`}
      >
        {checked && <Check size={12} />}
      </span>
      {label}
    </button>
  );
}

type CategoryOptionProps = {
  categoria: Categoria;
  checked: boolean;
  onChange: () => void;
};

function CategoryOption({ categoria, checked, onChange }: CategoryOptionProps) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold transition ${
        checked
          ? "bg-[var(--app-primary-soft)] text-[var(--app-primary)] dark:bg-blue-500/15 dark:text-blue-200"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      }`}
      type="button"
      aria-pressed={checked}
      onClick={onChange}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          checked
            ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-white"
            : "border-slate-300 dark:border-slate-600"
        }`}
      >
        {checked && <Check size={12} />}
      </span>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: categoria.corHexa }}
      />
      <span className="min-w-0 truncate">{categoria.nome}</span>
    </button>
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
    <div className="absolute left-0 right-0 z-[90] mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-4 md:right-auto md:w-[360px]">
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
                    ? "bg-[var(--app-primary-soft)] text-[var(--app-primary)] dark:bg-blue-500/15 dark:text-blue-200"
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
          className="rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-bold text-[var(--app-accent-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:text-white"
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

function obterCategoriaIds(value: PeriodoFiltro) {
  return [
    ...new Set([
      ...(value.categoriaIds ?? []),
      ...(value.categoriaId ? [value.categoriaId] : []),
    ]),
  ].filter(Boolean);
}

function statusLabel(status: StatusFiltro) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Todas";
}

function tipoTransacaoLabel(tipoTransacao: TipoTransacaoFiltro) {
  return TIPO_TRANSACAO_OPTIONS.find((option) => option.value === tipoTransacao)
    ?.label ?? "Todos";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
