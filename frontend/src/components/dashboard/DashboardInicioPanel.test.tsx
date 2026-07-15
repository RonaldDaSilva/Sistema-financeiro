import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardInicioPanel } from "./DashboardInicioPanel";

const mocks = vi.hoisted(() => ({
  dashboard: {
    saldoAtual: 123456789.98,
    livreParaGastar: 987654321.12,
    despesasAPagar: 0,
    receitasRealizadasNoMes: 1000,
    despesasRealizadasNoMes: 200,
    investimentosRealizadosNoMes: 50,
    balancoRealizadoNoMes: 750,
    receitasPendentesNoMes: 300,
    despesasPendentesNoMes: 100,
    saldoPrevistoFimDoMes: 987654521.12,
    proximosLancamentos: [
      {
        id: null,
        descricao: "Despesa futura com descrição muito longa para validar quebra no mobile",
        valor: 123456.78,
        dataOcorrencia: "2026-07-20",
        tipo: "Despesa",
        formaPagamento: "Pix",
        categoriaNome: "Casa",
        grupo: "Próximo",
        tipoOrigem: "Transacao",
        origemId: null,
        competencia: "2026-07",
        cartaoCreditoId: null,
        contaBancariaId: null,
        compraParceladaId: null,
        numeroParcela: null,
        isProjetada: false,
        podeLiquidar: true,
        rotaDestino: "/",
        filtrosDestino: {},
      },
    ],
    insights: ["Atenção: teste de insight responsivo."],
  },
}));

vi.mock("../../hooks/queries/useFinanceQueries", () => ({
  useDashboardInicio: () => ({
    data: mocks.dashboard,
    isLoading: false,
    isError: false,
  }),
}));

describe("DashboardInicioPanel", () => {
  it("renderiza valores grandes sem ocultar informações essenciais", () => {
    render(<DashboardInicioPanel hiddenValues={false} />);

    expect(screen.getByText("Livre para gastar")).toBeInTheDocument();
    expect(screen.getByText("R$ 987.654.321,12")).toBeInTheDocument();
    expect(screen.getByText("Saldo atual")).toBeInTheDocument();
    expect(screen.getByText("R$ 123.456.789,98")).toBeInTheDocument();
    expect(screen.getByText("Balanço realizado do mês")).toBeInTheDocument();
    expect(screen.getByText("Previsto fim do mês")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir despesa futura/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver todos/i })).toBeInTheDocument();
  });

  it("mantém valores ocultos legíveis quando o usuário escolhe ocultar", () => {
    render(<DashboardInicioPanel hiddenValues />);

    expect(screen.getAllByText("R$ •••••").length).toBeGreaterThan(0);
    expect(screen.getByText("Atenção: teste de insight responsivo.")).toBeInTheDocument();
  });
});
