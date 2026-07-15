import { describe, expect, it } from "vitest";
import {
  buildReportSearchParams,
  formatNegativeRanges,
  getNegativeRanges,
  normalizarPeriodo,
  readReportFilters,
  type ReportFilters,
} from "./reportPageHelpers";

describe("ReportsPage filter helpers", () => {
  it("inicializa filtros pela URL com múltiplas categorias", () => {
    const params = new URLSearchParams(
      "dataInicial=2026-01&dataFinal=2026-06&conta=conta-1&cartao=cartao-1&categorias=c2,c1&tipo=despesa&status=pendente&recorrentes=true&parceladas=true",
    );

    const filters = readReportFilters(params);

    expect(filters).toMatchObject({
      inicioMes: "2026-01",
      fimMes: "2026-06",
      contaBancariaId: "conta-1",
      cartaoCreditoId: "cartao-1",
      categoriaIds: ["c2", "c1"],
      tipoTransacao: "despesa",
      status: "pendente",
      somenteRecorrentes: true,
      somenteParceladas: true,
    });
  });

  it("remove parâmetros vazios e ordena categorias ao montar a URL", () => {
    const filters: ReportFilters = {
      inicioMes: "2026-01",
      fimMes: "2026-06",
      contaBancariaId: "",
      cartaoCreditoId: "",
      categoriaIds: ["b", "a", "a"],
      tipoTransacao: "todos",
      status: "todos",
      somenteRecorrentes: false,
      somenteParceladas: false,
    };

    const params = buildReportSearchParams(filters);

    expect(params.get("dataInicial")).toBe("2026-01");
    expect(params.get("dataFinal")).toBe("2026-06");
    expect(params.get("categorias")).toBe("a,b");
    expect(params.has("conta")).toBe(false);
    expect(params.has("cartao")).toBe(false);
    expect(params.has("tipo")).toBe(false);
    expect(params.has("status")).toBe(false);
  });

  it("ignora parâmetros inválidos e limita o período a no máximo 12 meses", () => {
    const filters = readReportFilters(
      new URLSearchParams("dataInicial=2026-99&dataFinal=2026-13&tipo=erro&status=erro"),
    );
    const periodo = normalizarPeriodo("2025-01", "2026-12");

    expect(filters.tipoTransacao).toBe("todos");
    expect(filters.status).toBe("todos");
    expect(periodo).toEqual({
      dataInicial: "2026-01-01",
      dataFinal: "2026-12-31",
    });
  });
});

describe("ReportsPage chart helpers", () => {
  it("não retorna intervalos para série sem saldo negativo", () => {
    expect(
      getNegativeRanges([
        { dataReferencia: "2026-01-01", saldoAcumulado: 0 },
        { dataReferencia: "2026-01-02", saldoAcumulado: 10 },
      ]),
    ).toEqual([]);
  });

  it("identifica um ponto negativo", () => {
    expect(
      getNegativeRanges([
        { dataReferencia: "2026-01-01", saldoAcumulado: 5 },
        { dataReferencia: "2026-01-02", saldoAcumulado: -1 },
        { dataReferencia: "2026-01-03", saldoAcumulado: 1 },
      ]),
    ).toEqual([{ start: "2026-01-02", end: "2026-01-02" }]);
  });

  it("identifica múltiplos intervalos negativos e formata alerta textual", () => {
    const ranges = getNegativeRanges([
      { dataReferencia: "2026-01-01", saldoAcumulado: -1 },
      { dataReferencia: "2026-01-02", saldoAcumulado: -2 },
      { dataReferencia: "2026-01-03", saldoAcumulado: 1 },
      { dataReferencia: "2026-01-04", saldoAcumulado: -1 },
    ]);

    expect(ranges).toEqual([
      { start: "2026-01-01", end: "2026-01-02" },
      { start: "2026-01-04", end: "2026-01-04" },
    ]);
    expect(formatNegativeRanges(ranges)).toContain("01/01/2026");
    expect(formatNegativeRanges(ranges)).toContain("04/01/2026");
  });
});
