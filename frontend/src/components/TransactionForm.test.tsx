import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionForm } from "./TransactionForm";
import { AuthContext } from "../contexts/authContextCore";
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
  obterDivisaoTransacao: vi.fn(),
  proporAlteracaoDivisao: vi.fn(),
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

function renderForm(
  overrides = {},
  authUser = { id: "user-1", nome: "Usuário", email: "user@email.com" },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <AuthContext.Provider value={{
      user: authUser,
      session: null,
      isAuthenticated: true,
      isAuthRestoring: false,
      login: vi.fn(),
      register: vi.fn(),
      updateUser: vi.fn(),
      logout: vi.fn(),
    }}>
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
      </QueryClientProvider>
    </AuthContext.Provider>,
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
    serviceMocks.proporAlteracaoDivisao.mockResolvedValue({ id: "div-1" });
    serviceMocks.obterDivisaoTransacao.mockResolvedValue({
      id: "div-1",
      usuarioCriadorId: "user-1",
      transacaoOrigemId: "tx-vinculada-1",
      compraParceladaId: null,
      descricaoOrigem: "Restaurante",
      valorTotal: 1000,
      status: "Pendente",
      versaoAtual: 1,
      quantidadeReenvios: 0,
      criadoEm: "2026-08-01T00:00:00Z",
      atualizadoEm: "2026-08-01T00:00:00Z",
      participantes: [
        { id: "criador-1", participanteUsuarioId: "user-1", nomeExibicao: "Usuário", tipoParticipante: "Criador", percentual: 60, valor: 600, status: "Aceito", versaoConvite: 1, expiraEm: null, transacaoGeradaId: null, ativo: true },
        { id: "part-1", participanteUsuarioId: "user-2", nomeExibicao: "Maria", tipoParticipante: "UsuarioSistema", percentual: 40, valor: 400, status: "Pendente", versaoConvite: 1, expiraEm: null, transacaoGeradaId: null, ativo: true },
      ],
      versoes: [],
    });
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

    expect((await screen.findAllByText("Amor")).length).toBeGreaterThan(0);
    expect(busca).toHaveValue("");
    expect(screen.getByLabelText("Percentual de Amor")).toBeInTheDocument();
    expect(serviceMocks.resolverConvidadoDivisao).not.toHaveBeenCalled();
  });

  it("envia contato salvo e participante externo no convite vinculado", async () => {
    const user = userEvent.setup();
    const onCreateTransacao = vi.fn().mockResolvedValue({ id: "tx-1" });
    serviceMocks.listarContatosDivisao.mockResolvedValue([
      {
        id: "contato-1",
        usuarioContatoId: "user-2",
        nomeExibicao: "Maria",
        emailMascarado: "ma***@email.com",
        apelido: "Amor",
        ultimoUsoEm: "2026-08-28T00:00:00Z",
        criadoEm: "2026-08-01T00:00:00Z",
        ativo: true,
      },
    ]);

    renderForm({ onCreateTransacao });

    await user.type(screen.getByPlaceholderText("0,00"), "20000");
    await user.type(screen.getByLabelText("Descrição"), "Restaurante");
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.clear(screen.getByLabelText("Minha parte"));
    await user.type(screen.getByLabelText("Minha parte"), "60");
    await user.click(await screen.findByRole("button", { name: "Selecionar contato Amor" }));
    await user.clear(screen.getByLabelText("Percentual de Amor"));
    await user.type(screen.getByLabelText("Percentual de Amor"), "30");
    await user.click(screen.getByRole("button", { name: "Pessoa externa" }));
    await user.clear(screen.getByLabelText("Percentual da pessoa externa 1"));
    await user.type(screen.getByLabelText("Percentual da pessoa externa 1"), "10");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(serviceMocks.criarConviteDivisao).toHaveBeenCalled());
    expect(serviceMocks.criarConviteDivisao).toHaveBeenCalledWith(
      expect.objectContaining({
        participantesUsuarios: [
          expect.objectContaining({
            contatoId: "contato-1",
            email: null,
            percentual: 30,
          }),
        ],
        participantesExternos: [
          {
            modoDefinicao: 1,
            percentual: 10,
            valor: null,
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

  it("envia alteração econômica existente como proposta", async () => {
    const user = userEvent.setup();
    const onUpdateTransacao = vi.fn().mockResolvedValue(undefined);
    serviceMocks.obterDivisaoTransacao.mockResolvedValue({
      ...await serviceMocks.obterDivisaoTransacao(),
      status: "Aceita",
    });

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

    expect(await screen.findByText("Divisão vinculada existente")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Enviar proposta" }, { timeout: 3000 })).toBeEnabled();
    expect(screen.getByLabelText("Minha parte")).toBeEnabled();
    await user.clear(screen.getByLabelText("Minha parte"));
    await user.type(screen.getByLabelText("Minha parte"), "55");
    await user.clear(screen.getByLabelText("Percentual de Maria"));
    await user.type(screen.getByLabelText("Percentual de Maria"), "45");
    await user.click(screen.getByRole("button", { name: "Enviar proposta" }));
    await waitFor(() => expect(serviceMocks.proporAlteracaoDivisao).toHaveBeenCalledWith(
      "div-1",
      expect.objectContaining({
        participantes: [{ participanteId: "part-1", percentual: 45 }],
      }),
    ));
    expect(serviceMocks.criarConviteDivisao).not.toHaveBeenCalled();
  });

  it("salva edição local do criador sem criar proposta econômica", async () => {
    const user = userEvent.setup();
    const onUpdateTransacao = vi.fn().mockResolvedValue(undefined);
    serviceMocks.obterDivisaoTransacao.mockResolvedValue({
      ...await serviceMocks.obterDivisaoTransacao(),
      status: "Aceita",
    });

    renderForm({
      initialTransaction: criarItemExtrato({
        id: "tx-vinculada-1",
        valor: 600,
        isDividida: true,
        valorTotalOriginal: 1000,
        percentualDivisao: 60,
        divisaoTransacaoId: "div-1",
        statusDivisao: "Aceita",
      }),
      onUpdateTransacao,
    });

    await screen.findByText("Divisão vinculada existente");
    await user.clear(screen.getByLabelText("Descrição"));
    await user.type(screen.getByLabelText("Descrição"), "Descrição local");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => expect(onUpdateTransacao).toHaveBeenCalledWith(
      "tx-vinculada-1",
      expect.objectContaining({ descricao: "Descrição local", valor: 600 }),
    ));
    expect(serviceMocks.proporAlteracaoDivisao).not.toHaveBeenCalled();
  });

  it("usa somente este mês como escopo padrão ao alterar fixa compartilhada", async () => {
    const user = userEvent.setup();
    serviceMocks.obterDivisaoTransacao.mockResolvedValue({
      ...await serviceMocks.obterDivisaoTransacao(),
      valorTotal: 500,
      status: "Aceita",
      participantes: [
        { id: "criador-1", participanteUsuarioId: "user-1", nomeExibicao: "Usuário", tipoParticipante: "Criador", percentual: 50, valor: 250, status: "Aceito", versaoConvite: 1, expiraEm: null, transacaoGeradaId: null, ativo: true },
        { id: "part-1", participanteUsuarioId: "user-2", nomeExibicao: "Maria", tipoParticipante: "UsuarioSistema", percentual: 50, valor: 250, status: "Aceito", versaoConvite: 1, expiraEm: null, transacaoGeradaId: null, ativo: true },
      ],
    });

    renderForm({
      initialTransaction: criarItemExtrato({
        id: "tx-vinculada-1",
        descricao: "Energia",
        valor: 250,
        dataOcorrencia: "2026-09-10",
        isFixa: true,
        isDividida: true,
        valorTotalOriginal: 500,
        percentualDivisao: 50,
        divisaoTransacaoId: "div-1",
        statusDivisao: "Aceita",
      }),
    });

    const valueInput = screen.getByPlaceholderText("0,00");
    await screen.findByText("Divisão vinculada existente");
    await waitFor(() => expect(valueInput).toBeEnabled());
    await user.clear(valueInput);
    await user.type(valueInput, "62000");

    expect(screen.getByLabelText("Somente este mês")).toBeChecked();
    expect(screen.getByText("Prévia da alteração")).toBeInTheDocument();
    expect(screen.getByText(/Somente setembro de 2026/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar proposta" }));

    await waitFor(() => expect(serviceMocks.proporAlteracaoDivisao).toHaveBeenCalledWith(
      "div-1",
      expect.objectContaining({
        escopo: "EstaOcorrencia",
        valorTotal: 620,
        participantes: [{ participanteId: "part-1", percentual: 50 }],
      }),
    ));
  });

  it("mostra proposta pendente e protege os campos econômicos", async () => {
    serviceMocks.obterDivisaoTransacao.mockResolvedValue({
      ...await serviceMocks.obterDivisaoTransacao(),
      status: "AlteracaoPendente",
      versoes: [{
        id: "versao-2",
        versao: 2,
        status: "PropostaPendente",
        escopo: "EstaOcorrencia",
        valorTotalAnterior: 1000,
        valorTotalProposto: 1200,
        percentualCriadorAnterior: 60,
        percentualCriadorProposto: 60,
        valorCriadorAnterior: 600,
        valorCriadorProposto: 720,
        percentualParticipanteAnterior: 40,
        percentualParticipanteProposto: 40,
        valorParticipanteAnterior: 400,
        valorParticipanteProposto: 480,
        vencimentoAnterior: null,
        vencimentoProposto: null,
        quantidadeParcelasAnterior: null,
        quantidadeParcelasProposta: null,
        recorrenciaAnterior: null,
        recorrenciaProposta: null,
        frequenciaAnterior: null,
        frequenciaProposta: null,
        responsabilidadeAnterior: null,
        responsabilidadeProposta: null,
        criadoEm: "2026-08-01T00:00:00Z",
        respondidoEm: null,
        motivoResposta: null,
      }],
    });

    renderForm({
      initialTransaction: criarItemExtrato({
        id: "tx-vinculada-1",
        valor: 600,
        isDividida: true,
        valorTotalOriginal: 1000,
        percentualDivisao: 60,
        divisaoTransacaoId: "div-1",
        statusDivisao: "AlteracaoPendente",
      }),
    });

    expect(await screen.findByText("Alteração pendente")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0,00")).toBeDisabled();
    expect(screen.getByLabelText("Minha parte")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeEnabled();
  });

  it("permite ao convidado editar data e categoria sem alterar valor econômico", async () => {
    const user = userEvent.setup();
    const onUpdateTransacao = vi.fn().mockResolvedValue(undefined);
    renderForm({
      initialTransaction: criarItemExtrato({
        id: "tx-convidado-1",
        valor: 400,
        isDividida: true,
        valorTotalOriginal: 1000,
        percentualDivisao: 40,
        divisaoTransacaoId: "div-1",
        statusDivisao: "Aceita",
      }),
      onUpdateTransacao,
    }, { id: "user-2", nome: "Maria", email: "maria@email.com" });

    await waitFor(() => expect(screen.getByRole("button", { name: "Atualizar" })).toBeEnabled());
    expect(screen.getByLabelText("Minha parte")).toBeDisabled();
    await user.clear(screen.getByLabelText("Data"));
    await user.type(screen.getByLabelText("Data"), "2026-09-05");
    await user.selectOptions(screen.getByLabelText("Categoria"), "cat-1");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(onUpdateTransacao).toHaveBeenCalledWith(
      "tx-convidado-1",
      expect.objectContaining({
        dataOcorrencia: "2026-09-05",
        valor: 400,
        percentualDivisao: 40,
      }),
    ));
    expect(serviceMocks.proporAlteracaoDivisao).not.toHaveBeenCalled();
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
    await user.clear(screen.getByLabelText("Percentual de Maria"));
    await user.type(screen.getByLabelText("Percentual de Maria"), "30");
    await user.click(screen.getByRole("button", { name: "Pessoa externa" }));
    await user.clear(screen.getByLabelText("Percentual da pessoa externa 1"));
    await user.type(screen.getByLabelText("Percentual da pessoa externa 1"), "10");
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
            modoDefinicao: 1,
            percentual: 10,
            valor: null,
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

  it("edita descrição de compra parcelada vinculada sem recriar a divisão", async () => {
    const user = userEvent.setup();
    const onUpdateCompraParcelada = vi.fn().mockResolvedValue(undefined);
    serviceMocks.obterDivisaoTransacao.mockResolvedValue({
      ...await serviceMocks.obterDivisaoTransacao(),
      compraParceladaId: "compra-vinculada-1",
      transacaoOrigemId: null,
      valorTotal: 200,
      status: "Pendente",
      participantes: [
        { id: "criador-1", participanteUsuarioId: "user-1", nomeExibicao: "Usuário", tipoParticipante: "Criador", percentual: 60, valor: 120, status: "Aceito", versaoConvite: 1, expiraEm: null, compraParceladaGeradaId: null, ativo: true },
        { id: "part-1", participanteUsuarioId: "user-2", nomeExibicao: "Maria", tipoParticipante: "UsuarioSistema", percentual: 40, valor: 80, status: "Pendente", versaoConvite: 1, expiraEm: null, compraParceladaGeradaId: null, ativo: true },
      ],
    });

    renderForm({
      initialTransaction: criarItemExtrato({
        id: null,
        descricao: "Teste divisão",
        valor: 60,
        isDividida: true,
        valorTotalOriginal: 100,
        percentualDivisao: 60,
        origem: "CompraParcelada",
        formaPagamento: "Cartão de crédito",
        cartaoCreditoId: "cartao-1",
        compraParceladaId: "compra-vinculada-1",
        numeroParcela: 1,
        quantidadeParcelas: 2,
        divisaoTransacaoId: "div-1",
        statusDivisao: "Pendente",
      }),
      onUpdateCompraParcelada,
    });

    await screen.findByText("Divisão vinculada existente");
    await user.clear(screen.getByLabelText("Descrição"));
    await user.type(screen.getByLabelText("Descrição"), "Teste divisão editado");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(onUpdateCompraParcelada).toHaveBeenCalledTimes(1));
    expect(onUpdateCompraParcelada).toHaveBeenCalledWith(
      "compra-vinculada-1",
      1,
      expect.any(String),
      expect.objectContaining({
        descricao: "Teste divisão editado",
        divisaoVinculada: null,
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
    await user.click(screen.getByRole("button", { name: "Pessoa externa" }));
    await user.clear(screen.getByLabelText("Percentual da pessoa externa 1"));
    await user.type(screen.getByLabelText("Percentual da pessoa externa 1"), "10");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));

    expect((await screen.findAllByText(/distribuição excede o total/i)).length).toBeGreaterThan(0);
    expect(onCreateTransacao).not.toHaveBeenCalled();
  });

  it("mantém percentual decimal com vírgula e envia número decimal", async () => {
    const user = userEvent.setup();
    const onCreateTransacao = vi.fn().mockResolvedValue({ id: "tx-1" });
    renderForm({ onCreateTransacao });

    await user.type(screen.getByPlaceholderText("0,00"), "10000");
    await user.type(screen.getByLabelText("Descrição"), "Despesa decimal");
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.clear(screen.getByLabelText("Minha parte"));
    await user.type(screen.getByLabelText("Minha parte"), "87,5");
    await user.type(screen.getByPlaceholderText("Buscar contato ou informar e-mail"), "maria@email.com");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByLabelText("Percentual de Maria")).toHaveValue("12,5");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));
    await waitFor(() => expect(serviceMocks.criarConviteDivisao).toHaveBeenCalled());
    expect(serviceMocks.criarConviteDivisao).toHaveBeenCalledWith(expect.objectContaining({
      participantesUsuarios: [expect.objectContaining({ percentual: 12.5 })],
    }));
  });

  it("adiciona vários usuários sem substituir os anteriores", async () => {
    const user = userEvent.setup();
    const nomes: Record<string, [string, string]> = {
      "joao@email.com": ["João", "user-2"],
      "maria@email.com": ["Maria", "user-3"],
      "pedro@email.com": ["Pedro", "user-4"],
    };
    serviceMocks.resolverConvidadoDivisao.mockImplementation(async (email: string) => ({
      encontrado: true,
      nomeExibicao: nomes[email][0],
      emailMascarado: `${email.slice(0, 2)}***@email.com`,
      identificador: nomes[email][1],
    }));
    const onCreateTransacao = vi.fn().mockResolvedValue({ id: "tx-1" });
    renderForm({ onCreateTransacao });
    await user.type(screen.getByPlaceholderText("0,00"), "100000");
    await user.type(screen.getByLabelText("Descrição"), "Compra compartilhada");
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.clear(screen.getByLabelText("Minha parte"));
    await user.type(screen.getByLabelText("Minha parte"), "40");

    for (const email of Object.keys(nomes)) {
      await user.type(screen.getByPlaceholderText("Buscar contato ou informar e-mail"), email);
      await user.click(screen.getByRole("button", { name: "Buscar" }));
    }
    for (const [nome, percentual] of [["João", "20"], ["Maria", "25"], ["Pedro", "15"]]) {
      const input = screen.getByLabelText(`Percentual de ${nome}`);
      await user.clear(input);
      await user.type(input, percentual);
    }
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));
    await waitFor(() => expect(serviceMocks.criarConviteDivisao).toHaveBeenCalled());
    expect(serviceMocks.criarConviteDivisao).toHaveBeenCalledWith(expect.objectContaining({
      participantesUsuarios: expect.arrayContaining([
        expect.objectContaining({ email: "joao@email.com", percentual: 20 }),
        expect.objectContaining({ email: "maria@email.com", percentual: 25 }),
        expect.objectContaining({ email: "pedro@email.com", percentual: 15 }),
      ]),
    }));
  }, 10_000);

  it("remove somente o participante escolhido e bloqueia contato duplicado", async () => {
    const user = userEvent.setup();
    serviceMocks.listarContatosDivisao.mockResolvedValue([
      { id: "contato-1", usuarioContatoId: "user-2", nomeExibicao: "João", emailMascarado: "jo***@email.com", apelido: null, ultimoUsoEm: null, criadoEm: "2026-08-01", ativo: true },
      { id: "contato-2", usuarioContatoId: "user-3", nomeExibicao: "Maria", emailMascarado: "ma***@email.com", apelido: null, ultimoUsoEm: null, criadoEm: "2026-08-01", ativo: true },
    ]);
    renderForm();
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.click(await screen.findByRole("button", { name: "Selecionar contato João" }));
    const contatoJoao = screen.getByRole("button", { name: "Selecionar contato João" });
    expect(contatoJoao).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Selecionar contato Maria" }));
    await user.click(screen.getByRole("button", { name: "Remover Maria" }));
    expect(screen.getByLabelText("Percentual de João")).toBeInTheDocument();
    expect(screen.queryByLabelText("Percentual de Maria")).not.toBeInTheDocument();
  });

  it("preserva valor em reais de participante externo", async () => {
    const user = userEvent.setup();
    const onCreateTransacao = vi.fn().mockResolvedValue({ id: "tx-1" });
    renderForm({ onCreateTransacao });
    await user.type(screen.getByPlaceholderText("0,00"), "20000");
    await user.type(screen.getByLabelText("Descrição"), "Compra com externo");
    await user.click(screen.getByLabelText("Dividir esta transação"));
    await user.click(screen.getByLabelText("Dividir com outra pessoa"));
    await user.type(screen.getByPlaceholderText("Buscar contato ou informar e-mail"), "maria@email.com");
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await user.clear(screen.getByLabelText("Percentual de Maria"));
    await user.type(screen.getByLabelText("Percentual de Maria"), "6,29");
    await user.click(screen.getByRole("button", { name: "Pessoa externa" }));
    await user.click(screen.getByRole("button", { name: "R$" }));
    const valorExterno = screen.getByLabelText("Valor da pessoa externa 1");
    await user.clear(valorExterno);
    await user.type(valorExterno, "8742");
    expect(valorExterno).toHaveValue("R$ 87,42");
    await user.click(screen.getByRole("button", { name: "Salvar transação" }));
    await waitFor(() => expect(serviceMocks.criarConviteDivisao).toHaveBeenCalled());
    expect(serviceMocks.criarConviteDivisao).toHaveBeenCalledWith(expect.objectContaining({
      participantesExternos: [expect.objectContaining({
        modoDefinicao: 2,
        valor: 87.42,
        percentual: null,
      })],
    }));
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
