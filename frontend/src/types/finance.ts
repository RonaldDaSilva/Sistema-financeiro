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
  contaBancariaId: string | null;
  cartaoCreditoApelido: string | null;
  isFixa: boolean;
  isPaga: boolean;
  statusVisual: 'Paga' | 'Pendente' | 'Atrasada' | string;
  isDividida: boolean;
  valorTotalOriginal: number | null;
  percentualDivisao: number | null;
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
  saldoAtual: number;
  saldoAtualGlobal: number;
  receitasDoMes: number;
  despesasDoMes: number;
  investimentosDoMes: number;
  balancoDoMes: number;
  saldoPrevistoFimDoMes: number;
  resumoDivididas: {
    totalSuaParte: number;
    totalOriginal: number;
  } | null;
  itens: ExtratoMensalItem[];
};

export type PagedResponse<T> = {
  items: T[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
};

export type RelatorioCategoria = {
  categoriaId: string | null;
  categoriaNome: string;
  categoriaCorHexa: string;
  valor: number;
};

export type RelatorioMensal = {
  mes: number;
  ano: number;
  receitas: number;
  despesas: number;
  investimentos: number;
  saldo: number;
};

export type RelatorioGraficos = {
  mes: number;
  ano: number;
  despesasPorCategoria: RelatorioCategoria[];
  saldoAnual: RelatorioMensal[];
  serieFluxo: RelatorioMensal[];
};

export type AnteciparParcelaRequest = {
  idCompraParcelada: string;
  numeroParcela: number;
  dataAntecipacao: string;
  valorPago: number;
  anteciparParcelasFuturas?: boolean;
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
  valorUtilizado: number;
  limiteDisponivel: number;
};

export type ContaBancaria = {
  id: string;
  nomeCustomizado: string;
  codigoBanco: string;
  saldoInicial: number;
  dataCriacao: string;
};

export type ContaDistribuicao = {
  id: string;
  codigoBanco: string;
  nomeCustomizado: string;
  saldoAtual: number;
};

export type ContaBancariaRequest = {
  nomeCustomizado: string;
  codigoBanco: string;
  saldoInicial: number;
};

export type FaturaDetalhe = {
  transacaoId: string | null;
  compraParceladaId: string | null;
  numeroParcela: number | null;
  quantidadeParcelas: number | null;
  dataOcorrencia: string;
  descricao: string;
  valor: number;
  isDividida: boolean;
  valorTotalOriginal: number | null;
  percentualDivisao: number | null;
  categoriaId: string | null;
  categoriaNome: string;
  categoriaCorHexa: string;
  origem: string;
};

export type FaturaConsolidada = {
  cartaoCreditoId: string;
  nomeCartao: string;
  valorTotal: number;
  valorTotalOriginal: number;
  dataVencimento: string;
  inicioCompetencia: string;
  fimCompetencia: string;
  status: string;
  isPaga: boolean;
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
  contaBancariaId?: string | null;
  isFixa: boolean;
  isDividida: boolean;
  valorTotalOriginal?: number | null;
  percentualDivisao?: number | null;
  compraParceladaId?: string | null;
  numeroParcelaQuitada?: number | null;
};

export type CriarCompraParceladaRequest = {
  cartaoCreditoId?: string | null;
  categoriaId: string;
  descricao: string;
  quantidadeParcelas: number;
  valorTotal: number;
  isDividida: boolean;
  valorTotalOriginal?: number | null;
  percentualDivisao?: number | null;
  dataCompra: string;
  dataPrimeiroVencimento?: string | null;
  formaPagamento: 1 | 2 | 'CartaoCredito' | 'Carne';
};

export type TipoTransacaoFiltro = 'todos' | 'receita' | 'despesa' | 'investimento';
export type StatusFiltro = 'todos' | 'pagas' | 'pendentes' | 'atrasadas';
export type CampoOrdenacaoExtrato = 'data' | 'movimentacao' | 'categoria' | 'valor';
export type DirecaoOrdenacao = 'asc' | 'desc';

export type PeriodoFiltro =
  | { tipo: 'dias'; dias: 7 | 15 | 30; tipoTransacao?: TipoTransacaoFiltro; categoriaId?: string | null }
  | { tipo: 'mes'; mes: number; ano: number; tipoTransacao?: TipoTransacaoFiltro; categoriaId?: string | null }
  | { tipo: 'intervalo'; inicio: string; fim: string; tipoTransacao?: TipoTransacaoFiltro; categoriaId?: string | null };
