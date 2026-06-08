export type TipoTransacao = 1 | 2 | 3 | 'Receita' | 'Despesa' | 'Investimento';

export type ExtratoMensalItem = {
  id: string | null;
  codigoExibicao: number | null;
  tipo: TipoTransacao;
  descricao: string;
  valor: number;
  dataOcorrencia: string;
  categoriaId: string | null;
  categoriaNome: string;
  categoriaCorHexa: string;
  formaPagamento: string;
  cartaoCreditoId: string | null;
  cartaoCreditoApelido: string | null;
  isFixa: boolean;
  isProjetada: boolean;
  origem: string;
  compraParceladaId: string | null;
  numeroParcela: number | null;
  quantidadeParcelas: number | null;
};

export type ExtratoMensal = {
  mes: number;
  ano: number;
  totalReceitas: number;
  totalDespesas: number;
  totalInvestido: number;
  saldo: number;
  itens: ExtratoMensalItem[];
};

export type Categoria = {
  id: string;
  usuarioId: string | null;
  nome: string;
  corHexa: string;
  isDefault: boolean;
};

export type CartaoCredito = {
  id: string;
  usuarioId: string;
  apelidoCartao: string;
  banco: string;
  diaVencimento: number;
  melhorDiaCompra: number;
  limiteTotal: number;
};

export type FaturaDetalhe = {
  transacaoId: string | null;
  compraParceladaId: string | null;
  numeroParcela: number | null;
  quantidadeParcelas: number | null;
  dataOcorrencia: string;
  descricao: string;
  valor: number;
  categoriaId: string | null;
  categoriaNome: string;
  categoriaCorHexa: string;
  origem: string;
};

export type FaturaConsolidada = {
  cartaoCreditoId: string;
  nomeCartao: string;
  valorTotal: number;
  dataVencimento: string;
  inicioCompetencia: string;
  fimCompetencia: string;
  status: string;
  detalhes: FaturaDetalhe[];
};

export type CriarTransacaoRequest = {
  tipo: 1 | 2 | 3;
  descricao: string;
  valor: number;
  dataOcorrencia: string;
  categoriaId?: string | null;
  formaPagamento: string;
  cartaoCreditoId?: string | null;
  isFixa: boolean;
  compraParceladaId?: string | null;
  numeroParcelaQuitada?: number | null;
};

export type CriarCompraParceladaRequest = {
  cartaoCreditoId?: string | null;
  categoriaId: string;
  descricao: string;
  quantidadeParcelas: number;
  valorTotal: number;
  dataCompra: string;
  dataPrimeiroVencimento?: string | null;
  formaPagamento: 1 | 2 | 'CartaoCredito' | 'Carne';
};

export type TipoTransacaoFiltro = 'todos' | 'receita' | 'despesa' | 'investimento';

export type PeriodoFiltro =
  | { tipo: 'dias'; dias: 7 | 15 | 30; tipoTransacao?: TipoTransacaoFiltro; categoriaId?: string | null }
  | { tipo: 'mes'; mes: number; ano: number; tipoTransacao?: TipoTransacaoFiltro; categoriaId?: string | null }
  | { tipo: 'intervalo'; inicio: string; fim: string; tipoTransacao?: TipoTransacaoFiltro; categoriaId?: string | null };
