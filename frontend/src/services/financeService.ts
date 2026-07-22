import axios from 'axios';
import { api } from './api';
import type {
  AnteciparParcelaRequest,
  AjustarSaldoContaRequest,
  CartaoCredito,
  ContaBancaria,
  ContaBancariaRequest,
  ContaDistribuicao,
  Categoria,
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
  DashboardInicio,
  ExtratoMensal,
  ExtratoMensalItem,
  FaturaConsolidada,
  PagedResponse,
  RelatorioGraficos,
  TipoTransacao,
  TipoTransacaoFiltro,
  StatusFiltro,
  TransferenciaContaRequest,
  CampoOrdenacaoExtrato,
  DirecaoOrdenacao,
} from '../types/finance';

export type ExportacaoParams = {
  dataInicial: string;
  dataFinal: string;
  categoriaId?: string | null;
  tipoTransacao?: TipoTransacaoFiltro;
};

export type RelatorioGraficosParams = {
  dataInicial: string;
  dataFinal: string;
  contaBancariaId?: string | null;
  cartaoCreditoId?: string | null;
  categoriaIds?: string[];
  tipoTransacao?: TipoTransacaoFiltro;
  status?: 'todos' | 'realizado' | 'pendente';
  somenteRecorrentes?: boolean;
  somenteParceladas?: boolean;
  secoes?: RelatorioGraficosSecao[];
};

export type RelatorioGraficosSecao =
  | 'resumo'
  | 'projecao'
  | 'previsto'
  | 'evolucao'
  | 'compromissos'
  | 'categorias';

export type DashboardInicioParams = {
  dataInicial?: string;
  dataFinal?: string;
  categoriaIds?: string[];
  tipoTransacao?: TipoTransacaoFiltro;
  statuses?: StatusFiltro[];
};

export async function getExtratoMensal(
  mes: number,
  ano: number,
  apenasDivididas = false,
  status: StatusFiltro = 'todos',
  signal?: AbortSignal,
) {
  const { data } = await api.get<ExtratoMensal>('/api/transacoes/extrato-mensal', {
    params: {
      mes,
      ano,
      apenasDivididas: apenasDivididas || undefined,
      status: normalizarStatusFiltro(status),
    },
    signal,
  });

  return data;
}

export async function getExtratoMensalPaginado(params: {
  mes: number;
  ano: number;
  dataInicial?: string;
  dataFinal?: string;
  pageNumber: number;
  pageSize: number;
  apenasDivididas?: boolean;
  tipo?: TipoTransacao | null;
  categoriaId?: string | null;
  categoriaIds?: string[];
  status?: StatusFiltro;
  statuses?: StatusFiltro[];
  ordenarPor?: CampoOrdenacaoExtrato;
  direcao?: DirecaoOrdenacao;
}, signal?: AbortSignal) {
  const categoriaIds = normalizarLista([
    ...(params.categoriaIds ?? []),
    ...(params.categoriaId ? [params.categoriaId] : []),
  ]);
  const statuses = normalizarStatusLista(
    params.statuses ?? (params.status ? [params.status] : []),
  );

  try {
    const requestParams = new URLSearchParams();
    requestParams.set('mes', String(params.mes));
    requestParams.set('ano', String(params.ano));
    requestParams.set('pageNumber', String(params.pageNumber));
    requestParams.set('pageSize', String(params.pageSize));
    requestParams.set('ordenarPor', params.ordenarPor ?? 'data');
    requestParams.set('direcao', params.direcao ?? 'desc');
    if (params.dataInicial) requestParams.set('dataInicial', params.dataInicial);
    if (params.dataFinal) requestParams.set('dataFinal', params.dataFinal);
    if (params.apenasDivididas) requestParams.set('apenasDivididas', 'true');
    if (params.tipo) requestParams.set('tipo', String(params.tipo));
    categoriaIds.forEach((categoriaId) =>
      requestParams.append('categoriaIds', categoriaId),
    );
    statuses.forEach((status) =>
      requestParams.append('statuses', status),
    );

    const { data } = await api.get<PagedResponse<ExtratoMensalItem>>(
      '/api/transacoes/extrato-mensal/paginado',
      { params: requestParams, signal },
    );

    return data;
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 404) {
      throw error;
    }

    const extrato = await getExtratoMensal(
      params.mes,
      params.ano,
      params.apenasDivididas,
      'todos',
      signal,
    );
    const direcao = params.direcao ?? 'desc';
    const multiplicador = direcao === 'desc' ? -1 : 1;
    const ordenarPor = params.ordenarPor ?? 'data';
    const itensFiltrados = extrato.itens
      .filter((item) => {
        if (params.dataInicial && item.dataOcorrencia < params.dataInicial) {
          return false;
        }

        if (params.dataFinal && item.dataOcorrencia > params.dataFinal) {
          return false;
        }

        if (params.tipo && item.tipo !== params.tipo) {
          return false;
        }

        if (
          categoriaIds.length > 0 &&
          (!item.categoriaId || !categoriaIds.includes(item.categoriaId))
        ) {
          return false;
        }

        if (!aplicarFiltroStatusFallback(item, statuses)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const comparacao =
          ordenarPor === 'movimentacao'
            ? a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' })
            : ordenarPor === 'categoria'
              ? a.categoriaNome.localeCompare(b.categoriaNome, 'pt-BR', { sensitivity: 'base' })
              : ordenarPor === 'valor'
                ? a.valor - b.valor
                : a.dataOcorrencia.localeCompare(b.dataOcorrencia);

        return comparacao * multiplicador ||
          a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' });
      });

    const pageNumber = Math.max(1, params.pageNumber);
    const pageSize = Math.max(1, params.pageSize);
    const totalCount = itensFiltrados.length;

    return {
      items: itensFiltrados.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
      totalCount,
      currentPage: pageNumber,
      pageSize,
      totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
    };
  }
}

