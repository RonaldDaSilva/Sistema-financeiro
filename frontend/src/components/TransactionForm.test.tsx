import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionForm } from "./TransactionForm";
import type { CartaoCredito, Categoria, ContaBancaria } from "../types/finance";

const serviceMocks = vi.hoisted(() => ({
  listarContatosDivisao: vi.fn(),
  listarReembolsosPendentes: vi.fn(),
  resolverConvidadoDivisao: vi.fn(),
  criarConviteDivisao: vi.fn(),
}));

vi.mock("../services/financeService", () => serviceMocks);

const categorias: Categoria[] = [
  {
    id: "cat-1",
    usuarioId: "user-1",
    nome: "Alimentação",
    corHexa: "#ef4444",
    isDefault: false,
  },
];

const contas: ContaBancaria[] = [
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
];

const cartoes: CartaoCredito[] = [
  {
    id: "cartao-1",
    usuarioId: "user-1",
    apelidoCartao: "Cartão principal",
    banco: "Banco",
    diaVencimento: 10,
    melhorDiaCompra: 1,
    limiteTotal: 1000,
    contaBancariaId: "conta-1",
    contaBancariaNome: "Conta principal",
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
  },
];

function renderForm(overrides = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TransactionForm
        variant="page"
        categorias={categorias}
        cartoes={cartoes}
        contas={contas}
        percentualPadraoDivisao={50}
        onCancel={vi.fn()}
        onCreateTransacao={vi.fn().mockResolvedValue(undefined)}
        onCreateCompraParcelada={vi.fn().mockResolvedValue(undefined)}
        {...overrides}
      />
    </QueryClientProvider>,
  );
}

describe("TransactionForm", () => {
  beforeEach(() => {
    serviceMocks.listarContatosDivisao.mockResolvedValue([]);
    serviceMocks.listarReembolsosPendentes.mockResolvedValue([]);
    serviceMocks.resolverConvidadoDivisao.mockResolvedValue({
      encontrado: true,
      nomeExibicao: "Maria",
      emailMascarado: "ma***@email.com",
      identificador: "user-2",
    });
    serviceMocks.criarConviteDivisao.mockResolvedValue({ id: "div-1" });
  });

  it("cria receita usando a mesma transformação de request do modal", async () => {
    const user = userEvent.setup();
    const onCreateTransacao = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi.fn();

    renderForm({ onCreateTransacao, onSaved });

    await user.click(screen.getByRole("button", { name: "Receita" }));
    await user.type(screen.getByPlaceholderText("0,00"), "120050");
    await user.type(screen.getByLabelText("Descrição"), "Salário");
    await user.selectOptions(screen.getByLabelText("Creditar na Conta"), "conta-1");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(onCreateTransacao).toHaveBeenCalledTimes(1));
    expect(onCreateTransacao).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 1,
        descricao: "Salário",
        valor: 1200.5,
        categoriaId: null,
        contaBancariaId: "conta-1",
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "receita",
        descricao: "Salário",
        valor: 1200.5,
      }),
    );
  });

  it("sinaliza que cartões são necessários somente ao selecionar cartão", async () => {
    const user = userEvent.setup();
    const onCartaoNecessarioChange = vi.fn();

    renderForm({ onCartaoNecessarioChange });

    expect(onCartaoNecessarioChange).toHaveBeenLastCalledWith(false);

    await user.selectOptions(screen.getByLabelText("Forma de pagamento"), "Cartão de crédito");

    expect(onCartaoNecessarioChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByLabelText("Cartão")).toBeInTheDocument();
  });

  it("mantém a divisão manual antiga com percentual e valor original", async () => {
    const user = userEvent.setup();
    const onCreateTransacao = vi.fn().mockResolvedValue({ id: "tx-1" });

    renderForm({ onCreateTransacao });

    await user.type(screen.getByPlaceholderText("0,00"), "20000");
    await user.type(screen.getByLabelText("Descrição"), "Restaurante");
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.clear(screen.getByLabelText("Minha parte"));
    await user.type(screen.getByLabelText("Minha parte"), "60");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(onCreateTransacao).toHaveBeenCalledTimes(1));
    expect(onCreateTransacao).toHaveBeenCalledWith(
      expect.objectContaining({
        valor: 120,
        isDividida: true,
        valorTotalOriginal: 200,
        percentualDivisao: 60,
      }),
    );
    expect(serviceMocks.criarConviteDivisao).not.toHaveBeenCalled();
  });

  it("busca convidado e cria convite para divisão vinculada", async () => {
    const user = userEvent.setup();
    const onCreateTransacao = vi.fn().mockResolvedValue({ id: "tx-1" });

    renderForm({ onCreateTransacao });

    await user.type(screen.getByPlaceholderText("0,00"), "20000");
    await user.type(screen.getByLabelText("Descrição"), "Restaurante");
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.clear(screen.getByLabelText("Minha parte"));
    await user.type(screen.getByLabelText("Minha parte"), "60");
    await user.type(
      screen.getByPlaceholderText("Buscar contato ou informar e-mail"),
      "maria@email.com",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect((await screen.findAllByText("Maria")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(serviceMocks.criarConviteDivisao).toHaveBeenCalled());
    expect(serviceMocks.criarConviteDivisao).toHaveBeenCalledWith(
      expect.objectContaining({
        transacaoOrigemId: "tx-1",
        emailConvidado: "maria@email.com",
        percentualConvidado: 40,
        salvarContato: true,
      }),
    );
  });

  it("vincula receita a reembolso pendente", async () => {
    const user = userEvent.setup();
    const onCreateTransacao = vi.fn().mockResolvedValue({ id: "tx-1" });
    serviceMocks.listarReembolsosPendentes.mockResolvedValue([
      {
        id: "reembolso-1",
        divisaoTransacaoId: "div-1",
        participanteId: "part-1",
        participanteUsuarioId: "user-2",
        participanteExternoNome: "Maria",
        valorDevido: 80,
        valorRecebido: 30,
        saldoPendente: 50,
        status: "Parcial",
      },
    ]);

    renderForm({ onCreateTransacao });

    await user.click(screen.getByRole("button", { name: "Receita" }));
    await screen.findByText("Vincular a um reembolso");
    await user.click(screen.getByLabelText("Vincular a um reembolso"));
    await user.selectOptions(screen.getByLabelText("Reembolso"), "reembolso-1");
    await user.type(screen.getByLabelText("Descrição"), " recebido");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(onCreateTransacao).toHaveBeenCalledTimes(1));
    expect(onCreateTransacao).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 1,
        reembolsoDivisaoId: "reembolso-1",
      }),
    );
  });
});
