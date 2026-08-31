import { describe, expect, it } from "vitest";
import type { ExtratoMensalItem } from "../types/finance";
import { sortTransactionItems } from "./transactionOrdering";

describe("transactionOrdering", () => {
  const items = [
    createItem("Pendente 01", "2026-09-01", false),
    createItem("Paga 02", "2026-09-02", true),
    createItem("Pendente 05", "2026-09-05", false),
    createItem("Paga 08", "2026-09-08", true),
    createItem("Pendente 10", "2026-09-10", false),
  ];

  it("mantém pendentes primeiro e data crescente dentro de cada grupo", () => {
    expect(sortTransactionItems(items, "data", "asc").map((item) => item.descricao)).toEqual([
      "Pendente 01", "Pendente 05", "Pendente 10", "Paga 02", "Paga 08",
    ]);
  });

  it("mantém pendentes primeiro e data decrescente dentro de cada grupo", () => {
    expect(sortTransactionItems(items, "data", "desc").map((item) => item.descricao)).toEqual([
      "Pendente 10", "Pendente 05", "Pendente 01", "Paga 08", "Paga 02",
    ]);
  });

  it("reposiciona corretamente ao marcar e desmarcar como paga", () => {
    const paga = items.map((item) =>
      item.descricao === "Pendente 05" ? { ...item, isPaga: true } : item);
    expect(sortTransactionItems(paga, "data", "asc").map((item) => item.descricao)).toEqual([
      "Pendente 01", "Pendente 10", "Paga 02", "Pendente 05", "Paga 08",
    ]);

    const pendente = items.map((item) =>
      item.descricao === "Paga 08" ? { ...item, isPaga: false } : item);
    expect(sortTransactionItems(pendente, "data", "asc").map((item) => item.descricao)).toEqual([
      "Pendente 01", "Pendente 05", "Paga 08", "Pendente 10", "Paga 02",
    ]);
  });

  it("ordena normalmente quando o filtro já contém somente um status", () => {
    const pagas = items.filter((item) => item.isPaga);
    const pendentes = items.filter((item) => !item.isPaga);
    expect(sortTransactionItems(pagas, "data", "desc").map((item) => item.dataOcorrencia))
      .toEqual(["2026-09-08", "2026-09-02"]);
    expect(sortTransactionItems(pendentes, "data", "asc").map((item) => item.dataOcorrencia))
      .toEqual(["2026-09-01", "2026-09-05", "2026-09-10"]);
  });

  it("aplica a mesma regra sem alterar dados de parcelas, fixas ou compartilhadas", () => {
    const parcelaPaga = createItem("Parcela 1/2", "2026-09-01", true, {
      compraParceladaId: "compra-1", numeroParcela: 1,
    });
    const fixaPendente = createItem("Aluguel", "2026-09-05", false, { isFixa: true });
    const compartilhadaPendente = createItem("Mercado", "2026-09-03", false, {
      isDividida: true, valor: 120, valorTotalOriginal: 300, divisaoTransacaoId: "divisao-1",
    });

    const result = sortTransactionItems(
      [parcelaPaga, fixaPendente, compartilhadaPendente], "data", "asc");

    expect(result.map((item) => item.descricao)).toEqual(["Mercado", "Aluguel", "Parcela 1/2"]);
    expect(result.find((item) => item.descricao === "Mercado")).toMatchObject({
      valor: 120, valorTotalOriginal: 300, divisaoTransacaoId: "divisao-1",
    });
  });
});

function createItem(
  descricao: string,
  dataOcorrencia: string,
  isPaga: boolean,
  overrides: Partial<ExtratoMensalItem> = {},
): ExtratoMensalItem {
  return {
    id: descricao,
    codigoExibicao: null,
    tipo: "Despesa",
    descricao,
    valor: 100,
    dataOcorrencia,
    categoriaId: null,
    categoriaNome: "Sem categoria",
    categoriaCorHexa: "#000000",
    formaPagamento: "Pix",
    cartaoCreditoId: null,
    contaBancariaId: null,
    cartaoCreditoApelido: null,
    isFixa: false,
    isPaga,
    statusVisual: isPaga ? "Paga" : "Pendente",
    isDividida: false,
    valorTotalOriginal: null,
    percentualDivisao: null,
    isProjetada: false,
    origem: "Transacao",
    compraParceladaId: null,
    numeroParcela: null,
    quantidadeParcelas: null,
    ...overrides,
  };
}