export async function getFaturasDoMes(mes: number, ano: number, signal?: AbortSignal) {
  const { data } = await api.get<FaturaConsolidada[]>('/api/transacoes/faturas-mes', {
    params: { mes, ano },
    signal,
  });

  return data;
}

export async function getRelatorioGraficos(params: RelatorioGraficosParams, signal?: AbortSignal) {
  const { data } = await api.get<RelatorioGraficos>('/api/relatorios/graficos', {
    params: {
      dataInicial: params.dataInicial,
      dataFinal: params.dataFinal,
      contaBancariaId: params.contaBancariaId || undefined,
      cartaoCreditoId: params.cartaoCreditoId || undefined,
      categoriaIds: params.categoriaIds?.length ? params.categoriaIds : undefined,
      tipoTransacao:
        params.tipoTransacao && params.tipoTransacao !== 'todos'
          ? ({
              receita: 'Receita',
              despesa: 'Despesa',
              investimento: 'Investimento',
            }[params.tipoTransacao] ?? undefined)
          : undefined,
      status: params.status && params.status !== 'todos' ? params.status : undefined,
      somenteRecorrentes: params.somenteRecorrentes || undefined,
      somenteParceladas: params.somenteParceladas || undefined,
      secoes: params.secoes?.length ? params.secoes : undefined,
    },
    signal,
  });

  return data;
}

export async function getDashboardInicio(
  params: DashboardInicioParams = {},
  signal?: AbortSignal,
) {
  const tipo = params.tipoTransacao === "receita"
    ? 1
    : params.tipoTransacao === "despesa"
      ? 2
      : params.tipoTransacao === "investimento"
        ? 3
        : undefined;
  const requestParams = new URLSearchParams();

  if (params.dataInicial) requestParams.set("dataInicial", params.dataInicial);
  if (params.dataFinal) requestParams.set("dataFinal", params.dataFinal);
  if (tipo) requestParams.set("tipo", String(tipo));
  normalizarLista(params.categoriaIds ?? []).forEach((categoriaId) =>
    requestParams.append("categoriaIds", categoriaId),
  );
  normalizarStatusLista(params.statuses ?? []).forEach((status) =>
    requestParams.append("statuses", status),
  );

  const { data } = await api.get<DashboardInicio>('/api/dashboard/inicio', {
    params: requestParams,
    signal,
  });
  return data;
}

export async function criarTransacao(request: CriarTransacaoRequest) {
  const { data } = await api.post<{ id: string }>('/api/transacoes', request);
  return data;
}

