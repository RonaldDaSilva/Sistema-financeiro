export type TipoNotificacao =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 'Vencimento'
  | 'MelhorDiaCompra'
  | 'DivisaoRecebida'
  | 'DivisaoAceita'
  | 'DivisaoRecusada'
  | 'DivisaoExpirada'
  | 'DivisaoCancelada'
  | 'DivisaoAlterada'
  | 'AlteracaoDivisaoAceita'
  | 'AlteracaoDivisaoRecusada';

export type Notificacao = {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  dataCriacao: string;
  tipoNotificacao: TipoNotificacao;
  entidade?: string | null;
  entidadeId?: string | null;
  participanteDivisaoId?: string | null;
  rota?: string | null;
  acaoPendente?: string | null;
  versao?: number | null;
};

export type ConfiguracoesNotificacao = {
  receberNotificacoes: boolean;
  avisarVencimento: boolean;
  avisarMelhorDia: boolean;
  diasAntecedenciaVencimento: number;
  percentualPadraoDivisao: number;
};
