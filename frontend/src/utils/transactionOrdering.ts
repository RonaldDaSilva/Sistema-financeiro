import type {
  CampoOrdenacaoExtrato,
  DirecaoOrdenacao,
  ExtratoMensalItem,
} from "../types/finance";

export function compareTransactionItems(
  left: ExtratoMensalItem,
  right: ExtratoMensalItem,
  field: CampoOrdenacaoExtrato,
  direction: DirecaoOrdenacao,
) {
  const statusComparison = Number(left.isPaga) - Number(right.isPaga);
  if (statusComparison !== 0) {
    return statusComparison;
  }

  const directionMultiplier = direction === "asc" ? 1 : -1;
  let comparison = 0;

  switch (field) {
    case "movimentacao":
      comparison = compareText(left.descricao, right.descricao);
      break;
    case "categoria":
      comparison = compareText(left.categoriaNome, right.categoriaNome);
      break;
    case "valor":
      comparison = left.valor - right.valor;
      break;
    default:
      comparison = left.dataOcorrencia.localeCompare(right.dataOcorrencia);
      break;
  }

  return comparison * directionMultiplier ||
    compareText(left.descricao, right.descricao) ||
    left.dataOcorrencia.localeCompare(right.dataOcorrencia) ||
    String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

export function sortTransactionItems(
  items: ExtratoMensalItem[],
  field: CampoOrdenacaoExtrato,
  direction: DirecaoOrdenacao,
) {
  return [...items].sort((left, right) =>
    compareTransactionItems(left, right, field, direction));
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "pt-BR", { sensitivity: "base" });
}
