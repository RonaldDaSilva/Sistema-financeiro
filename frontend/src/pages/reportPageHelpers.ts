import type { TipoTransacaoFiltro } from "../types/finance";
import { formatDate } from "../utils/date";

export type StatusRelatorio = "todos" | "realizado" | "pendente";

export type ReportFilters = {
  inicioMes: string;
  fimMes: string;
  contaBancariaId: string;
  cartaoCreditoId: string;
  categoriaIds: string[];
  tipoTransacao: TipoTransacaoFiltro;
  status: StatusRelatorio;
  somenteRecorrentes: boolean;
  somenteParceladas: boolean;
};

export type NegativeRange = {
  start: string;
  end: string;
};

const hoje = new Date();
const defaultInicioMes = `${hoje.getFullYear()}-01`;
const defaultFimMes = toMonthInput(hoje);

export function readReportFilters(searchParams: URLSearchParams): ReportFilters {
  return {
    inicioMes: parseMonthParam(searchParams.get("dataInicial")) ?? defaultInicioMes,
    fimMes: parseMonthParam(searchParams.get("dataFinal")) ?? defaultFimMes,
    contaBancariaId: searchParams.get("conta") ?? "",
    cartaoCreditoId: searchParams.get("cartao") ?? "",
    categoriaIds: parseListParam(searchParams, "categorias"),
    tipoTransacao: parseTipoTransacao(searchParams.get("tipo")),
    status: parseStatusRelatorio(searchParams.get("status")),
    somenteRecorrentes: searchParams.get("recorrentes") === "true",
    somenteParceladas: searchParams.get("parceladas") === "true",
  };
}

export function buildReportSearchParams(filters: ReportFilters) {
  const params = new URLSearchParams();
  params.set("dataInicial", filters.inicioMes);
  params.set("dataFinal", filters.fimMes);
  if (filters.contaBancariaId) params.set("conta", filters.contaBancariaId);
  if (filters.cartaoCreditoId) params.set("cartao", filters.cartaoCreditoId);
  if (filters.categoriaIds.length > 0) {
    params.set("categorias", [...new Set(filters.categoriaIds)].sort().join(","));
  }
  if (filters.tipoTransacao !== "todos") params.set("tipo", filters.tipoTransacao);
  if (filters.status !== "todos") params.set("status", filters.status);
  if (filters.somenteRecorrentes) params.set("recorrentes", "true");
  if (filters.somenteParceladas) params.set("parceladas", "true");
  return params;
}

export function getNegativeRanges(
  items: Array<{ dataReferencia: string; saldoAcumulado: number }>,
): NegativeRange[] {
  const ranges: NegativeRange[] = [];
  let current: NegativeRange | null = null;

  for (const item of items) {
    if (item.saldoAcumulado < 0) {
      current ??= { start: item.dataReferencia, end: item.dataReferencia };
      current.end = item.dataReferencia;
      continue;
    }

    if (current) {
      ranges.push(current);
      current = null;
    }
  }

  if (current) {
    ranges.push(current);
  }

  return ranges;
}

export function formatNegativeRanges(ranges: NegativeRange[]) {
  return ranges
    .slice(0, 3)
    .map((range) =>
      range.start === range.end
        ? formatDate(range.start)
        : `${formatDate(range.start)} a ${formatDate(range.end)}`,
    )
    .join("; ");
}

export function normalizarPeriodo(inicio: string, fim: string) {
  const [inicioAno, inicioMesNumero] = inicio.split("-").map(Number);
  const [fimAno, fimMesNumero] = fim.split("-").map(Number);
  let inicioDate = new Date(inicioAno, inicioMesNumero - 1, 1);
  let fimDate = new Date(fimAno, fimMesNumero, 0);

  if (Number.isNaN(inicioDate.getTime())) {
    inicioDate = new Date(hoje.getFullYear(), 0, 1);
  }

  if (Number.isNaN(fimDate.getTime())) {
    fimDate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  }

  if (inicioDate > fimDate) {
    inicioDate = new Date(fimDate.getFullYear(), fimDate.getMonth(), 1);
  }
  const meses =
    (fimDate.getFullYear() - inicioDate.getFullYear()) * 12 +
    fimDate.getMonth() -
    inicioDate.getMonth() +
    1;

  if (meses > 12) {
    const novoInicio = new Date(fimDate.getFullYear(), fimDate.getMonth() - 11, 1);
    return {
      dataInicial: toDateOnly(novoInicio),
      dataFinal: toDateOnly(fimDate),
    };
  }

  return {
    dataInicial: toDateOnly(inicioDate),
    dataFinal: toDateOnly(fimDate),
  };
}

function toMonthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseMonthParam(value: string | null) {
  if (!value) {
    return null;
  }

  const monthValue = value.length >= 7 ? value.slice(0, 7) : value;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(monthValue) ? monthValue : null;
}

function parseListParam(searchParams: URLSearchParams, key: string) {
  return [
    ...searchParams.getAll(key),
    ...(searchParams.get("categoria") ? [searchParams.get("categoria")!] : []),
  ]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseTipoTransacao(value: string | null): TipoTransacaoFiltro {
  return value === "receita" || value === "despesa" || value === "investimento"
    ? value
    : "todos";
}

function parseStatusRelatorio(value: string | null): StatusRelatorio {
  return value === "realizado" || value === "pendente" ? value : "todos";
}
