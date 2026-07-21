import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InfoTooltip } from "./InfoTooltip";

describe("InfoTooltip", () => {
  it("abre por hover e conecta aria-describedby", async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label="Receitas realizadas">Texto explicativo</InfoTooltip>);

    const trigger = screen.getByRole("button", { name: "Ajuda: Receitas realizadas" });
    await user.hover(trigger);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Texto explicativo");
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);

    await user.unhover(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("abre por foco e fecha com Escape", async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label="Saldo atual">Valor efetivo nas contas</InfoTooltip>);

    await user.tab();

    const trigger = screen.getByRole("button", { name: "Ajuda: Saldo atual" });
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Valor efetivo nas contas");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("abre por toque ou clique em dispositivos móveis", async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label="Cenário com receitas previstas">Simulação secundária</InfoTooltip>);

    await user.click(screen.getByRole("button", { name: "Ajuda: Cenário com receitas previstas" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Simulação secundária");
  });
});
