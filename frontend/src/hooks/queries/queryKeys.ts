export const queryKeys = {
  extrato: (
    mes: number,
    ano: number,
    apenasDivididas = false,
    status = "todos",
  ) => ["extrato", mes, ano, apenasDivididas, status] as const,
  extratoPaginado: (
    mes: number,
    ano: number,
    dataInicial: string,
    dataFinal: string,
    pageNumber: number,
    pageSize: number,
    apenasDivididas = false,
    tipoTransacao = "todos",
    categoriaIds: string[] = [],
    statuses: string[] = [],
    ordenarPor = "data",
    direcao = "desc",
  ) =>
    [
      "extrato-paginado",
      mes,
      ano,
      dataInicial,
      dataFinal,
      pageNumber,
      pageSize,
      apenasDivididas,
      tipoTransacao,
      normalizeKeyList(categoriaIds),
      normalizeKeyList(statuses),
      ordenarPor,
      direcao,
    ] as const,
  faturas: (mes: number, ano: number) => ["faturas", mes, ano] as const,
  notificacoesNaoLidas: ["notificacoes", "nao-lidas"] as const,
  categorias: ["categorias"] as const,
  cartoes: ["cartoes"] as const,
  contas: ["contas"] as const,
  distribuicaoContas: ["distribuicao-contas"] as const,
  dashboardInicio: ["dashboard", "inicio"] as const,
  dashboardRelatorios: (mes: number, ano: number, contaBancariaId?: string | null) =>
    ["dashboard", "relatorios", mes, ano, contaBancariaId ?? "todas"] as const,
  relatorios: (dataInicial: string, dataFinal: string) =>
    ["relatorios", dataInicial, dataFinal] as const,
  configuracoesNotificacao: ["notificacoes", "configuracoes"] as const,
};

function normalizeKeyList(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort().join(",");
}
