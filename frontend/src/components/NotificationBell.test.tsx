import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import type {
  CartaoCreditoOpcao,
  Categoria,
  ContaBancaria,
  DivisaoTransacao,
} from "../types/finance";
import type { Notificacao } from "../types/notification";

const mocks = vi.hoisted(() => ({
  notificacoes: [] as Notificacao[],
  marcarTodasComoLidas: vi.fn(),
  obterDivisaoTransacao: vi.fn(),
  aceitarDivisao: vi.fn(),
  aceitarClassificarDivisao: vi.fn(),
  recusarDivisao: vi.fn(),
  assumirValorDivisao: vi.fn(),
  reenviarDivisao: vi.fn(),
  manterParteCriadorDivisao: vi.fn(),
  excluirDivisao: vi.fn(),
  aceitarAlteracaoDivisao: vi.fn(),
  recusarAlteracaoDivisao: vi.fn(),
  manterVersaoAnteriorDivisao: vi.fn(),
  reenviarAlteracaoDivisao: vi.fn(),
  listarCategorias: vi.fn(),
  listarContasBancarias: vi.fn(),
  listarCartoesCreditoOpcoes: vi.fn(),
}));

vi.mock("../hooks/queries/useNotificationQueries", () => ({
  useNotificacoesNaoLidas: () => ({
    data: mocks.notificacoes,
    isLoading: false,
  }),
}));

vi.mock("../services/notificationService", () => ({
  marcarTodasComoLidas: mocks.marcarTodasComoLidas,
}));

vi.mock("../services/financeService", () => ({
  obterDivisaoTransacao: mocks.obterDivisaoTransacao,
  aceitarDivisao: mocks.aceitarDivisao,
  aceitarClassificarDivisao: mocks.aceitarClassificarDivisao,
  recusarDivisao: mocks.recusarDivisao,
  assumirValorDivisao: mocks.assumirValorDivisao,
  reenviarDivisao: mocks.reenviarDivisao,
  manterParteCriadorDivisao: mocks.manterParteCriadorDivisao,
  excluirDivisao: mocks.excluirDivisao,
  aceitarAlteracaoDivisao: mocks.aceitarAlteracaoDivisao,
  recusarAlteracaoDivisao: mocks.recusarAlteracaoDivisao,
  manterVersaoAnteriorDivisao: mocks.manterVersaoAnteriorDivisao,
  reenviarAlteracaoDivisao: mocks.reenviarAlteracaoDivisao,
  listarCategorias: mocks.listarCategorias,
  listarContasBancarias: mocks.listarContasBancarias,
  listarCartoesCreditoOpcoes: mocks.listarCartoesCreditoOpcoes,
}));

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

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notificacoes = [];
    mocks.marcarTodasComoLidas.mockResolvedValue(undefined);
    mocks.obterDivisaoTransacao.mockResolvedValue(criarDivisao());
    mocks.aceitarDivisao.mockResolvedValue(undefined);
    mocks.aceitarClassificarDivisao.mockResolvedValue(undefined);
    mocks.recusarDivisao.mockResolvedValue(undefined);
    mocks.assumirValorDivisao.mockResolvedValue(undefined);
    mocks.reenviarDivisao.mockResolvedValue(undefined);
    mocks.manterParteCriadorDivisao.mockResolvedValue(undefined);
    mocks.excluirDivisao.mockResolvedValue(undefined);
    mocks.aceitarAlteracaoDivisao.mockResolvedValue(undefined);
    mocks.recusarAlteracaoDivisao.mockResolvedValue(undefined);
    mocks.manterVersaoAnteriorDivisao.mockResolvedValue(undefined);
    mocks.reenviarAlteracaoDivisao.mockResolvedValue(undefined);
    mocks.listarCategorias.mockResolvedValue(categorias);
    mocks.listarContasBancarias.mockResolvedValue(contas);
    mocks.listarCartoesCreditoOpcoes.mockResolvedValue(cartoes);
  });

  it("aceita uma divisão recebida pela notificação", async () => {
    const user = userEvent.setup();
    mocks.notificacoes = [criarNotificacaoRecebida()];

    renderBell();

    await abrirAcoes(user);
    expect(screen.getByText("08/09/2026")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aceitar" }));

    await waitFor(() => expect(mocks.aceitarDivisao).toHaveBeenCalledWith("participante-1"));
    expect(screen.getByText("Divisão aceita.")).toBeInTheDocument();
  });

  it("abre a Central pelo link Ver todas", async () => {
    const user = userEvent.setup();
    mocks.notificacoes = [criarNotificacaoRecebida()];

    renderBell(true);
    await user.click(screen.getByRole("button", { name: "Notificações" }));
    await user.click(screen.getByRole("link", { name: "Ver todas as notificações" }));

    expect(await screen.findByRole("heading", { name: "Central de teste" })).toBeInTheDocument();
  });

  it("aceita e classifica usando opções do usuário atual", async () => {
    const user = userEvent.setup();
    mocks.notificacoes = [criarNotificacaoRecebida()];

    renderBell();

    await abrirAcoes(user);
    await user.click(screen.getByRole("button", { name: "Aceitar e classificar" }));

    await screen.findByRole("dialog", { name: "Aceitar e classificar" });
    await user.selectOptions(screen.getByLabelText("Categoria"), "cat-1");
    await user.selectOptions(screen.getByLabelText("Conta"), "conta-1");
    await user.selectOptions(screen.getByLabelText("Cartão"), "cartao-1");
    await user.click(screen.getByRole("button", { name: "Aceitar e adicionar" }));

    await waitFor(() =>
      expect(mocks.aceitarClassificarDivisao).toHaveBeenCalledWith("participante-1", {
        categoriaId: "cat-1",
        contaBancariaId: "conta-1",
        cartaoCreditoId: "cartao-1",
      }),
    );
  });

  it("confirma antes de recusar a divisão", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.notificacoes = [criarNotificacaoRecebida()];

    renderBell();

    await abrirAcoes(user);
    await user.click(screen.getByRole("button", { name: "Recusar" }));

    await waitFor(() => expect(mocks.recusarDivisao).toHaveBeenCalledWith("participante-1"));
    expect(confirmSpy).toHaveBeenCalledWith(
      "Essa despesa não será adicionada ao seu extrato. O criador será notificado.",
    );
  });

  it("permite decisão do criador após recusa", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.notificacoes = [criarNotificacaoCriador()];
    mocks.obterDivisaoTransacao.mockResolvedValue(
      criarDivisao({
        participantes: [
          criarParticipanteCriador(),
          {
            ...criarParticipanteConvidado(),
            status: "Recusado",
          },
        ],
      }),
    );

    renderBell();

    await abrirAcoes(user);
    await user.click(screen.getByRole("button", { name: "Assumir despesa integralmente" }));

    await waitFor(() => expect(mocks.assumirValorDivisao).toHaveBeenCalledWith(
      "divisao-1",
      "participante-1",
    ));
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Você passará a assumir R\$\s?80,00 desta despesa\./),
    );
  });

  it("reenvia somente para o participante indicado pela notificação", async () => {
    const user = userEvent.setup();
    mocks.notificacoes = [{
      ...criarNotificacaoCriador(),
      participanteDivisaoId: "participante-2",
      titulo: "Pedro recusou a divisão",
    }];
    mocks.obterDivisaoTransacao.mockResolvedValue(criarDivisao({
      participantes: [
        criarParticipanteCriador(),
        { ...criarParticipanteConvidado(), nomeExibicao: "Maria", status: "Recusado" },
        { ...criarParticipanteConvidado(), id: "participante-2", participanteUsuarioId: "usuario-3", nomeExibicao: "Pedro", status: "Recusado" },
      ],
    }));
    renderBell();
    await abrirAcoes(user);
    expect(screen.getByText("Pedro")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reenviar convite" }));
    await waitFor(() => expect(mocks.reenviarDivisao).toHaveBeenCalledWith(
      "divisao-1",
      { participanteId: "participante-2" },
    ));
  });

  it("mantém somente a parte do criador para o participante indicado", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.notificacoes = [criarNotificacaoCriador()];
    mocks.obterDivisaoTransacao.mockResolvedValue(criarDivisao({
      participantes: [
        criarParticipanteCriador(),
        { ...criarParticipanteConvidado(), status: "Recusado" },
      ],
    }));
    renderBell();

    await abrirAcoes(user);
    await user.click(screen.getByRole("button", { name: "Manter somente minha parte" }));

    await waitFor(() => expect(mocks.manterParteCriadorDivisao).toHaveBeenCalledWith("participante-1"));
    expect(mocks.excluirDivisao).not.toHaveBeenCalled();
  });
});

