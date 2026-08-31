import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsPage } from "./NotificationsPage";
import type { DivisaoTransacao } from "../types/finance";
import type { Notificacao, NotificacoesPaginadas } from "../types/notification";

const mocks = vi.hoisted(() => ({
  useNotificacoes: vi.fn(),
  marcarTodasComoLidas: vi.fn(),
  marcarComoLida: vi.fn(),
  obterDivisaoTransacao: vi.fn(),
  aceitarDivisao: vi.fn(),
  aceitarClassificarDivisao: vi.fn(),
  listarCategorias: vi.fn(),
  listarContasBancarias: vi.fn(),
  listarCartoesCreditoOpcoes: vi.fn(),
  recusarDivisao: vi.fn(),
  assumirValorDivisao: vi.fn(),
  reenviarDivisao: vi.fn(),
  manterParteCriadorDivisao: vi.fn(),
  aceitarAlteracaoDivisao: vi.fn(),
  recusarAlteracaoDivisao: vi.fn(),
  manterVersaoAnteriorDivisao: vi.fn(),
  reenviarAlteracaoDivisao: vi.fn(),
  excluirDivisao: vi.fn(),
}));

vi.mock("../components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../hooks/queries/useNotificationQueries", () => ({ useNotificacoes: mocks.useNotificacoes }));
vi.mock("../services/notificationService", () => ({
  marcarTodasComoLidas: mocks.marcarTodasComoLidas,
  marcarComoLida: mocks.marcarComoLida,
}));
vi.mock("../services/financeService", () => ({
  obterDivisaoTransacao: mocks.obterDivisaoTransacao,
  aceitarDivisao: mocks.aceitarDivisao,
  aceitarClassificarDivisao: mocks.aceitarClassificarDivisao,
  listarCategorias: mocks.listarCategorias,
  listarContasBancarias: mocks.listarContasBancarias,
  listarCartoesCreditoOpcoes: mocks.listarCartoesCreditoOpcoes,
  recusarDivisao: mocks.recusarDivisao,
  assumirValorDivisao: mocks.assumirValorDivisao,
  reenviarDivisao: mocks.reenviarDivisao,
  manterParteCriadorDivisao: mocks.manterParteCriadorDivisao,
  aceitarAlteracaoDivisao: mocks.aceitarAlteracaoDivisao,
  recusarAlteracaoDivisao: mocks.recusarAlteracaoDivisao,
  manterVersaoAnteriorDivisao: mocks.manterVersaoAnteriorDivisao,
  reenviarAlteracaoDivisao: mocks.reenviarAlteracaoDivisao,
  excluirDivisao: mocks.excluirDivisao,
}));

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useNotificacoes.mockReturnValue(queryResult(criarPagina()));
    mocks.marcarTodasComoLidas.mockResolvedValue(undefined);
    mocks.marcarComoLida.mockResolvedValue(undefined);
    mocks.obterDivisaoTransacao.mockResolvedValue(criarDivisao());
    mocks.aceitarDivisao.mockResolvedValue(undefined);
    mocks.aceitarClassificarDivisao.mockResolvedValue(undefined);
    mocks.listarCategorias.mockResolvedValue([{ id: "cat-1", nome: "Casa", corHexa: "#000000" }]);
    mocks.listarContasBancarias.mockResolvedValue([{ id: "conta-1", nomeCustomizado: "Conta principal" }]);
    mocks.listarCartoesCreditoOpcoes.mockResolvedValue([{ id: "cartao-1", apelidoCartao: "Cartão principal", banco: "Banco" }]);
  });

  it("carrega a lista e aplica os filtros no backend", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("heading", { name: "Notificações" })).toBeInTheDocument();
    expect(screen.getByText("Maria compartilhou uma despesa")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Não lidas" }));
    expect(mocks.useNotificacoes).toHaveBeenLastCalledWith(1, "NaoLidas", null);
    await user.selectOptions(screen.getByLabelText("Categoria de notificação"), "Divisoes");
    expect(mocks.useNotificacoes).toHaveBeenLastCalledWith(1, "NaoLidas", "Divisoes");
  });

  it("marca uma notificação individualmente como lida", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Marcar como lida" }));

    await waitFor(() => expect(mocks.marcarComoLida).toHaveBeenCalledWith("notificacao-1"));
  });

  it("aceita uma divisão diretamente no card expandido", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Ver detalhes e ações" }));
    expect(await screen.findByText(/R\$\s*200,00/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aceitar" }));

    await waitFor(() => expect(mocks.aceitarDivisao).toHaveBeenCalledWith("participante-1"));
    expect(await screen.findByText("Divisão aceita.")).toBeInTheDocument();
  });

  it("navega entre páginas sem carregar o histórico inteiro", async () => {
    const user = userEvent.setup();
    mocks.useNotificacoes.mockReturnValue(queryResult({ ...criarPagina(), totalPaginas: 2, totalItens: 21 }));
    renderPage();

    await user.click(screen.getByRole("button", { name: /Próxima/ }));

    expect(mocks.useNotificacoes).toHaveBeenLastCalledWith(2, "Todas", null);
  });

  it("aceita e classifica com recursos financeiros do usuário atual", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Ver detalhes e ações" }));
    await screen.findByText(/R\$\s*200,00/);
    await user.click(screen.getByRole("button", { name: "Aceitar e classificar" }));
    await user.selectOptions(await screen.findByLabelText("Categoria da divisão"), "cat-1");
    await user.selectOptions(screen.getByLabelText("Conta da divisão"), "conta-1");
    await user.selectOptions(screen.getByLabelText("Cartão da divisão"), "cartao-1");
    await user.click(screen.getByRole("button", { name: "Aceitar e adicionar" }));

    await waitFor(() => expect(mocks.aceitarClassificarDivisao).toHaveBeenCalledWith(
      "participante-1",
      { categoriaId: "cat-1", contaBancariaId: "conta-1", cartaoCreditoId: "cartao-1" },
    ));
  });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><NotificationsPage /></QueryClientProvider>);
}

