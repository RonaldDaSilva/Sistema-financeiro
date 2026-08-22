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
  origemFinanceira: OrigemFinanceiraEmprestimo;
  quantidadeParcelas: number;
  parcelasPagas: number;
  status: StatusEmprestimo;
  isArquivado: boolean;
};

export type ParcelaEmprestimo = {
  id: string;
  numeroParcela: number;
  quantidadeTotal: number;
  dataVencimento: string;
  valor: number;
  status: StatusParcelaEmprestimo;
  dataPagamento: string | null;
  pagamentoEmprestimoId: string | null;
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
};

export type CriarEmprestimoRequest = {
  contatoId: string;
  descricao: string;
  valorTotal: number;
  data: string;
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
  observacao: string | null;
};
