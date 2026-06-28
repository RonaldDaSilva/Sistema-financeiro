import axios from 'axios';
import { api } from './api';
import type {
  AnteciparParcelaRequest,
  CartaoCredito,
  ContaBancaria,
  ContaBancariaRequest,
  ContaDistribuicao,
  Categoria,
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
  ExtratoMensal,
  ExtratoMensalItem,
  FaturaConsolidada,
  PagedResponse,
  RelatorioGraficos,
  TipoTransacao,
  TipoTransacaoFiltro,
} from '../types/finance';

export type ExportacaoParams = {
  dataInicial: string;
  dataFinal: string;
  categoriaId?: string | null;
  tipoTransacao?: TipoTransacaoFiltro;
};

export async function getExtratoMensal(
  mes: number,
  ano: number,
  apenasDivididas = false,
) {
  const { data } = await api.get<ExtratoMensal>('/api/transacoes/extrato-mensal', {
    params: { mes, ano, apenasDivididas: apenasDivididas || undefined },
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
}) {
  try {
    const { data } = await api.get<PagedResponse<ExtratoMensalItem>>(
      '/api/transacoes/extrato-mensal/paginado',
      {
        params: {
          mes: params.mes,
          ano: params.ano,
          dataInicial: params.dataInicial,
          dataFinal: params.dataFinal,
          pageNumber: params.pageNumber,
          pageSize: params.pageSize,
          apenasDivididas: params.apenasDivididas || undefined,
          tipo: params.tipo ?? undefined,
          categoriaId: params.categoriaId ?? undefined,
        },
      },
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
    );
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

        if (params.categoriaId && item.categoriaId !== params.categoriaId) {
          return false;
        }

        return true;
      })
      .sort((a, b) =>
        b.dataOcorrencia.localeCompare(a.dataOcorrencia) ||
        a.descricao.localeCompare(b.descricao),
      );

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

export async function getFaturasDoMes(mes: number, ano: number) {
  const { data } = await api.get<FaturaConsolidada[]>('/api/transacoes/faturas-mes', {
    params: { mes, ano },
  });

  return data;
}

export async function getRelatorioGraficos(mes: number, ano: number) {
  try {
    const { data } = await api.get<RelatorioGraficos>('/api/relatorios/graficos', {
      params: { mes, ano },
    });

    return data;
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 404) {
      throw error;
    }

    return getRelatorioGraficosFallback(mes, ano);
  }
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
  const { data } = await api.post('/api/transacoes/antecipar-parcela', request);
  return data;
}

export async function alternarStatusPagamento(id: string, dataOcorrencia?: string) {
  const { data } = await api.patch<{ isPaga: boolean }>(
    `/api/transacoes/${id}/alternar-status`,
    null,
    { params: dataOcorrencia ? { dataOcorrencia } : undefined },
  );

  return data;
}

export async function alternarStatusFatura(
  cartaoCreditoId: string,
  dataVencimento: string,
) {
  const { data } = await api.patch<{ isPaga: boolean }>(
    `/api/transacoes/faturas/${cartaoCreditoId}/alternar-status`,
    null,
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

export async function listarContasBancarias() {
  const { data } = await api.get<ContaBancaria[]>('/api/contas');
  return data;
}

export async function obterDistribuicaoContas() {
  const { data } = await api.get<ContaDistribuicao[]>('/api/contas/distribuicao');
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

async function getRelatorioGraficosFallback(
  mes: number,
  ano: number,
): Promise<RelatorioGraficos> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const mesesFluxo = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(currentYear, currentMonth - 1 - 5 + index, 1);
    return { mes: date.getMonth() + 1, ano: date.getFullYear() };
  });
  const mesesAno = Array.from({ length: 12 }, (_, index) => ({
    mes: index + 1,
    ano,
  }));
  const referenciasUnicas = Array.from(
    new Map(
      [{ mes, ano }, ...mesesFluxo, ...mesesAno].map((referencia) => [
        `${referencia.ano}-${referencia.mes}`,
        referencia,
      ]),
    ).values(),
  );
  const [faturasDoMes, ...extratosUnicos] = await Promise.all([
    getFaturasDoMes(mes, ano),
    ...referenciasUnicas.map((referencia) =>
      getExtratoMensal(referencia.mes, referencia.ano),
    ),
  ]);
  const extratosPorMes = new Map(
    extratosUnicos.map((extrato) => [`${extrato.ano}-${extrato.mes}`, extrato]),
  );
  const extratoMes = extratosPorMes.get(`${ano}-${mes}`);

  if (!extratoMes) {
    throw new Error('Extrato do mês não encontrado.');
  }

  const categorias = new Map<
    string,
    {
      categoriaId: string | null;
      categoriaNome: string;
      categoriaCorHexa: string;
      valor: number;
    }
  >();

  faturasDoMes.flatMap((fatura) => fatura.detalhes).forEach((detalhe) => {
    const key = detalhe.categoriaId ?? 'sem-categoria';
    const current = categorias.get(key) ?? {
      categoriaId: detalhe.categoriaId,
      categoriaNome: detalhe.categoriaNome,
      categoriaCorHexa: detalhe.categoriaCorHexa,
      valor: 0,
    };

    current.valor += detalhe.valor;
    categorias.set(key, current);
  });

  extratoMes.itens
    .filter(
      (item) =>
        (item.tipo === 2 || item.tipo === 'Despesa') &&
        item.origem !== 'FaturaCartao',
    )
    .forEach((item) => {
      const key = item.categoriaId ?? 'sem-categoria';
      const current = categorias.get(key) ?? {
        categoriaId: item.categoriaId,
        categoriaNome: item.categoriaNome,
        categoriaCorHexa: item.categoriaCorHexa,
        valor: 0,
      };

      current.valor += item.valor;
      categorias.set(key, current);
    });

  const toMensal = (referencia: { mes: number; ano: number }) => {
    const extrato = extratosPorMes.get(`${referencia.ano}-${referencia.mes}`);

    return {
      mes: referencia.mes,
      ano: referencia.ano,
      receitas: extrato?.totalReceitas ?? 0,
      despesas: extrato?.totalDespesas ?? 0,
      investimentos: extrato?.totalInvestido ?? 0,
      saldo: extrato?.saldo ?? 0,
    };
  };

  return {
    mes,
    ano,
    despesasPorCategoria: Array.from(categorias.values()).sort(
      (a, b) => b.valor - a.valor,
    ),
    saldoAnual: mesesAno.map(toMensal),
    serieFluxo: mesesFluxo.map(toMensal),
  };
}
