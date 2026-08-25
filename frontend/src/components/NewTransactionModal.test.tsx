import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewTransactionModal } from "./NewTransactionModal";

vi.mock("./TransactionForm", () => ({
  TransactionForm: () => <div>Conteúdo da transação</div>,
}));

describe("NewTransactionModal", () => {
  it.each([320, 360, 390, 412])("mantém diálogo dentro de 100dvh em %ipx", (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    render(
      <NewTransactionModal
        isOpen
        categorias={[]}
        cartoes={[]}
        contas={[]}
        percentualPadraoDivisao={50}
        onClose={vi.fn()}
        onCreateTransacao={vi.fn()}
        onCreateCompraParcelada={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Adicionar nova transação" });
    expect(dialog).toHaveClass("h-[calc(100dvh-1rem)]", "overflow-hidden");
    expect(screen.getByRole("button", { name: "Fechar Adicionar nova transação" })).toBeVisible();
  });
});