async function abrirAcoes(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Notificações" }));
  await user.click(screen.getByRole("button", { name: "Ver ações" }));
  await screen.findByRole("dialog", { name: /dividiu uma despesa|recusou a divisão/i });
}

function renderBell(withRoute = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        {withRoute ? (
          <Routes>
            <Route path="/" element={<NotificationBell />} />
            <Route path="/notificacoes" element={<h1>Central de teste</h1>} />
          </Routes>
        ) : <NotificationBell />}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function criarNotificacaoRecebida(): Notificacao {
  return {
    id: "notificacao-1",
    titulo: "Maria dividiu uma despesa com você",
    mensagem: "Restaurante",
    lida: false,
    dataCriacao: "2026-07-28T12:00:00Z",
    tipoNotificacao: "DivisaoRecebida",
    entidade: "DivisaoTransacao",
    entidadeId: "divisao-1",
    acaoPendente: "ResponderDivisao",
    rota: null,
    versao: 1,
  };
}

function criarNotificacaoCriador(): Notificacao {
  return {
    ...criarNotificacaoRecebida(),
    id: "notificacao-2",
    titulo: "Maria recusou a divisão",
    tipoNotificacao: "DivisaoRecusada",
    acaoPendente: "DecidirRecusaDivisao",
    participanteDivisaoId: "participante-1",
  };
}

function criarDivisao(overrides: Partial<DivisaoTransacao> = {}): DivisaoTransacao {
  return {
    id: "divisao-1",
    usuarioCriadorId: "criador-1",
    transacaoOrigemId: "transacao-1",
    dataSugeridaConvidado: "2026-09-08",
    valorTotal: 200,
    status: "Pendente",
    versaoAtual: 1,
    quantidadeReenvios: 0,
    criadoEm: "2026-07-28T12:00:00Z",
    atualizadoEm: "2026-07-28T12:00:00Z",
    participantes: [criarParticipanteCriador(), criarParticipanteConvidado()],
    versoes: [],
    ...overrides,
  };
}

function criarParticipanteCriador() {
  return {
    id: "criador-participante-1",
    participanteUsuarioId: "criador-1",
    tipoParticipante: "Criador",
    percentual: 60,
    valor: 120,
    status: "Aceito",
    versaoConvite: 1,
    expiraEm: null,
    transacaoGeradaId: "transacao-1",
    ativo: true,
  };
}

function criarParticipanteConvidado() {
  return {
    id: "participante-1",
    participanteUsuarioId: "usuario-2",
    tipoParticipante: "UsuarioSistema",
    percentual: 40,
    valor: 80,
    status: "Pendente",
    versaoConvite: 1,
    expiraEm: "2026-08-04T12:00:00Z",
    transacaoGeradaId: null,
    ativo: true,
  };
}
