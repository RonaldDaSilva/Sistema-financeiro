import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardInicioPanel } from "./DashboardInicioPanel";

const mocks = vi.hoisted(() => ({
  dashboard: {
    saldoAtual: 123456789.98,
    receitasRealizadasNoPeriodo: 1000,
    despesasRealizadasNoPeriodo: 200,
    investimentosRealizadosNoPeriodo: 50,
    balancoRealizadoNoPeriodo: 750,
    receitasPendentesNoPeriodo: 300,
    despesasPendentesNoPeriodo: 100,
    investimentosPendentesNoPeriodo: 25,
    despesasEmAberto: 125,
    saldoPrevistoFimDoPeriodo: 123456664.98,
    temFiltroAnalitico: false,
    contextoPeriodo: "Atual",
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
    render(<DashboardInicioPanel hiddenValues={false} filters={{}} />);

    expect(screen.getByText("Saldo atual")).toBeInTheDocument();
    expect(screen.getByText("R$ 123.456.789,98")).toBeInTheDocument();
    expect(screen.getByText("Despesas em aberto")).toBeInTheDocument();
    expect(screen.getByText("R$ 125,00")).toBeInTheDocument();
    expect(screen.getByText("Balanço realizado")).toBeInTheDocument();
    expect(screen.getByText("Saldo previsto")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir despesa futura/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver todos/i })).toBeInTheDocument();
  });

  it("mantém valores ocultos legíveis quando o usuário escolhe ocultar", () => {
    render(<DashboardInicioPanel hiddenValues filters={{}} />);

    expect(screen.getAllByText("R$ •••••").length).toBeGreaterThan(0);
    expect(screen.getByText("Atenção: teste de insight responsivo.")).toBeInTheDocument();
  });
});
