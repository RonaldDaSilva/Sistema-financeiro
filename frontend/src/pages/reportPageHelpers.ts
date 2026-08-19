const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function getCurrentMonthValue(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function readReportMonth(searchParams: URLSearchParams, now = new Date()) {
  const value = searchParams.get("mes");
  return value && MONTH_PATTERN.test(value) ? value : getCurrentMonthValue(now);
}

export function buildReportMonthSearchParams(monthValue: string) {
  const params = new URLSearchParams();
  if (MONTH_PATTERN.test(monthValue)) {
    params.set("mes", monthValue);
  }
  return params;
}

export function shiftReportMonth(monthValue: string, amount: number) {
  const { mes, ano } = parseReportMonth(monthValue);
  const shifted = new Date(ano, mes - 1 + amount, 1);
  return getCurrentMonthValue(shifted);
}

export function parseReportMonth(monthValue: string) {
  const safeValue = MONTH_PATTERN.test(monthValue) ? monthValue : getCurrentMonthValue();
  const [ano, mes] = safeValue.split("-").map(Number);
  return { mes, ano };
}

export function formatReportMonth(monthValue: string, short = false) {
  const { mes, ano } = parseReportMonth(monthValue);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
  }).format(new Date(ano, mes - 1, 1));

  return formatted.charAt(0).toUpperCase() + formatted.slice(1).replace(" de ", " de ");
}

export function monthDateRange(monthValue: string) {
  const { mes, ano } = parseReportMonth(monthValue);
  const lastDay = new Date(ano, mes, 0).getDate();
  const month = String(mes).padStart(2, "0");
  return {
    inicio: `${ano}-${month}-01`,
    fim: `${ano}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}
