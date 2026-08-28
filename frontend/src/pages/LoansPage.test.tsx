import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmprestimoDetalhe, EmprestimoResumo } from "../types/loan";
import { LoansPage } from "./LoansPage";

const mocks = vi.hoisted(() => ({
  loans: [] as EmprestimoResumo[],
  detail: null as EmprestimoDetalhe | null,
  queryError: false,
  criarContato: vi.fn(),
  criarEmprestimo: vi.fn(),
  atualizarEmprestimo: vi.fn(),
  registrarPagamento: vi.fn(),
  excluirEmprestimo: vi.fn(),
  excluirPending: false,
  desfazerPagamento: vi.fn(),
  definirArquivamento: vi.fn(),
  alterarRecorrencia: vi.fn(),
  encerrarRecorrencia: vi.fn(),
  refetch: vi.fn(),
  resumoArgs: vi.fn(),
}));

const contatos = [
  { id: "contato-joao", nome: "João", observacao: null, ativo: true, criadoEm: "2026-08-01T00:00:00Z", atualizadoEm: "2026-08-01T00:00:00Z" },
  { id: "contato-maria", nome: "Maria", observacao: null, ativo: true, criadoEm: "2026-08-01T00:00:00Z", atualizadoEm: "2026-08-01T00:00:00Z" },
];

