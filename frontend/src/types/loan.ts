export const OrigemFinanceiraEmprestimo = {
  CartaoCredito: 1,
  ContaBancaria: 2,
} as const;

export type OrigemFinanceiraEmprestimo =
  (typeof OrigemFinanceiraEmprestimo)[keyof typeof OrigemFinanceiraEmprestimo];

export const StatusEmprestimo = {
  EmAberto: 1,
  ParcialmentePago: 2,
  Pago: 3,
  Cancelado: 4,
} as const;

export type StatusEmprestimo =
  (typeof StatusEmprestimo)[keyof typeof StatusEmprestimo];

export const StatusParcelaEmprestimo = {
  Pendente: 1,
  Paga: 2,
  Cancelada: 3,
} as const;

export type StatusParcelaEmprestimo =
  (typeof StatusParcelaEmprestimo)[keyof typeof StatusParcelaEmprestimo];

export const TipoEmprestimo = {
  Avista: 1,
  Parcelado: 2,
  Fixo: 3,
} as const;

export type TipoEmprestimo =
  (typeof TipoEmprestimo)[keyof typeof TipoEmprestimo];

export const EscopoAlteracaoRecorrenciaEmprestimo = {
  SomenteCompetencia: 1,
  DestaCompetenciaEmDiante: 2,
} as const;

export type ContatoEmprestimo = {
  id: string;
  nome: string;
  observacao: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

export type EmprestimoResumo = {
  id: string;
  contatoId: string;
  contatoNome: string;
  descricao: string;
  valorTotal: number;
  valorPago: number;
  saldoReceber: number;
  data: string;
  tipo?: TipoEmprestimo;
  dataFimRecorrencia?: string | null;
  recorrenciaAtiva?: boolean;
  origemFinanceira: OrigemFinanceiraEmprestimo;
  quantidadeParcelas: number;
  parcelasPagas: number;
  status: StatusEmprestimo;
  isArquivado: boolean;
};

export type EmprestimoMensalItem = EmprestimoResumo & {
  origemNome: string;
  valorCompetencia: number;
  dataCompetencia: string | null;
  numeroParcelaCompetencia: number | null;
  statusCompetencia: StatusParcelaEmprestimo | null;
  proximoVencimento: string | null;
};

export type ResumoMensalEmprestimos = {
  mes: number;
  ano: number;
  aReceberTotal: number;
  previstoNoMes: number;
  recebidoNoMes: number;
  pagina: number;
  tamanhoPagina: number;
  totalItens: number;
  totalPaginas: number;
  itens: EmprestimoMensalItem[];
};

export type ParcelaEmprestimo = {
  id: string;
  numeroParcela: number;
  quantidadeTotal: number;
  competencia?: string;
  dataVencimento: string;
  valor: number;
  status: StatusParcelaEmprestimo;
  dataPagamento: string | null;
  pagamentoEmprestimoId: string | null;
  isVirtual?: boolean;
};

export type PagamentoEmprestimo = {
  id: string;
  data: string;
  contaBancariaId: string | null;
  valorTotal: number;
  observacao: string | null;
  parcelaIds: string[];
  criadoEm: string;
};

export type EmprestimoDetalhe = EmprestimoResumo & {
  cartaoCreditoId: string | null;
  contaBancariaId: string | null;
  observacao: string | null;
  criadoEm: string;
  atualizadoEm: string;
  parcelas: ParcelaEmprestimo[];
  pagamentos: PagamentoEmprestimo[];
  alteracoesRecorrencia?: {
    id: string;
    competencia: string;
    valor: number;
    escopo: 1 | 2;
  }[];
};

export type CriarEmprestimoRequest = {
  contatoId: string;
  descricao: string;
  valorTotal: number;
  data: string;
  tipo?: TipoEmprestimo;
  dataFimRecorrencia?: string | null;
  origemFinanceira: OrigemFinanceiraEmprestimo;
  cartaoCreditoId: string | null;
  contaBancariaId: string | null;
  quantidadeParcelas: number;
  observacao: string | null;
};

export type AtualizarEmprestimoRequest = {
  contatoId: string;
  descricao: string;
  observacao: string | null;
};

export type RegistrarPagamentoEmprestimoRequest = {
  data: string;
  contaBancariaId: string | null;
  parcelaIds: string[];
  competencias?: string[];
  observacao: string | null;
};
