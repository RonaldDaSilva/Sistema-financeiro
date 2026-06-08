import { api } from './api';
import type {
  CartaoCredito,
  Categoria,
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
  ExtratoMensal,
  FaturaConsolidada,
  TipoTransacaoFiltro,
} from '../types/finance';

export type ExportacaoParams = {
  dataInicial: string;
  dataFinal: string;
  categoriaId?: string | null;
  tipoTransacao?: TipoTransacaoFiltro;
};

export async function getExtratoMensal(mes: number, ano: number) {
  const { data } = await api.get<ExtratoMensal>('/api/transacoes/extrato-mensal', {
    params: { mes, ano },
  });

  return data;
}

export async function getFaturasDoMes(mes: number, ano: number) {
  const { data } = await api.get<FaturaConsolidada[]>('/api/transacoes/faturas-mes', {
    params: { mes, ano },
  });

  return data;
}

export async function criarTransacao(request: CriarTransacaoRequest) {
  const { data } = await api.post('/api/transacoes', request);
  return data;
}

export async function atualizarTransacao(id: string, request: CriarTransacaoRequest) {
  const { data } = await api.put(`/api/transacoes/${id}`, request);
  return data;
}

export async function excluirTransacao(id: string, dataOcorrencia?: string) {
  await api.delete(`/api/transacoes/${id}`, {
    params: dataOcorrencia ? { dataOcorrencia } : undefined,
  });
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

export async function listarCategorias() {
  const { data } = await api.get<Categoria[]>('/api/categorias');
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

export async function listarCartoesCredito() {
  const { data } = await api.get<CartaoCredito[]>('/api/cartoes-credito');
  return data;
}

export async function criarCartaoCredito(request: {
  apelidoCartao: string;
  banco: string;
  diaVencimento: number;
  melhorDiaCompra: number;
  limiteTotal: number;
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
  },
) {
  const { data } = await api.put<CartaoCredito>(`/api/cartoes-credito/${id}`, request);
  return data;
}

export async function excluirCartaoCredito(id: string) {
  await api.delete(`/api/cartoes-credito/${id}`);
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
