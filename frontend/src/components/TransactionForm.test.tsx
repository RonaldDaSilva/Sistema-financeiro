import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionForm } from "./TransactionForm";
import type { CartaoCredito, Categoria, ContaBancaria } from "../types/finance";

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
  return render(
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
    />,
  );
}

describe("TransactionForm", () => {
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
});
