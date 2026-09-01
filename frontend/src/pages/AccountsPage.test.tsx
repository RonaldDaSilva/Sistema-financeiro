import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountsPage } from "./AccountsPage";

const serviceMocks = vi.hoisted(() => ({
  transferirEntreContas: vi.fn(),
}));

vi.mock("../services/financeService", () => serviceMocks);
vi.mock("../components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../hooks/queries/useFinanceQueries", () => ({
  useContas: () => ({
    data: [
      { id: "conta-1", nomeCustomizado: "Origem", codigoBanco: "001", saldoInicial: 1000, isFavorita: true, isArquivada: false, permiteEditarSaldoInicial: false, dataCriacao: "2026-08-01" },
      { id: "conta-2", nomeCustomizado: "Destino", codigoBanco: "033", saldoInicial: 100, isFavorita: false, isArquivada: false, permiteEditarSaldoInicial: false, dataCriacao: "2026-08-01" },
    ],
    isLoading: false,
    isError: false,
  }),
  useDistribuicaoContas: () => ({
    data: [
      { id: "conta-1", nomeCustomizado: "Origem", codigoBanco: "001", saldoAtual: 1000 },
      { id: "conta-2", nomeCustomizado: "Destino", codigoBanco: "033", saldoAtual: 100 },
    ],
    isLoading: false,
    isError: false,
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountsPage />
    </QueryClientProvider>,
  );
}

describe("AccountsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.transferirEntreContas.mockResolvedValue({ transferenciaId: "transferencia-1" });
  });

  it("troca origem e destino sem permitir que sejam a mesma conta", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Transferir" }));

    const origem = screen.getByLabelText("Conta de origem");
    const destino = screen.getByLabelText("Conta de destino");
    expect(origem).toHaveValue("conta-1");
    expect(destino).toHaveValue("conta-2");

    await user.selectOptions(origem, "conta-2");

    expect(origem).toHaveValue("conta-2");
    expect(destino).toHaveValue("conta-1");
  });

  it("mostra a mensagem do backend quando o saldo e insuficiente", async () => {
    const user = userEvent.setup();
    serviceMocks.transferirEntreContas.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          erro: "SALDO_INSUFICIENTE",
          mensagem: "A conta de origem não possui saldo suficiente para esta transferência.",
        },
      },
    });
    renderPage();

    await user.click(screen.getByRole("button", { name: "Transferir" }));
    await user.type(screen.getByPlaceholderText("R$ 0,00"), "200000");
    await user.click(screen.getAllByRole("button", { name: "Transferir" }).at(-1)!);

    await waitFor(() => expect(screen.getByText(
      "A conta de origem não possui saldo suficiente para esta transferência.",
    )).toBeInTheDocument());
  });
});
