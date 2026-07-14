import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";
import { CardsPage } from "./CardsPage";
import type { CartaoCredito } from "../types/finance";

const mocks = vi.hoisted(() => ({
  cartoes: [] as CartaoCredito[],
  arquivarCartaoCredito: vi.fn(),
}));

vi.mock("../components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/ConfirmDialog", () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn(async () => true),
    dialog: null,
  }),
}));

vi.mock("../hooks/queries/useFinanceQueries", () => ({
  useCartoes: () => ({
    data: mocks.cartoes,
    isLoading: false,
    isError: false,
  }),
  useContas: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useFaturaMes: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../services/financeService", () => ({
  arquivarCartaoCredito: mocks.arquivarCartaoCredito,
  alternarStatusFatura: vi.fn(),
  atualizarCartaoCredito: vi.fn(),
  criarCartaoCredito: vi.fn(),
}));

describe("CardsPage", () => {
  beforeEach(() => {
    mocks.cartoes = [];
    mocks.arquivarCartaoCredito.mockReset();
  });

  it("renderiza cartão sem fatura com status e datas semânticas", () => {
    mocks.cartoes = [criarCartao({ statusFaturaAtual: "SemFatura" })];

    renderWithClient(<CardsPage />);

    expect(screen.getByText("Sem fatura")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma fatura nesta competência")).toBeInTheDocument();
    expect(screen.getByText("Sem fechamento nesta competência")).toBeInTheDocument();
    expect(screen.getByText("Sem vencimento nesta competência")).toBeInTheDocument();
  });

  it("mostra a decomposição auditável do limite utilizado", () => {
    mocks.cartoes = [
      criarCartao({
        valorFaturaAtual: 100,
        valorFaturasFechadasNaoPagas: 50,
        valorProximasFaturas: 70,
        quantidadeParcelasFuturas: 3,
        valorParcelasFuturas: 300,
        valorUtilizado: 520,
        limiteDisponivel: 480,
      }),
    ];

    renderWithClient(<CardsPage />);

    expect(screen.getByText("Composição do limite")).toBeInTheDocument();
    expect(screen.getByText("Faturas fechadas não pagas")).toBeInTheDocument();
    expect(screen.getByText("Fatura atual no limite")).toBeInTheDocument();
    expect(screen.getByText("Próximas faturas")).toBeInTheDocument();
    expect(screen.getByText("Parcelas futuras (3)")).toBeInTheDocument();
    expect(screen.getByText("Total: R$ 520,00")).toBeInTheDocument();
  });

  it("usa ação de arquivamento com confirmação e sem ícone de exclusão", async () => {
    const user = userEvent.setup();
    mocks.cartoes = [criarCartao()];

    renderWithClient(<CardsPage />);

    await user.click(screen.getByRole("button", { name: /arquivar cartão cartão teste/i }));

    expect(mocks.arquivarCartaoCredito).toHaveBeenCalledWith("cartao-1");
  });
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}

function criarCartao(overrides: Partial<CartaoCredito> = {}): CartaoCredito {
  return {
    id: "cartao-1",
    usuarioId: "usuario-1",
    apelidoCartao: "Cartão Teste",
    banco: "Banco Teste",
    diaVencimento: 20,
    melhorDiaCompra: 10,
    limiteTotal: 1000,
    contaBancariaId: null,
    contaBancariaNome: null,
    isArquivado: false,
    valorFaturaAtual: 0,
    valorFaturasFechadasNaoPagas: 0,
    valorProximasFaturas: 0,
    quantidadeParcelasFuturas: 0,
    valorParcelasFuturas: 0,
    valorOutrosCompromissos: 0,
    valorUtilizado: 0,
    limiteDisponivel: 1000,
    percentualUtilizado: 0,
    faturaAtual: 0,
    statusFaturaAtual: "SemFatura",
    dataFechamentoAtual: null,
    dataVencimentoAtual: null,
    diasParaFechamento: null,
    diasParaVencimento: null,
    comprasParceladasFuturas: 0,
    limiteComprometidoFuturo: 0,
    proximaFaturaValor: 0,
    proximaFaturaVencimento: null,
    ...overrides,
  };
}
