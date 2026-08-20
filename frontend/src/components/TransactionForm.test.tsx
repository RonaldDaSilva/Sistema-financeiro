import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionForm } from "./TransactionForm";
import type {
  CartaoCreditoOpcao,
  Categoria,
  ContaBancaria,
  ExtratoMensalItem,
} from "../types/finance";

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

const cartoes: CartaoCreditoOpcao[] = [
  {
    id: "cartao-1",
    apelidoCartao: "Cartão principal",
    banco: "Banco",
  },
];

function criarItemExtrato(overrides: Partial<ExtratoMensalItem> = {}): ExtratoMensalItem {
  return {
    id: "tx-1",
    codigoExibicao: 1,
    tipo: "Despesa",
    descricao: "Restaurante",
    valor: 1000,
    dataOcorrencia: "2026-07-29",
    categoriaId: "cat-1",
    categoriaNome: "Alimentação",
    categoriaCorHexa: "#ef4444",
    formaPagamento: "Pix",
    cartaoCreditoId: null,
    contaBancariaId: "conta-1",
    cartaoCreditoApelido: null,
    isFixa: false,
    isPaga: false,
    statusVisual: "Pendente",
    isDividida: false,
    valorTotalOriginal: null,
    percentualDivisao: null,
    divisaoTransacaoId: null,
    statusDivisao: null,
    isProjetada: false,
    origem: "Transacao",
    origemTransacao: "Lancamento",
    compraParceladaId: null,
    numeroParcela: null,
    quantidadeParcelas: null,
    reembolsoDivisaoId: null,
    ...overrides,
  };
}

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
    vi.clearAllMocks();
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
        participantesUsuarios: [
          expect.objectContaining({
            email: "maria@email.com",
            percentual: 40,
            salvarContato: true,
          }),
        ],
        participantesExternos: [],
      }),
    );
  });

  it("seleciona contato recente e cria convite sem exigir o e-mail completo", async () => {
    const user = userEvent.setup();
    const onCreateTransacao = vi.fn().mockResolvedValue({ id: "tx-1" });
    serviceMocks.listarContatosDivisao.mockResolvedValue([
      {
        id: "contato-1",
        usuarioContatoId: "user-2",
        nomeExibicao: "Maria Silva",
        emailMascarado: "ma***@email.com",
        apelido: "Amor",
        ultimoUsoEm: "2026-08-18T12:00:00Z",
        criadoEm: "2026-08-01T12:00:00Z",
        ativo: true,
      },
    ]);

    renderForm({ onCreateTransacao });
    await user.type(screen.getByPlaceholderText("0,00"), "20000");
    await user.type(screen.getByLabelText("Descrição"), "Restaurante");
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.click(await screen.findByRole("button", { name: "Selecionar contato Amor" }));
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(serviceMocks.criarConviteDivisao).toHaveBeenCalled());
    expect(serviceMocks.resolverConvidadoDivisao).not.toHaveBeenCalled();
    expect(serviceMocks.criarConviteDivisao).toHaveBeenCalledWith(
      expect.objectContaining({
        participantesUsuarios: [
          expect.objectContaining({
            contatoId: "contato-1",
            email: null,
          }),
        ],
      }),
    );
  });

  it("encontra contato salvo por nome ou apelido", async () => {
    const user = userEvent.setup();
    serviceMocks.listarContatosDivisao.mockResolvedValue([
      {
        id: "contato-1",
        usuarioContatoId: "user-2",
        nomeExibicao: "Maria Silva",
        emailMascarado: "ma***@email.com",
        apelido: "Amor",
        ultimoUsoEm: "2026-08-18T12:00:00Z",
        criadoEm: "2026-08-01T12:00:00Z",
        ativo: true,
      },
    ]);

    renderForm();
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    const busca = screen.getByPlaceholderText("Buscar contato ou informar e-mail");
    await user.type(busca, "maria");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByRole("button", { name: "Selecionar contato Amor" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(busca).toHaveValue("Amor");
    expect(serviceMocks.resolverConvidadoDivisao).not.toHaveBeenCalled();
  });

  it("envia participante externo no convite vinculado", async () => {
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
    await screen.findByText("Salvar nos meus contatos");
    await user.click(screen.getByLabelText("Existe também uma parte de pessoa externa"));
    await user.clear(screen.getByDisplayValue("0"));
    await user.type(screen.getByLabelText("Percentual da parte externa"), "10");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(serviceMocks.criarConviteDivisao).toHaveBeenCalled());
    expect(serviceMocks.criarConviteDivisao).toHaveBeenCalledWith(
      expect.objectContaining({
        participantesUsuarios: [
          expect.objectContaining({
            email: "maria@email.com",
            percentual: 30,
          }),
        ],
        participantesExternos: [
          {
            percentual: 10,
            nome: null,
          },
        ],
      }),
    );
  });

  it("converte divisão manual existente para vinculada durante edição", async () => {
    const user = userEvent.setup();
    const onUpdateTransacao = vi.fn().mockResolvedValue(undefined);

    renderForm({
      initialTransaction: criarItemExtrato({
        id: "tx-manual-1",
        descricao: "Aluguel",
        valor: 500,
        isDividida: true,
        valorTotalOriginal: 1000,
        percentualDivisao: 50,
      }),
      onUpdateTransacao,
    });

    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.type(
      screen.getByPlaceholderText("Buscar contato ou informar e-mail"),
      "maria@email.com",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText("Salvar nos meus contatos");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => expect(onUpdateTransacao).toHaveBeenCalledWith(
      "tx-manual-1",
      expect.objectContaining({
        valor: 500,
        isDividida: true,
        valorTotalOriginal: 1000,
        percentualDivisao: 50,
      }),
    ));
    expect(serviceMocks.criarConviteDivisao).toHaveBeenCalledWith(
      expect.objectContaining({
        transacaoOrigemId: "tx-manual-1",
        participantesUsuarios: [
          expect.objectContaining({
            email: "maria@email.com",
            percentual: 50,
          }),
        ],
      }),
    );
  });

  it("converte transação não dividida existente para primeira divisão vinculada", async () => {
    const user = userEvent.setup();
    const onUpdateTransacao = vi.fn().mockResolvedValue(undefined);

    renderForm({
      initialTransaction: criarItemExtrato({
        id: "tx-simples-1",
        descricao: "Restaurante",
        valor: 1000,
      }),
      onUpdateTransacao,
    });

    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.clear(screen.getByLabelText("Minha parte"));
    await user.type(screen.getByLabelText("Minha parte"), "60");
    await user.type(
      screen.getByPlaceholderText("Buscar contato ou informar e-mail"),
      "maria@email.com",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText("Salvar nos meus contatos");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => expect(onUpdateTransacao).toHaveBeenCalled());
    expect(onUpdateTransacao).toHaveBeenCalledWith(
      "tx-simples-1",
      expect.objectContaining({
        valor: 600,
        isDividida: true,
        valorTotalOriginal: 1000,
        percentualDivisao: 60,
      }),
    );
    expect(serviceMocks.criarConviteDivisao).toHaveBeenCalledWith(
      expect.objectContaining({
        transacaoOrigemId: "tx-simples-1",
        participantesUsuarios: [
          expect.objectContaining({
            email: "maria@email.com",
            percentual: 40,
          }),
        ],
      }),
    );
  });

  it("mantém divisão manual como manual ao editar percentual", async () => {
    const user = userEvent.setup();
    const onUpdateTransacao = vi.fn().mockResolvedValue(undefined);

    renderForm({
      initialTransaction: criarItemExtrato({
        id: "tx-manual-2",
        valor: 500,
        isDividida: true,
        valorTotalOriginal: 1000,
        percentualDivisao: 50,
      }),
      onUpdateTransacao,
    });

    await user.clear(screen.getByLabelText("Minha parte"));
    await user.type(screen.getByLabelText("Minha parte"), "60");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => expect(onUpdateTransacao).toHaveBeenCalledWith(
      "tx-manual-2",
      expect.objectContaining({
        valor: 600,
        isDividida: true,
        valorTotalOriginal: 1000,
        percentualDivisao: 60,
      }),
    ));
    expect(serviceMocks.criarConviteDivisao).not.toHaveBeenCalled();
  });

  it("bloqueia edição comum quando já existe divisão vinculada", () => {
    const onUpdateTransacao = vi.fn().mockResolvedValue(undefined);

    renderForm({
      initialTransaction: criarItemExtrato({
        id: "tx-vinculada-1",
        valor: 600,
        isDividida: true,
        valorTotalOriginal: 1000,
        percentualDivisao: 60,
        divisaoTransacaoId: "div-1",
        statusDivisao: "Pendente",
      }),
      onUpdateTransacao,
    });

    expect(screen.getByText("Divisão vinculada existente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use alteração da divisão" })).toBeDisabled();
    expect(screen.getByLabelText("Minha parte")).toBeDisabled();
    expect(serviceMocks.criarConviteDivisao).not.toHaveBeenCalled();
  });

  it("converte manual existente para vinculada com parte externa", async () => {
    const user = userEvent.setup();
    const onUpdateTransacao = vi.fn().mockResolvedValue(undefined);

    renderForm({
      initialTransaction: criarItemExtrato({
        id: "tx-manual-externa",
        valor: 600,
        isDividida: true,
        valorTotalOriginal: 1000,
        percentualDivisao: 60,
      }),
      onUpdateTransacao,
    });

    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.type(
      screen.getByPlaceholderText("Buscar contato ou informar e-mail"),
      "maria@email.com",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText("Salvar nos meus contatos");
    await user.click(screen.getByLabelText("Existe também uma parte de pessoa externa"));
    await user.clear(screen.getByDisplayValue("0"));
    await user.type(screen.getByLabelText("Percentual da parte externa"), "10");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => expect(serviceMocks.criarConviteDivisao).toHaveBeenCalled());
    expect(serviceMocks.criarConviteDivisao).toHaveBeenCalledWith(
      expect.objectContaining({
        transacaoOrigemId: "tx-manual-externa",
        participantesUsuarios: [
          expect.objectContaining({
            percentual: 30,
          }),
        ],
        participantesExternos: [
          {
            percentual: 10,
            nome: null,
          },
        ],
      }),
    );
  });

  it("converte compra parcelada existente para divisão vinculada pelo contrato atômico", async () => {
    const user = userEvent.setup();
    const onUpdateCompraParcelada = vi.fn().mockResolvedValue(undefined);

    renderForm({
      initialTransaction: criarItemExtrato({
        id: "tx-parcela-1",
        descricao: "Compra (1/12)",
        valor: 100,
        origem: "CompraParcelada",
        formaPagamento: "Cartão de crédito",
        cartaoCreditoId: "cartao-1",
        compraParceladaId: "compra-1",
        numeroParcela: 1,
        quantidadeParcelas: 12,
      }),
      onUpdateCompraParcelada,
    });

    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.type(
      screen.getByPlaceholderText("Buscar contato ou informar e-mail"),
      "maria@email.com",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText("Salvar nos meus contatos");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));

    expect(serviceMocks.criarConviteDivisao).not.toHaveBeenCalled();
    await waitFor(() => expect(onUpdateCompraParcelada).toHaveBeenCalledTimes(1));
    expect(onUpdateCompraParcelada).toHaveBeenCalledWith(
      "compra-1",
      1,
      expect.any(String),
      expect.objectContaining({
        divisaoVinculada: expect.objectContaining({
          participantesUsuarios: [
            expect.objectContaining({
              email: "maria@email.com",
              percentual: 50,
            }),
          ],
        }),
      }),
    );
  });

  it("cria compra parcelada no cartão com divisão vinculada em uma única requisição", async () => {
    const user = userEvent.setup();
    const onCreateCompraParcelada = vi.fn().mockResolvedValue(undefined);
    renderForm({ onCreateCompraParcelada });

    await user.type(screen.getByPlaceholderText("0,00"), "120000");
    await user.type(screen.getByLabelText("Descrição"), "Notebook");
    await user.click(screen.getByLabelText("Parcelada"));
    await user.selectOptions(screen.getByLabelText("Cartão"), "cartao-1");
    await user.clear(screen.getByLabelText("Parcelas"));
    await user.type(screen.getByLabelText("Parcelas"), "12");
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.type(
      screen.getByPlaceholderText("Buscar contato ou informar e-mail"),
      "maria@email.com",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText("Salvar nos meus contatos");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(onCreateCompraParcelada).toHaveBeenCalledTimes(1));
    expect(onCreateCompraParcelada).toHaveBeenCalledWith(
      expect.objectContaining({
        valorTotal: 600,
        valorTotalOriginal: 1200,
        quantidadeParcelas: 12,
        cartaoCreditoId: "cartao-1",
        divisaoVinculada: expect.objectContaining({
          participantesUsuarios: [
            expect.objectContaining({
              email: "maria@email.com",
              percentual: 50,
            }),
          ],
        }),
      }),
    );
    expect(serviceMocks.criarConviteDivisao).not.toHaveBeenCalled();
  });

  it("mostra fatura total e parte pessoal em compra dividida no cartão", async () => {
    const user = userEvent.setup();

    renderForm();

    await user.type(screen.getByPlaceholderText("0,00"), "20000");
    await user.type(screen.getByLabelText("Descrição"), "Restaurante");
    await user.selectOptions(screen.getByLabelText("Forma de pagamento"), "Cartão de crédito");
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.clear(screen.getByLabelText("Minha parte"));
    await user.type(screen.getByLabelText("Minha parte"), "60");

    expect(screen.getByText("Valor na fatura")).toBeInTheDocument();
    expect(screen.getByText("Seu gasto pessoal")).toBeInTheDocument();
    expect(screen.getByText("Parte de terceiros")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 200,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 120,00").length).toBeGreaterThan(0);
    expect(screen.queryByText("Fatura = R$ 120,00")).not.toBeInTheDocument();
  });

  it("bloqueia soma inválida na divisão vinculada", async () => {
    const user = userEvent.setup();
    const onCreateTransacao = vi.fn().mockResolvedValue({ id: "tx-1" });

    renderForm({ onCreateTransacao });

    await user.type(screen.getByPlaceholderText("0,00"), "20000");
    await user.type(screen.getByLabelText("Descrição"), "Restaurante");
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.clear(screen.getByLabelText("Minha parte"));
    await user.type(screen.getByLabelText("Minha parte"), "95");
    await user.type(
      screen.getByPlaceholderText("Buscar contato ou informar e-mail"),
      "maria@email.com",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText("Salvar nos meus contatos");
    await user.click(screen.getByLabelText("Existe também uma parte de pessoa externa"));
    await user.clear(screen.getByDisplayValue("0"));
    await user.type(screen.getByLabelText("Percentual da parte externa"), "10");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    expect(await screen.findByText("A soma entre você, convidado e parte externa deve fechar em 100%.")).toBeInTheDocument();
    expect(onCreateTransacao).not.toHaveBeenCalled();
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
