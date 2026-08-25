import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DivisaoCompartilhada } from "../types/finance";
import { SharedTransactionsList } from "./SharedTransactionsList";

describe("SharedTransactionsList", () => {
  it("renderiza o evento uma vez e preserva os valores dos três participantes", async () => {
    const user = userEvent.setup();
    render(<SharedTransactionsList items={[criarDivisao()]} hiddenValues={false} />);

    expect(screen.getAllByText("Supermercado")).toHaveLength(1);
    expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 400,00")).toHaveLength(2);
    await user.click(screen.getByText("Participantes"));
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 300,00")).toHaveLength(2);
  });

  it("oferece aceitar e recusar apenas para convite pendente do usuário", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const base = criarDivisao();
    const item = criarDivisao({
      meuPapel: "Convidado",
      participantes: base.participantes.map((participante) =>
        participante.souEu ? { ...participante, status: 1 } : participante),
    });
    render(
      <SharedTransactionsList
        items={[item]}
        hiddenValues={false}
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Aceitar" }));
    await user.click(screen.getByRole("button", { name: "Recusar" }));
    expect(onAccept).toHaveBeenCalledWith(item);
    expect(onDecline).toHaveBeenCalledWith(item);
    expect(screen.queryByRole("button", { name: "Cancelar divisão" })).not.toBeInTheDocument();
  });

  it("trata estado vazio", () => {
    render(<SharedTransactionsList items={[]} hiddenValues={false} />);
    expect(screen.getByText("Nenhuma divisão compartilhada neste período.")).toBeInTheDocument();
  });
});

function criarDivisao(overrides: Partial<DivisaoCompartilhada> = {}): DivisaoCompartilhada {
  return {
    divisaoId: "divisao-1",
    descricao: "Supermercado",
    dataReferencia: "2026-08-20",
    valorTotal: 1000,
    valorTotalSerie: 1000,
    minhaParte: 400,
    meuPercentual: 40,
    usuarioCriadorId: "ronald",
    nomeCriador: "Ronald",
    meuPapel: "Criador",
    origem: "Avulsa",
    status: 3,
    quantidadeParcelas: 1,
    parcelaInicial: null,
    parcelaFinal: null,
    quantidadeOcorrenciasPeriodo: 1,
    participanteAtualId: "participante-ronald",
    transacaoLocalId: "transacao-ronald",
    compraParceladaLocalId: null,
    participantes: [
      { id: "participante-ronald", usuarioId: "ronald", nomeExibicao: "Ronald", tipo: 1, percentual: 40, valor: 400, status: 2, souEu: true, ativo: true },
      { id: "participante-ana", usuarioId: "ana", nomeExibicao: "Ana", tipo: 2, percentual: 30, valor: 300, status: 2, souEu: false, ativo: true },
      { id: "participante-joao", usuarioId: "joao", nomeExibicao: "João", tipo: 2, percentual: 30, valor: 300, status: 2, souEu: false, ativo: true },
    ],
    ...overrides,
  };
}