export async function atualizarTransacao(
  id: string,
  request: CriarTransacaoRequest,
  replicarFuturas = true,
) {
  const { data } = await api.put<{ id: string }>(`/api/transacoes/${id}`, request, {
    params: { replicarFuturas },
  });
  return data;
}

export async function excluirTransacao(
  id: string,
  dataOcorrencia?: string,
  replicarFuturas = true,
) {
  await api.delete(`/api/transacoes/${id}`, {
    params: dataOcorrencia ? { dataOcorrencia, replicarFuturas } : { replicarFuturas },
  });
}

export async function anteciparParcela(request: AnteciparParcelaRequest) {
  const { data } = await api.post<
    Array<{
      tipo: TipoTransacao;
      valor: number;
      dataOcorrencia: string;
      isPaga: boolean;
    }>
  >('/api/transacoes/antecipar-parcela', request);
  return data;
}

function normalizarStatusFiltro(status?: StatusFiltro) {
  if (!status || status === 'todos') {
    return undefined;
  }

  return {
    pagas: 'Pagas',
    pendentes: 'Pendentes',
    atrasadas: 'Atrasadas',
  }[status];
}

function normalizarLista(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function normalizarStatusLista(statuses: StatusFiltro[] = []) {
  return [...new Set(statuses)]
    .map(normalizarStatusFiltro)
    .filter((status): status is string => Boolean(status))
    .sort();
}

function aplicarFiltroStatusFallback(
  item: ExtratoMensalItem,
  statuses: string[] = [],
) {
  if (statuses.length === 0) {
    return true;
  }

  if (item.tipo !== 2 && item.tipo !== 'Despesa') {
    return false;
  }

  const visual = item.statusVisual || calcularStatusVisualFallback(item);

  return statuses.some((status) =>
    (status === 'Pagas' && visual === 'Paga') ||
    (status === 'Pendentes' && visual === 'Pendente') ||
    (status === 'Atrasadas' && visual === 'Atrasada'),
  );
}

function calcularStatusVisualFallback(item: ExtratoMensalItem) {
  if (item.isPaga) {
    return 'Paga';
  }

  const hoje = new Date();
  const offset = hoje.getTimezoneOffset();
  const hojeLocal = new Date(hoje.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 10);

  return item.dataOcorrencia < hojeLocal ? 'Atrasada' : 'Pendente';
}

export async function alternarStatusPagamento(
  id: string,
  dataOcorrencia?: string,
  request?: {
    isPaga?: boolean;
    contaBancariaId?: string | null;
  },
) {
  const { data } = await api.patch<{ isPaga: boolean }>(
    `/api/transacoes/${id}/alternar-status`,
    request ?? null,
    { params: dataOcorrencia ? { dataOcorrencia } : undefined },
  );

  return data;
}

export async function alternarStatusFatura(
  cartaoCreditoId: string,
  dataVencimento: string,
  request: {
    confirmarSemSaldo?: boolean;
    contaBancariaId?: string | null;
  } = { confirmarSemSaldo: false },
) {
  const { data } = await api.patch<{ isPaga: boolean }>(
    `/api/transacoes/faturas/${cartaoCreditoId}/alternar-status`,
    request,
    { params: { dataVencimento } },
  );

  return data;
}

export async function criarCompraParcelada(request: CriarCompraParceladaRequest) {
  const { data } = await api.post('/api/compras-parceladas', request);
  return data;
}

export async function atualizarCompraParceladaProjetada(
  id: string,
  numeroParcela: number,
  dataOcorrencia: string,
  request: CriarCompraParceladaRequest,
) {
  const { data } = await api.put(`/api/compras-parceladas/${id}`, request, {
    params: { numeroParcela, dataOcorrencia },
  });

  return data;
}

export async function excluirCompraParceladaProjetada(id: string, numeroParcela: number) {
  await api.delete(`/api/compras-parceladas/${id}`, {
    params: { numeroParcela },
  });
}

export async function listarCategorias(signal?: AbortSignal) {
  const { data } = await api.get<Categoria[]>('/api/categorias', { signal });
  return data;
}

export async function criarCategoria(request: { nome: string }) {
  const { data } = await api.post<Categoria>('/api/categorias', request);
  return data;
}

export async function atualizarCategoria(id: string, request: { nome: string }) {
  const { data } = await api.put<Categoria>(`/api/categorias/${id}`, request);
  return data;
}

export async function excluirCategoria(id: string) {
  await api.delete(`/api/categorias/${id}`);
}

export async function listarCartoesCredito(signal?: AbortSignal) {
  const { data } = await api.get<CartaoCredito[]>('/api/cartoes-credito', { signal });
  return data;
}

export async function criarCartaoCredito(request: {
  apelidoCartao: string;
  banco: string;
  diaVencimento: number;
  melhorDiaCompra: number;
  limiteTotal: number;
  contaBancariaId?: string | null;
}) {
  const { data } = await api.post<CartaoCredito>('/api/cartoes-credito', request);
  return data;
}

export async function atualizarCartaoCredito(
  id: string,
  request: {
    apelidoCartao: string;
    banco: string;
    diaVencimento: number;
    melhorDiaCompra: number;
    limiteTotal: number;
    contaBancariaId?: string | null;
  },
) {
  const { data } = await api.put<CartaoCredito>(`/api/cartoes-credito/${id}`, request);
  return data;
}

export async function excluirCartaoCredito(id: string) {
  await api.delete(`/api/cartoes-credito/${id}`);
}

export async function arquivarCartaoCredito(id: string) {
  const { data } = await api.patch<CartaoCredito>(`/api/cartoes-credito/${id}/arquivar`);
  return data;
}

export async function listarContasBancarias(signal?: AbortSignal) {
  const { data } = await api.get<ContaBancaria[]>('/api/contas', { signal });
  return data;
}

export async function obterDistribuicaoContas(signal?: AbortSignal) {
  const { data } = await api.get<ContaDistribuicao[]>(
    '/api/contas/distribuicao',
    { signal },
  );
  return data;
}

export async function criarContaBancaria(request: ContaBancariaRequest) {
  const { data } = await api.post<ContaBancaria>('/api/contas', request);
  return data;
}

export async function atualizarContaBancaria(
  id: string,
  request: ContaBancariaRequest,
) {
  const { data } = await api.put<ContaBancaria>(`/api/contas/${id}`, request);
  return data;
}

export async function favoritarContaBancaria(id: string) {
  const { data } = await api.patch<ContaBancaria>(`/api/contas/${id}/favoritar`);
  return data;
}

export async function arquivarContaBancaria(id: string) {
  const { data } = await api.patch<ContaBancaria>(`/api/contas/${id}/arquivar`);
  return data;
}

export async function ajustarSaldoContaBancaria(
  id: string,
  request: AjustarSaldoContaRequest,
) {
  const { data } = await api.post<{ id: string; diferenca: number }>(
    `/api/contas/${id}/ajustar-saldo`,
    {
      saldoInformado: request.saldoInformado,
      data: request.dataAjuste,
      observacao: request.observacao,
    },
  );
  return data;
}

export async function transferirEntreContas(request: TransferenciaContaRequest) {
  const { data } = await api.post<{ transferenciaId: string }>('/api/contas/transferir', {
    contaOrigemId: request.contaOrigemId,
    contaDestinoId: request.contaDestinoId,
    valor: request.valor,
    data: request.dataTransferencia,
    descricao: request.descricao,
    confirmarSemSaldo: request.confirmarSemSaldo,
  });
  return data;
}

export async function excluirContaBancaria(id: string) {
  await api.delete(`/api/contas/${id}`);
}

export async function exportarExtratoExcel(params: ExportacaoParams) {
  const { data } = await api.get<Blob>('/api/exportacao/excel', {
    params: normalizarParametrosExportacao(params),
    responseType: 'blob',
  });

  return data;
}

export async function exportarExtratoPdf(params: ExportacaoParams) {
  const { data } = await api.get<Blob>('/api/exportacao/pdf', {
    params: normalizarParametrosExportacao(params),
    responseType: 'blob',
  });

  return data;
}

function normalizarParametrosExportacao(params: ExportacaoParams) {
  return {
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    categoriaId: params.categoriaId || undefined,
    tipoTransacao:
      params.tipoTransacao && params.tipoTransacao !== 'todos'
        ? params.tipoTransacao
        : undefined,
  };
}
