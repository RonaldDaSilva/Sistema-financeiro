import { describe, expect, it } from "vitest";
import {
  buildReportMonthSearchParams,
  formatReportMonth,
  monthDateRange,
  parseReportMonth,
  readReportMonth,
  shiftReportMonth,
} from "./reportPageHelpers";

describe("ReportsPage month helpers", () => {
  it("seleciona o mês atual quando a URL não informa uma competência", () => {
    expect(readReportMonth(new URLSearchParams(), new Date(2026, 7, 18))).toBe("2026-08");
  });

  it("lê e persiste somente uma competência válida", () => {
    expect(readReportMonth(new URLSearchParams("mes=2026-07"))).toBe("2026-07");
    expect(buildReportMonthSearchParams("2026-07").toString()).toBe("mes=2026-07");
    expect(buildReportMonthSearchParams("2026-13").toString()).toBe("");
  });

  it("navega entre meses atravessando o ano", () => {
    expect(shiftReportMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftReportMonth("2026-12", 1)).toBe("2027-01");
  });

  it("expõe mês, ano, rótulo e intervalo completos", () => {
    expect(parseReportMonth("2026-08")).toEqual({ mes: 8, ano: 2026 });
    expect(formatReportMonth("2026-08")).toBe("Agosto de 2026");
    expect(monthDateRange("2024-02")).toEqual({
      inicio: "2024-02-01",
      fim: "2024-02-29",
    });
  });
});
