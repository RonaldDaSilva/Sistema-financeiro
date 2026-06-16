export type TipoNotificacao = 1 | 2 | 'Vencimento' | 'MelhorDiaCompra';

export type Notificacao = {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  dataCriacao: string;
  tipoNotificacao: TipoNotificacao;
};

export type ConfiguracoesNotificacao = {
  receberNotificacoes: boolean;
  avisarVencimento: boolean;
  avisarMelhorDia: boolean;
  diasAntecedenciaVencimento: number;
  percentualPadraoDivisao: number;
};
