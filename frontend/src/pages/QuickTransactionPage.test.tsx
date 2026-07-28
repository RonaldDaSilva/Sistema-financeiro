import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickTransactionPage } from "./QuickTransactionPage";

const mocks = vi.hoisted(() => ({
  criarTransacao: vi.fn(),
  criarCompraParcelada: vi.fn(),
  listarContatosDivisao: vi.fn(),
  listarReembolsosPendentes: vi.fn(),
  resolverConvidadoDivisao: vi.fn(),
  criarConviteDivisao: vi.fn(),
  useCartoesOpcoes: vi.fn(),
}));

vi.mock("../services/financeService", () => ({
  criarTransacao: mocks.criarTransacao,
  criarCompraParcelada: mocks.criarCompraParcelada,
  listarContatosDivisao: mocks.listarContatosDivisao,
  listarReembolsosPendentes: mocks.listarReembolsosPendentes,
  resolverConvidadoDivisao: mocks.resolverConvidadoDivisao,
  criarConviteDivisao: mocks.criarConviteDivisao,
}));

vi.mock("../hooks/queries/useFinanceQueries", () => ({
  useCategorias: () => ({
    data: [
      {
        id: "cat-1",
        usuarioId: "user-1",
        nome: "Casa",
        corHexa: "#2563eb",
        isDefault: false,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useContas: () => ({
    data: [
      {
        id: "conta-1",
        nomeCustomizado: "Conta principal",
        codigoBanco: "001",
        saldoInicial: 0,
        isFavorita: true,
        isArquivada: false,
        permiteEditarSaldoInicial: false,
        dataCriacao: "2026-01-01",
      },
    ],
    isLoading: false,
    error: null,
  }),
  useCartoesOpcoes: mocks.useCartoesOpcoes,
}));

vi.mock("../hooks/queries/useNotificationQueries", () => ({
  useConfiguracoesNotificacao: () => ({
    data: { percentualPadraoDivisao: 50 },
    isLoading: false,
    error: null,
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/transacoes/nova?origem=atalho"]}>
        <QuickTransactionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("QuickTransactionPage", () => {
  beforeEach(() => {
    mocks.listarContatosDivisao.mockResolvedValue([]);
    mocks.listarReembolsosPendentes.mockResolvedValue([]);
    mocks.resolverConvidadoDivisao.mockResolvedValue({
      encontrado: true,
      nomeExibicao: "Maria",
      emailMascarado: "ma***@email.com",
      identificador: "user-2",
    });
    mocks.criarConviteDivisao.mockResolvedValue({ id: "div-1" });
    mocks.criarTransacao.mockReset();
    mocks.criarCompraParcelada.mockReset();
  });

  it("renderiza o layout mínimo sem elementos da Dashboard", () => {
    mocks.useCartoesOpcoes.mockReturnValue({ data: [], isLoading: false, error: null });

    renderPage();

    expect(screen.getByRole("heading", { name: "Nova transação" })).toBeInTheDocument();
    expect(screen.getByText("Atalho iOS")).toBeInTheDocument();
    expect(screen.queryByText("Movimentações recentes")).not.toBeInTheDocument();
    expect(screen.queryByText("Insights automáticos")).not.toBeInTheDocument();
  });

  it("salva e oferece ações rápidas de continuação", async () => {
    const user = userEvent.setup();
    mocks.criarTransacao.mockResolvedValue({ id: "tx-1" });
    mocks.useCartoesOpcoes.mockReturnValue({ data: [], isLoading: false, error: null });

    renderPage();

    await user.click(screen.getByRole("button", { name: "Receita" }));
    await user.type(screen.getByPlaceholderText("0,00"), "5000");
    await user.type(screen.getByLabelText("Descrição"), "Freela");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(mocks.criarTransacao).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Transação salva")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar outra/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver no extrato/i })).toBeInTheDocument();
  });

  it("não carrega cartões antes de serem necessários", async () => {
    const user = userEvent.setup();
    mocks.useCartoesOpcoes.mockReturnValue({ data: [], isLoading: false, error: null });

    renderPage();

    expect(mocks.useCartoesOpcoes).toHaveBeenCalledWith(false);

    await user.selectOptions(screen.getByLabelText("Forma de pagamento"), "Cartão de crédito");

    await waitFor(() => expect(mocks.useCartoesOpcoes).toHaveBeenCalledWith(true));
  });
});