vi.mock("../components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

vi.mock("../hooks/queries/useLoanQueries", () => ({
  useContatosEmprestimo: () => ({ data: contatos, isLoading: false, isError: false }),
  useResumoEmprestimosMensal: (mes: number, ano: number, contatoId: string | null, incluirArquivados: boolean, pagina: number) => {
    mocks.resumoArgs(mes, ano, contatoId, incluirArquivados, pagina);
    const items = mocks.loans
      .filter((item) => (!contatoId || item.contatoId === contatoId) && (incluirArquivados || !item.isArquivado))
      .map((item) => ({
        ...item,
        origemNome: item.origemFinanceira === 1 ? "Santander" : "Conta principal",
        valorCompetencia: item.valorTotal / item.quantidadeParcelas,
        dataCompetencia: item.data,
        numeroParcelaCompetencia: 1,
        statusCompetencia: item.valorPago > 0 ? 2 : 1,
        proximoVencimento: item.data,
      }));
    return {
      data: {
        mes,
        ano,
        aReceberTotal: items.reduce((total, item) => total + item.saldoReceber, 0),
        previstoNoMes: items.reduce((total, item) => total + item.valorCompetencia, 0),
        recebidoNoMes: items.reduce((total, item) => total + item.valorPago, 0),
        pagina,
        tamanhoPagina: 50,
        totalItens: items.length,
        totalPaginas: items.length ? 1 : 0,
        itens: items,
      },
      isLoading: false,
      isError: mocks.queryError,
      refetch: mocks.refetch,
    };
  },
  useEmprestimoDetalhe: (id: string | null) => ({
    data: id ? mocks.detail : null,
    isLoading: false,
    isError: false,
    refetch: mocks.refetch,
  }),
}));

vi.mock("../hooks/queries/useFinanceQueries", () => ({
  useCartoesOpcoes: () => ({ data: [{ id: "cartao-1", apelidoCartao: "Santander", banco: "Santander" }], isLoading: false }),
  useContas: () => ({ data: [{ id: "conta-1", nomeCustomizado: "Conta principal", codigoBanco: "001", saldoInicial: 0, isFavorita: true, isArquivada: false, permiteEditarSaldoInicial: false, dataCriacao: "2026-01-01" }], isLoading: false }),
}));

vi.mock("../hooks/mutations/useLoanMutations", () => ({
  useCriarContatoEmprestimo: () => ({ mutateAsync: mocks.criarContato, isPending: false }),
  useCriarEmprestimo: () => ({ mutateAsync: mocks.criarEmprestimo, isPending: false }),
  useAtualizarEmprestimo: () => ({ mutateAsync: mocks.atualizarEmprestimo, isPending: false }),
  useRegistrarPagamentoEmprestimo: () => ({ mutateAsync: mocks.registrarPagamento, isPending: false }),
  useExcluirEmprestimo: () => ({ mutateAsync: mocks.excluirEmprestimo, isPending: mocks.excluirPending }),
  useDesfazerPagamentoEmprestimo: () => ({ mutateAsync: mocks.desfazerPagamento, isPending: false }),
  useDefinirArquivamentoEmprestimo: () => ({ mutateAsync: mocks.definirArquivamento, isPending: false }),
  useAlterarRecorrenciaEmprestimo: () => ({ mutateAsync: mocks.alterarRecorrencia, isPending: false }),
  useEncerrarRecorrenciaEmprestimo: () => ({ mutateAsync: mocks.encerrarRecorrencia, isPending: false }),
}));

describe("LoansPage", () => {
  beforeEach(() => {
    mocks.queryError = false;
    mocks.loans = [loan({ id: "loan-joao", contatoId: "contato-joao", contatoNome: "João", valorTotal: 1200, valorPago: 0, saldoReceber: 1200 }), loan({ id: "loan-maria", contatoId: "contato-maria", contatoNome: "Maria", valorTotal: 500, valorPago: 200, saldoReceber: 300, status: 2 })];
    mocks.detail = detail();
    mocks.criarContato.mockReset().mockResolvedValue(contatos[0]);
    mocks.criarEmprestimo.mockReset().mockResolvedValue(mocks.detail);
    mocks.atualizarEmprestimo.mockReset().mockResolvedValue(mocks.detail);
    mocks.registrarPagamento.mockReset().mockResolvedValue({ id: "pagamento-1" });
    mocks.excluirEmprestimo.mockReset().mockResolvedValue(undefined);
    mocks.excluirPending = false;
    mocks.desfazerPagamento.mockReset().mockResolvedValue(mocks.detail);
    mocks.definirArquivamento.mockReset().mockResolvedValue(mocks.detail);
    mocks.alterarRecorrencia.mockReset().mockResolvedValue(mocks.detail);
    mocks.encerrarRecorrencia.mockReset().mockResolvedValue(mocks.detail);
    mocks.refetch.mockReset();
    mocks.resumoArgs.mockReset();
  });

  it("renderiza listagem e indicadores consolidados", () => {
    render(<LoansPage />);
    const summary = screen.getByRole("region", { name: "Resumo de empréstimos" });
    const receber = within(summary).getByText("A receber total").closest("article");
    const recebido = within(summary).getByText("Recebido neste mês").closest("article");
    expect(receber).toHaveTextContent("R$ 1.500,00");
    expect(recebido).toHaveTextContent("R$ 200,00");
    expect(within(summary).getByText("Previsto neste mês").closest("article")).toHaveTextContent("R$ 566,67");
  });

  it("envia filtro por pessoa e recalcula toda a tela", async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    await user.selectOptions(screen.getByLabelText("Filtrar por pessoa"), "contato-joao");
    const summary = screen.getByRole("region", { name: "Resumo de empréstimos" });
    expect(within(summary).getByText("A receber total").closest("article")).toHaveTextContent("R$ 1.200,00");
    expect(screen.queryByRole("row", { name: /Maria Celular/i })).not.toBeInTheDocument();
  });

  it("navega entre competências e envia o período ao backend", async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    const primeiraChamada = mocks.resumoArgs.mock.calls.at(-1);
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    const proximaChamada = mocks.resumoArgs.mock.calls.at(-1);
    expect(proximaChamada?.[0]).toBe(primeiraChamada?.[0] === 12 ? 1 : primeiraChamada?.[0] + 1);
    expect(proximaChamada?.[1]).toBe(primeiraChamada?.[0] === 12 ? primeiraChamada?.[1] + 1 : primeiraChamada?.[1]);
  });

  it("organiza os registros por pessoa", async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    await user.click(screen.getByRole("button", { name: "Por pessoa" }));
    expect(screen.getByRole("heading", { name: "João" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
  });

  it("oculta arquivados por padrão e permite exibi-los", async () => {
    const user = userEvent.setup();
    mocks.loans.push(loan({ id: "loan-archived", descricao: "Quitado antigo", status: 3, saldoReceber: 0, valorPago: 100, isArquivado: true }));
    render(<LoansPage />);
    expect(screen.queryByText("Quitado antigo")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Mostrar arquivados" }));
    expect(screen.getAllByText("Quitado antigo").length).toBeGreaterThan(0);
  });

  it("cria empréstimo com contato existente", async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    await user.click(screen.getByRole("button", { name: /novo empréstimo/i }));
    await user.selectOptions(screen.getByLabelText("Pessoa"), "contato-joao");
    await user.type(screen.getByLabelText("Descrição"), "Celular");
    await user.selectOptions(screen.getByLabelText("Cartão"), "cartao-1");
    fireEvent.change(screen.getByLabelText("Valor total"), { target: { value: "120000" } });
    await user.click(screen.getByRole("button", { name: /salvar empréstimo/i }));
    expect(mocks.criarEmprestimo).toHaveBeenCalledWith(expect.objectContaining({ contatoId: "contato-joao", descricao: "Celular", valorTotal: 1200, cartaoCreditoId: "cartao-1" }));
  });

  it("cria empréstimo fixo mensal sem data final", async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    await user.click(screen.getByRole("button", { name: /novo empréstimo/i }));
    await user.selectOptions(screen.getByLabelText("Pessoa"), "contato-joao");
    await user.type(screen.getByLabelText("Descrição"), "Linha telefônica");
    await user.click(screen.getByRole("button", { name: "Fixo" }));
    await user.selectOptions(screen.getByLabelText("Cartão"), "cartao-1");
    fireEvent.change(screen.getByLabelText("Valor mensal"), { target: { value: "11990" } });
    await user.click(screen.getByRole("button", { name: /salvar empréstimo/i }));

    expect(mocks.criarEmprestimo).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 3,
      valorTotal: 119.9,
      quantidadeParcelas: 1,
      dataFimRecorrencia: null,
    }));
  });

  it("abre o cadastro em modal ampla e responsiva", async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    await user.click(screen.getByRole("button", { name: /novo empréstimo/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-3xl", "h-[calc(100dvh-1rem)]", "overflow-hidden");
    expect(dialog.querySelector("form")).toHaveClass("h-full", "min-h-0");
  });

  it("cria contato durante o cadastro e o reutiliza no empréstimo", async () => {
    const user = userEvent.setup();
    const novoContato = { ...contatos[0], id: "contato-novo", nome: "Carlos" };
    mocks.criarContato.mockResolvedValue(novoContato);
    render(<LoansPage />);
    await user.click(screen.getByRole("button", { name: /novo empréstimo/i }));
    await user.click(screen.getByRole("button", { name: /criar novo contato/i }));
    await user.type(screen.getByPlaceholderText("Nome da pessoa"), "Carlos");
    await user.type(screen.getByLabelText("Descrição"), "Notebook");
    await user.selectOptions(screen.getByLabelText("Cartão"), "cartao-1");
    fireEvent.change(screen.getByLabelText("Valor total"), { target: { value: "90000" } });
    await user.click(screen.getByRole("button", { name: /salvar empréstimo/i }));
    expect(mocks.criarContato).toHaveBeenCalledWith({ nome: "Carlos" });
    expect(mocks.criarEmprestimo).toHaveBeenCalledWith(expect.objectContaining({ contatoId: "contato-novo" }));
  });

  it("seleciona uma parcela futura e mantém o valor calculado não editável", async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    await user.click(screen.getByRole("row", { name: /João Celular Santander/i }));
    await user.click(screen.getByRole("button", { name: /registrar pagamento/i }));
    const checkboxes = within(screen.getByRole("dialog")).getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    expect(screen.getByLabelText("Total calculado")).toHaveTextContent("R$ 400,00");
    expect(screen.queryByRole("textbox", { name: /total/i })).not.toBeInTheDocument();
  });

  it("seleciona várias parcelas, inclusive futura, e envia somente seus ids", async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    await user.click(screen.getByRole("row", { name: /João Celular Santander/i }));
    await user.click(screen.getByRole("button", { name: /registrar pagamento/i }));
    const checkboxes = within(screen.getByRole("dialog")).getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    expect(screen.getByLabelText("Total calculado")).toHaveTextContent("R$ 800,00");
    await user.click(screen.getByRole("button", { name: /Registrar R/ }));
    expect(mocks.registrarPagamento).toHaveBeenCalledWith(expect.objectContaining({ id: "loan-joao", request: expect.objectContaining({ parcelaIds: ["parcela-2", "parcela-3"] }) }));
  });

  it("permite desfazer um recebimento após confirmação", async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    await user.click(screen.getByRole("row", { name: /João Celular Santander/i }));
    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    await user.click(screen.getByRole("button", { name: "Desfazer recebimento" }));
    expect(mocks.desfazerPagamento).toHaveBeenCalledWith({ id: "loan-joao", pagamentoId: "pagamento-0" });
  });

  it("oferece arquivamento para empréstimo quitado", async () => {
    const user = userEvent.setup();
    mocks.detail = detail({ status: 3, valorPago: 1200, saldoReceber: 0, parcelasPagas: 3 });
    render(<LoansPage />);
    await user.click(screen.getByRole("row", { name: /João Celular Santander/i }));
    await user.click(screen.getByRole("button", { name: "Arquivar" }));
    expect(mocks.definirArquivamento).toHaveBeenCalledWith({ id: "loan-joao", arquivar: true });
  });

  it("abre confirmação pela ação discreta e permite cancelar", async () => {
    const user = userEvent.setup();
    mocks.detail = detail({
      parcelasPagas: 0,
      pagamentos: [],
      parcelas: detail().parcelas.map((parcela) => ({ ...parcela, status: 1, dataPagamento: null, pagamentoEmprestimoId: null })),
    });
    render(<LoansPage />);

    await user.click(screen.getAllByRole("button", { name: "Excluir empréstimo Celular de João" })[0]);
    const confirmacao = screen.getByRole("heading", { name: "Excluir empréstimo?" }).parentElement!;
    expect(within(confirmacao).getByText("João", { selector: "dd" })).toBeInTheDocument();
    expect(within(confirmacao).getByText("R$ 1.200,00", { selector: "dd" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("heading", { name: "Excluir empréstimo?" })).not.toBeInTheDocument();
    expect(mocks.excluirEmprestimo).not.toHaveBeenCalled();
  });

  it("exclui empréstimo sem pagamentos e fecha o detalhe", async () => {
    const user = userEvent.setup();
    mocks.detail = detail({
      parcelasPagas: 0,
      pagamentos: [],
      parcelas: detail().parcelas.map((parcela) => ({ ...parcela, status: 1, dataPagamento: null, pagamentoEmprestimoId: null })),
    });
    render(<LoansPage />);

    await user.click(screen.getAllByRole("button", { name: "Excluir empréstimo Celular de João" })[0]);
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(mocks.excluirEmprestimo).toHaveBeenCalledWith({ id: "loan-joao", origemFinanceira: 1 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Empréstimo excluído.")).toBeInTheDocument();
  });

  it("explica por que empréstimo com pagamento não pode ser excluído", async () => {
    const user = userEvent.setup();
    render(<LoansPage />);

    await user.click(screen.getAllByRole("button", { name: "Excluir empréstimo Celular de João" })[0]);

    expect(screen.getByRole("heading", { name: "Não é possível excluir" })).toBeInTheDocument();
    expect(screen.getByText(/possui pagamentos registrados/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
  });

  it("mostra erro da API durante exclusão", async () => {
    const user = userEvent.setup();
    mocks.detail = detail({ parcelasPagas: 0, pagamentos: [], parcelas: [] });
    mocks.excluirEmprestimo.mockRejectedValueOnce(new Error("Exclusão recusada"));
    render(<LoansPage />);
    await user.click(screen.getAllByRole("button", { name: "Excluir empréstimo Celular de João" })[0]);
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Exclusão recusada")).toBeInTheDocument();
  });

  it("bloqueia duplo envio durante exclusão", async () => {
    const user = userEvent.setup();
    mocks.detail = detail({ parcelasPagas: 0, pagamentos: [], parcelas: [] });
    mocks.excluirPending = true;
    render(<LoansPage />);
    await user.click(screen.getAllByRole("button", { name: "Excluir empréstimo Celular de João" })[0]);
    expect(screen.getByRole("button", { name: "Excluindo..." })).toBeDisabled();
  });

  it("trata estado vazio e erro da API", () => {
    mocks.loans = [];
    const { rerender } = render(<LoansPage />);
    expect(screen.getByText("Nenhum empréstimo registrado")).toBeInTheDocument();
    mocks.queryError = true;
    rerender(<LoansPage />);
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
  });

  it("mostra erro retornado pela API durante o cadastro", async () => {
    const user = userEvent.setup();
    mocks.criarEmprestimo.mockRejectedValue(new Error("Falha de cadastro"));
    render(<LoansPage />);
    await user.click(screen.getByRole("button", { name: /novo empréstimo/i }));
    await user.selectOptions(screen.getByLabelText("Pessoa"), "contato-joao");
    await user.type(screen.getByLabelText("Descrição"), "Celular");
    await user.selectOptions(screen.getByLabelText("Cartão"), "cartao-1");
    fireEvent.change(screen.getByLabelText("Valor total"), { target: { value: "10000" } });
    await user.click(screen.getByRole("button", { name: /salvar empréstimo/i }));
    expect(await screen.findByText("Falha de cadastro")).toBeInTheDocument();
  });
});

function loan(overrides: Partial<EmprestimoResumo> = {}): EmprestimoResumo { return { id: "loan-1", contatoId: "contato-joao", contatoNome: "João", descricao: "Celular", valorTotal: 1200, valorPago: 0, saldoReceber: 1200, data: "2026-08-20", origemFinanceira: 1, quantidadeParcelas: 3, parcelasPagas: 0, status: 1, isArquivado: false, ...overrides }; }
function detail(overrides: Partial<EmprestimoDetalhe> = {}): EmprestimoDetalhe { return { ...loan({ id: "loan-joao" }), cartaoCreditoId: "cartao-1", contaBancariaId: null, observacao: "Compra para João", criadoEm: "2026-08-20T10:00:00Z", atualizadoEm: "2026-08-20T10:00:00Z", parcelas: [{ id: "parcela-1", numeroParcela: 1, quantidadeTotal: 3, dataVencimento: "2026-08-20", valor: 400, status: 2, dataPagamento: "2026-08-20", pagamentoEmprestimoId: "pagamento-0" }, { id: "parcela-2", numeroParcela: 2, quantidadeTotal: 3, dataVencimento: "2026-09-20", valor: 400, status: 1, dataPagamento: null, pagamentoEmprestimoId: null }, { id: "parcela-3", numeroParcela: 3, quantidadeTotal: 3, dataVencimento: "2026-10-20", valor: 400, status: 1, dataPagamento: null, pagamentoEmprestimoId: null }], pagamentos: [{ id: "pagamento-0", data: "2026-08-20", contaBancariaId: "conta-1", valorTotal: 400, observacao: null, parcelaIds: ["parcela-1"], criadoEm: "2026-08-20T12:00:00Z" }], ...overrides }; }
