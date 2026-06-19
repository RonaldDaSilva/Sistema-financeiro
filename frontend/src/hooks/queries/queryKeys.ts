export const queryKeys = {
  extrato: (mes: number, ano: number, apenasDivididas = false) =>
    ["extrato", mes, ano, apenasDivididas] as const,
  faturas: (mes: number, ano: number) => ["faturas", mes, ano] as const,
  notificacoesNaoLidas: ["notificacoes", "nao-lidas"] as const,
  categorias: ["categorias"] as const,
  cartoes: ["cartoes"] as const,
  configuracoesNotificacao: ["notificacoes", "configuracoes"] as const,
};
