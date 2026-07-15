import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("fecha com Escape e devolve o foco ao acionador", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir modal
          </button>
          {open && (
            <Dialog
              title="Teste de diálogo"
              onClose={() => {
                onClose();
                setOpen(false);
              }}
            >
              <button type="button">Ação interna</button>
            </Dialog>
          )}
        </div>
      );
    }

    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Abrir modal" });
    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "Teste de diálogo" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it("mantém o foco preso com Tab e Shift+Tab", async () => {
    const user = userEvent.setup();

    function Harness() {
      const firstRef = useRef<HTMLButtonElement>(null);
      return (
        <Dialog title="Teste de foco" onClose={vi.fn()} initialFocusRef={firstRef}>
          <button ref={firstRef} type="button">Primeiro</button>
          <button type="button">Último</button>
        </Dialog>
      );
    }

    render(<Harness />);

    const first = await screen.findByRole("button", { name: "Primeiro" });
    const last = screen.getByRole("button", { name: "Último" });
    const close = screen.getByRole("button", { name: "Fechar Teste de foco" });

    expect(first).toHaveFocus();

    close.focus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();

    await user.tab();
    expect(close).toHaveFocus();
  });

  it("bloqueia scroll, fecha pelo backdrop e não fecha ao clicar dentro", async () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Teste backdrop" onClose={onClose}>
        <button type="button">Conteúdo</button>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Teste backdrop" });
    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fecha pelo botão acessível e restaura scroll ao desmontar", async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Dialog title="Teste botão" onClose={onClose}>
        <button type="button">Conteúdo</button>
      </Dialog>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fechar Teste botão" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("preenche aria-describedby quando há descrição", () => {
    render(
      <Dialog title="Teste aria" description="Descrição acessível" onClose={vi.fn()}>
        Conteúdo
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Teste aria" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Descrição acessível");
  });

  it("não fecha por Escape, backdrop ou botão quando não é dismissable", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog title="Salvando" onClose={onClose} isDismissable={false}>
        <button type="button">Aguarde</button>
      </Dialog>,
    );

    await user.keyboard("{Escape}");
    fireEvent.mouseDown(screen.getByRole("dialog", { name: "Salvando" }).parentElement!);
    await user.click(screen.getByRole("button", { name: "Fechar Salvando" }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