function queryResult(data: NotificacoesPaginadas) {
  return { data, isLoading: false, isError: false, refetch: vi.fn() };
}

function criarPagina(): NotificacoesPaginadas {
  return { itens: [criarNotificacao()], pagina: 1, tamanhoPagina: 20, totalItens: 1, totalPaginas: 1 };
}

function criarNotificacao(): Notificacao {
  return {
    id: "notificacao-1",
    titulo: "Maria compartilhou uma despesa",
    mensagem: "Energia",
    lida: false,
    dataCriacao: "2026-08-29T12:00:00Z",
    tipoNotificacao: "DivisaoRecebida",
    entidade: "DivisaoTransacao",
    entidadeId: "divisao-1",
    participanteDivisaoId: "participante-1",
    acaoPendente: "ResponderDivisao",
    statusAcao: "Pendente",
  };
}

function criarDivisao(): DivisaoTransacao {
  return {
    id: "divisao-1",
    usuarioCriadorId: "criador-1",
    transacaoOrigemId: "transacao-1",
    descricaoOrigem: "Energia",
    dataSugeridaConvidado: "2026-09-10",
    valorTotal: 200,
    status: "Pendente",
    versaoAtual: 1,
    quantidadeReenvios: 0,
    criadoEm: "2026-08-29T12:00:00Z",
    atualizadoEm: "2026-08-29T12:00:00Z",
    participantes: [
      { id: "criador-parte", participanteUsuarioId: "criador-1", tipoParticipante: "Criador", percentual: 50, valor: 100, status: "Aceito", versaoConvite: 1, expiraEm: null, transacaoGeradaId: "transacao-1", ativo: true },
      { id: "participante-1", participanteUsuarioId: "usuario-2", tipoParticipante: "UsuarioSistema", percentual: 50, valor: 100, status: "Pendente", versaoConvite: 1, expiraEm: null, transacaoGeradaId: null, ativo: true },
    ],
    versoes: [],
  };
}
