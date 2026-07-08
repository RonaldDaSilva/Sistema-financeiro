using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Dtos;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Transacoes;

public sealed class TransacaoService : ITransacaoService
{
    private readonly AppDbContext _dbContext;

    public TransacaoService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ExtratoMensalResponse> GetExtratoMensalAsync(
        int mes,
        int ano,
        Guid usuarioId,
        bool? apenasDivididas = null,
        StatusFiltro? status = null,
        CancellationToken cancellationToken = default)
    {
        if (mes is < 1 or > 12)
        {
            throw new ArgumentOutOfRangeException(nameof(mes), "O mês deve estar entre 1 e 12.");
        }

        if (ano < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(ano), "O ano deve ser válido.");
        }

        var inicioMes = new DateOnly(ano, mes, 1);
        var fimMes = inicioMes.AddMonths(1).AddDays(-1);

        var transacoesDoMes = await ProjetarTransacoesParaLeitura(
                _dbContext.Transacoes.AsNoTracking().AsSingleQuery())
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.DataOcorrencia >= inicioMes &&
                transacao.DataOcorrencia <= fimMes)
            .ToListAsync(cancellationToken);

        var transacoesFixas = await ProjetarTransacoesParaLeitura(
                _dbContext.Transacoes.AsNoTracking().AsSingleQuery())
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.IsFixa &&
                transacao.DataOcorrencia < inicioMes)
            .ToListAsync(cancellationToken);

        var transacoesFixasIds = transacoesFixas
            .Select(transacao => transacao.Id)
            .Concat(transacoesDoMes
                .Where(transacao => transacao.IsFixa)
                .Select(transacao => transacao.Id))
            .Distinct()
            .ToList();
        var excecoesFixas = await _dbContext.TransacoesFixasExcecoes
            .AsNoTracking()
            .Where(excecao =>
                excecao.UsuarioId == usuarioId &&
                transacoesFixasIds.Contains(excecao.TransacaoFixaId) &&
                excecao.DataOcorrencia >= inicioMes &&
                excecao.DataOcorrencia <= fimMes)
            .Select(excecao => new
            {
                excecao.TransacaoFixaId,
                excecao.DataOcorrencia
            })
            .ToListAsync(cancellationToken);

        var excecoesFixasSet = excecoesFixas
            .Select(excecao => (excecao.TransacaoFixaId, excecao.DataOcorrencia))
            .ToHashSet();

        var pagamentosFixas = await _dbContext.TransacoesFixasPagamentos
            .AsNoTracking()
            .Where(pagamento =>
                pagamento.UsuarioId == usuarioId &&
                transacoesFixasIds.Contains(pagamento.TransacaoFixaId) &&
                pagamento.DataOcorrencia >= inicioMes &&
                pagamento.DataOcorrencia <= fimMes)
            .Select(pagamento => new
            {
                pagamento.TransacaoFixaId,
                pagamento.DataOcorrencia,
                pagamento.IsPaga
            })
            .ToListAsync(cancellationToken);

        var pagamentosFixasMap = pagamentosFixas.ToDictionary(
            pagamento => (pagamento.TransacaoFixaId, pagamento.DataOcorrencia),
            pagamento => pagamento.IsPaga);

        var comprasCarne = await ProjetarComprasParaLeitura(
                _dbContext.ComprasParceladas.AsNoTracking().AsSingleQuery())
            .Where(compra =>
                compra.UsuarioId == usuarioId &&
                compra.FormaPagamento == FormaPagamentoCompraParcelada.Carne &&
                compra.DataPrimeiroVencimento.HasValue &&
                compra.DataPrimeiroVencimento.Value <= fimMes)
            .ToListAsync(cancellationToken);

        var comprasCarneIds = comprasCarne.Select(compra => compra.Id).ToList();
        var parcelasCarneQuitadas = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CompraParceladaId.HasValue &&
                comprasCarneIds.Contains(transacao.CompraParceladaId.Value) &&
                transacao.NumeroParcelaQuitada.HasValue)
            .Select(transacao => new
            {
                CompraParceladaId = transacao.CompraParceladaId!.Value,
                NumeroParcela = transacao.NumeroParcelaQuitada!.Value
            })
            .ToListAsync(cancellationToken);

        var parcelasCarneQuitadasSet = parcelasCarneQuitadas
            .Select(parcela => (parcela.CompraParceladaId, parcela.NumeroParcela))
            .ToHashSet();

        var itens = new List<ExtratoMensalItemResponse>();

        itens.AddRange(transacoesDoMes
            .Where(transacao =>
                transacao.CartaoCreditoId is null ||
                (transacao.CompraParceladaId.HasValue && transacao.NumeroParcelaQuitada.HasValue))
            .Select(transacao => MapearTransacaoReal(transacao, pagamentosFixasMap)));
        itens.AddRange(transacoesFixas
            .Where(transacao => transacao.CartaoCreditoId is null)
            .Select(transacao => ProjetarTransacaoFixa(transacao, inicioMes, pagamentosFixasMap))
            .Where(item => !excecoesFixasSet.Contains((item.Id!.Value, item.DataOcorrencia))));
        itens.AddRange(ProjetarParcelasCarneParaExtrato(
            comprasCarne,
            inicioMes,
            fimMes,
            parcelasCarneQuitadasSet));

        var faturas = await GetFaturasDoMesAsync(mes, ano, usuarioId, cancellationToken);
        if (apenasDivididas == true)
        {
            itens.AddRange(faturas.SelectMany(fatura =>
                fatura.Detalhes
                    .Where(detalhe => detalhe.IsDividida)
                    .Select(detalhe => MapearDetalheFaturaParaExtrato(fatura, detalhe))));
        }
        else
        {
            itens.AddRange(faturas
                .Where(fatura => fatura.ValorTotal > 0)
                .Select(MapearFaturaParaExtrato));
        }

        var itensOrdenados = itens
            .OrderBy(item => item.DataOcorrencia)
            .ThenBy(item => item.IsProjetada)
            .ThenBy(item => item.Descricao)
            .ToList();
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        PreencherStatusVisual(itensOrdenados, hoje);
        itensOrdenados = AplicarFiltroStatus(itensOrdenados, status, hoje).ToList();

        ResumoDivididasResponse? resumoDivididas = null;
        if (apenasDivididas == true)
        {
            var despesasDivididasRaiz = itensOrdenados
                .Where(item =>
                    item.IsDividida &&
                    item.Origem != "FaturaCartao")
                .ToList();

            resumoDivididas = new ResumoDivididasResponse
            {
                TotalSuaParte = despesasDivididasRaiz.Sum(item => item.Valor),
                TotalOriginal = despesasDivididasRaiz.Sum(item => item.ValorTotalOriginal ?? item.Valor)
            };

            itensOrdenados = despesasDivididasRaiz;
        }

        var receitasDoMes = itensOrdenados
            .Where(item => item.Tipo == TipoTransacao.Receita)
            .Sum(item => item.Valor);

        var despesasDoMes = itensOrdenados
            .Where(item => item.Tipo == TipoTransacao.Despesa)
            .Sum(item => item.Valor);
        var investimentosDoMes = itensOrdenados
            .Where(item => item.Tipo == TipoTransacao.Investimento)
            .Sum(item => item.Valor);
        var saldoAtualGlobal = await CalcularSaldoAtualGlobalAsync(usuarioId, hoje, cancellationToken);
        var transacoesFuturasNaoPagasDoMes = itensOrdenados
            .Where(item =>
                item.DataOcorrencia > hoje &&
                item.Tipo != TipoTransacao.Receita &&
                !item.IsPaga)
            .ToList();
        var balancoDoMes = receitasDoMes - despesasDoMes - investimentosDoMes;
        var saldoPrevistoFimDoMes = saldoAtualGlobal - transacoesFuturasNaoPagasDoMes
            .Where(item => item.Tipo is TipoTransacao.Despesa or TipoTransacao.Investimento)
            .Sum(item => item.Valor);

        return new ExtratoMensalResponse
        {
            Mes = mes,
            Ano = ano,
            TotalReceitas = receitasDoMes,
            TotalDespesas = despesasDoMes,
            TotalInvestido = investimentosDoMes,
            Saldo = balancoDoMes,
            SaldoAtual = saldoAtualGlobal,
            SaldoAtualGlobal = saldoAtualGlobal,
            ReceitasDoMes = receitasDoMes,
            DespesasDoMes = despesasDoMes,
            InvestimentosDoMes = investimentosDoMes,
            BalancoDoMes = balancoDoMes,
            SaldoPrevistoFimDoMes = saldoPrevistoFimDoMes,
            ResumoDivididas = resumoDivididas,
            Itens = itensOrdenados
        };
    }

    public async Task<PagedResponse<ExtratoMensalItemResponse>> GetExtratoMensalPaginadoAsync(
        ExtratoPaginadoRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, request.PageNumber);
        var pageSize = Math.Clamp(request.PageSize, 5, 100);
        var dataInicial = request.DataInicial;
        var dataFinal = request.DataFinal;

        if (dataInicial.HasValue && dataFinal.HasValue && dataFinal.Value < dataInicial.Value)
        {
            throw new ArgumentOutOfRangeException(nameof(request.DataFinal), "A data final deve ser maior ou igual à data inicial.");
        }

        var meses = dataInicial.HasValue && dataFinal.HasValue
            ? EnumerarMeses(dataInicial.Value, dataFinal.Value)
                .Select(data => (Mes: data.Month, Ano: data.Year))
                .Distinct()
                .ToList()
            : [(request.Mes, request.Ano)];

        var itens = new List<ExtratoMensalItemResponse>();
        foreach (var referencia in meses)
        {
            var extrato = await GetExtratoMensalAsync(
                referencia.Mes,
                referencia.Ano,
                usuarioId,
                request.ApenasDivididas,
                cancellationToken: cancellationToken);

            if (request.CategoriaId.HasValue && request.ApenasDivididas != true)
            {
                itens.AddRange(extrato.Itens.Where(item => item.Origem != "FaturaCartao"));

                var faturasDoMes = await GetFaturasDoMesAsync(
                    referencia.Mes,
                    referencia.Ano,
                    usuarioId,
                    cancellationToken);

                itens.AddRange(faturasDoMes.SelectMany(fatura =>
                    fatura.Detalhes
                        .Where(detalhe => detalhe.CategoriaId == request.CategoriaId.Value)
                        .Select(detalhe => MapearDetalheFaturaParaExtrato(fatura, detalhe))));
            }
            else
            {
                itens.AddRange(extrato.Itens);
            }
        }

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        PreencherStatusVisual(itens, hoje);
        var itensFiltrados = itens.AsEnumerable();

        if (dataInicial.HasValue)
        {
            itensFiltrados = itensFiltrados.Where(item =>
                item.DataOcorrencia >= dataInicial.Value ||
                ((request.ApenasDivididas == true || request.CategoriaId.HasValue) &&
                    item.FormaPagamento == "Cartão de crédito"));
        }

        if (dataFinal.HasValue)
        {
            itensFiltrados = itensFiltrados.Where(item =>
                item.DataOcorrencia <= dataFinal.Value ||
                ((request.ApenasDivididas == true || request.CategoriaId.HasValue) &&
                    item.FormaPagamento == "Cartão de crédito"));
        }

        if (request.Tipo.HasValue)
        {
            itensFiltrados = itensFiltrados.Where(item => item.Tipo == request.Tipo.Value);
        }

        if (request.CategoriaId.HasValue)
        {
            itensFiltrados = itensFiltrados.Where(item => item.CategoriaId == request.CategoriaId.Value);
        }

        itensFiltrados = AplicarFiltroStatus(itensFiltrados, request.Status, hoje);

        var descendente = string.Equals(
            request.Direcao,
            "desc",
            StringComparison.OrdinalIgnoreCase);
        var ordenarPor = request.OrdenarPor.Trim().ToLowerInvariant();

        var itensOrdenados = ordenarPor switch
        {
            "movimentacao" => descendente
                ? itensFiltrados.OrderByDescending(
                    item => item.Descricao,
                    StringComparer.OrdinalIgnoreCase)
                : itensFiltrados.OrderBy(
                    item => item.Descricao,
                    StringComparer.OrdinalIgnoreCase),
            "categoria" => descendente
                ? itensFiltrados.OrderByDescending(
                    item => item.CategoriaNome,
                    StringComparer.OrdinalIgnoreCase)
                : itensFiltrados.OrderBy(
                    item => item.CategoriaNome,
                    StringComparer.OrdinalIgnoreCase),
            "valor" => descendente
                ? itensFiltrados.OrderByDescending(item => item.Valor)
                : itensFiltrados.OrderBy(item => item.Valor),
            _ => descendente
                ? itensFiltrados.OrderByDescending(item => item.DataOcorrencia)
                : itensFiltrados.OrderBy(item => item.DataOcorrencia)
        };
        var itensOrdenadosLista = itensOrdenados
            .ThenBy(item => item.Descricao, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var totalCount = itensOrdenadosLista.Count;

        return new PagedResponse<ExtratoMensalItemResponse>
        {
            Items = itensOrdenadosLista
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList(),
            TotalCount = totalCount,
            CurrentPage = pageNumber,
            PageSize = pageSize,
            TotalPages = totalCount == 0
                ? 0
                : (int)Math.Ceiling(totalCount / (double)pageSize)
        };
    }

    private static IEnumerable<ExtratoMensalItemResponse> AplicarFiltroStatus(
        IEnumerable<ExtratoMensalItemResponse> itens,
        StatusFiltro? status,
        DateOnly hoje)
    {
        return status switch
        {
            StatusFiltro.Pagas => itens.Where(item =>
                item.Tipo == TipoTransacao.Despesa &&
                item.IsPaga),
            StatusFiltro.Pendentes => itens.Where(item =>
                item.Tipo == TipoTransacao.Despesa &&
                !item.IsPaga &&
                item.DataOcorrencia >= hoje),
            StatusFiltro.Atrasadas => itens.Where(item =>
                item.Tipo == TipoTransacao.Despesa &&
                !item.IsPaga &&
                item.DataOcorrencia < hoje),
            _ => itens
        };
    }

    private static void PreencherStatusVisual(
        IEnumerable<ExtratoMensalItemResponse> itens,
        DateOnly hoje)
    {
        foreach (var item in itens)
        {
            item.StatusVisual = CalcularStatusVisual(item.IsPaga, item.DataOcorrencia, hoje);
        }
    }

    private static string CalcularStatusVisual(bool isPaga, DateOnly dataOcorrencia, DateOnly hoje)
    {
        if (isPaga)
        {
            return "Paga";
        }

        return dataOcorrencia < hoje ? "Atrasada" : "Pendente";
    }

    public async Task<IReadOnlyList<FaturaConsolidadaResponse>> GetFaturasDoMesAsync(
        int mes,
        int ano,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        if (mes is < 1 or > 12)
        {
            throw new ArgumentOutOfRangeException(nameof(mes), "O mês deve estar entre 1 e 12.");
        }

        if (ano < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(ano), "O ano deve ser válido.");
        }

        var cartoes = await _dbContext.CartoesCredito
            .AsNoTracking()
            .Where(cartao => cartao.UsuarioId == usuarioId)
            .OrderBy(cartao => cartao.ApelidoCartao)
            .ToListAsync(cancellationToken);

        if (cartoes.Count == 0)
        {
            return [];
        }

        var menorInicioCompetencia = cartoes
            .Select(cartao => CalcularPeriodoFatura(cartao, mes, ano).InicioCompetencia)
            .Min();
        var maiorFimCompetencia = cartoes
            .Select(cartao => CalcularPeriodoFatura(cartao, mes, ano).FimCompetencia)
            .Max();

        var transacoesCredito = await ProjetarTransacoesParaLeitura(
                _dbContext.Transacoes.AsNoTracking().AsSingleQuery())
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CartaoCreditoId.HasValue &&
                transacao.Tipo == TipoTransacao.Despesa &&
                !transacao.CompraParceladaId.HasValue &&
                transacao.DataOcorrencia >= menorInicioCompetencia &&
                transacao.DataOcorrencia <= maiorFimCompetencia)
            .ToListAsync(cancellationToken);

        var transacoesFixasCredito = await ProjetarTransacoesParaLeitura(
                _dbContext.Transacoes.AsNoTracking().AsSingleQuery())
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CartaoCreditoId.HasValue &&
                transacao.Tipo == TipoTransacao.Despesa &&
                transacao.IsFixa &&
                transacao.DataOcorrencia <= maiorFimCompetencia)
            .ToListAsync(cancellationToken);

        var transacoesFixasCreditoIds = transacoesFixasCredito
            .Select(transacao => transacao.Id)
            .ToList();
        var excecoesFixasCredito = await _dbContext.TransacoesFixasExcecoes
            .AsNoTracking()
            .Where(excecao =>
                excecao.UsuarioId == usuarioId &&
                transacoesFixasCreditoIds.Contains(excecao.TransacaoFixaId) &&
                excecao.DataOcorrencia >= menorInicioCompetencia &&
                excecao.DataOcorrencia <= maiorFimCompetencia)
            .Select(excecao => new
            {
                excecao.TransacaoFixaId,
                excecao.DataOcorrencia
            })
            .ToListAsync(cancellationToken);

        var excecoesFixasCreditoSet = excecoesFixasCredito
            .Select(excecao => (excecao.TransacaoFixaId, excecao.DataOcorrencia))
            .ToHashSet();

        var comprasParceladas = await ProjetarComprasParaLeitura(
                _dbContext.ComprasParceladas.AsNoTracking().AsSingleQuery())
            .Where(compra =>
                compra.UsuarioId == usuarioId &&
                compra.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito &&
                compra.CartaoCreditoId.HasValue &&
                compra.DataCompra <= maiorFimCompetencia)
            .ToListAsync(cancellationToken);

        var comprasIds = comprasParceladas.Select(compra => compra.Id).ToList();
        var parcelasQuitadas = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CompraParceladaId.HasValue &&
                comprasIds.Contains(transacao.CompraParceladaId.Value) &&
                transacao.NumeroParcelaQuitada.HasValue)
            .Select(transacao => new
            {
                CompraParceladaId = transacao.CompraParceladaId!.Value,
                NumeroParcela = transacao.NumeroParcelaQuitada!.Value
            })
            .ToListAsync(cancellationToken);

        var parcelasQuitadasSet = parcelasQuitadas
            .Select(parcela => (parcela.CompraParceladaId, parcela.NumeroParcela))
            .ToHashSet();

        var datasVencimento = cartoes
            .Select(cartao => CalcularPeriodoFatura(cartao, mes, ano).DataVencimento)
            .Distinct()
            .ToList();

        var pagamentosFaturas = await _dbContext.FaturasCartaoPagamentos
            .AsNoTracking()
            .Where(pagamento =>
                pagamento.UsuarioId == usuarioId &&
                datasVencimento.Contains(pagamento.DataVencimento))
            .ToListAsync(cancellationToken);

        var pagamentosFaturasMap = pagamentosFaturas.ToDictionary(
            pagamento => (pagamento.CartaoCreditoId, pagamento.DataVencimento),
            pagamento => pagamento.IsPaga);
        var hoje = DateOnly.FromDateTime(DateTime.Today);

        return cartoes
            .Select(cartao =>
            {
                var periodo = CalcularPeriodoFatura(cartao, mes, ano);
                var detalhes = new List<FaturaDetalheResponse>();

                detalhes.AddRange(transacoesCredito
                    .Where(transacao =>
                        transacao.CartaoCreditoId == cartao.Id &&
                        transacao.DataOcorrencia >= periodo.InicioCompetencia &&
                        transacao.DataOcorrencia <= periodo.FimCompetencia)
                    .Select(MapearTransacaoParaDetalheFatura));

                detalhes.AddRange(ProjetarTransacoesFixasCreditoParaFatura(
                    transacoesFixasCredito,
                    cartao.Id,
                    periodo.InicioCompetencia,
                    periodo.FimCompetencia,
                    excecoesFixasCreditoSet));

                detalhes.AddRange(ProjetarParcelasParaFatura(
                    comprasParceladas,
                    cartao.Id,
                    periodo.InicioCompetencia,
                    periodo.FimCompetencia,
                    parcelasQuitadasSet));

                var detalhesOrdenados = detalhes
                    .OrderBy(detalhe => detalhe.DataOcorrencia)
                    .ThenBy(detalhe => detalhe.Descricao)
                    .ToList();

                return new FaturaConsolidadaResponse
                {
                    CartaoCreditoId = cartao.Id,
                    NomeCartao = cartao.ApelidoCartao,
                    ValorTotal = detalhesOrdenados.Sum(detalhe => detalhe.Valor),
                    ValorTotalOriginal = detalhesOrdenados.Sum(detalhe =>
                        detalhe.IsDividida && detalhe.ValorTotalOriginal.HasValue
                            ? detalhe.ValorTotalOriginal.Value
                            : detalhe.Valor),
                    DataVencimento = periodo.DataVencimento,
                    InicioCompetencia = periodo.InicioCompetencia,
                    FimCompetencia = periodo.FimCompetencia,
                    Status = CalcularStatusFatura(periodo.DataVencimento, periodo.FimCompetencia),
                    IsPaga = pagamentosFaturasMap.TryGetValue((cartao.Id, periodo.DataVencimento), out var isPaga)
                        ? isPaga
                        : periodo.DataVencimento <= hoje,
                    Detalhes = detalhesOrdenados
                };
            })
            .ToList();
    }

    private static decimal CalcularSaldo(IEnumerable<ExtratoMensalItemResponse> itens)
    {
        var totalReceitas = itens
            .Where(item => item.Tipo == TipoTransacao.Receita)
            .Sum(item => item.Valor);
        var totalDespesas = itens
            .Where(item => item.Tipo == TipoTransacao.Despesa)
            .Sum(item => item.Valor);
        var totalInvestido = itens
            .Where(item => item.Tipo == TipoTransacao.Investimento)
            .Sum(item => item.Valor);

        return totalReceitas - totalDespesas - totalInvestido;
    }

    private static IQueryable<Transacao> ProjetarTransacoesParaLeitura(
        IQueryable<Transacao> query)
    {
        return query.Select(transacao => new Transacao
        {
            Id = transacao.Id,
            CodigoExibicao = transacao.CodigoExibicao,
            UsuarioId = transacao.UsuarioId,
            Tipo = transacao.Tipo,
            Descricao = transacao.Descricao,
            Valor = transacao.Valor,
            DataOcorrencia = transacao.DataOcorrencia,
            CategoriaId = transacao.CategoriaId,
            FormaPagamento = transacao.FormaPagamento,
            CartaoCreditoId = transacao.CartaoCreditoId,
            ContaBancariaId = transacao.ContaBancariaId,
            IsFixa = transacao.IsFixa,
            IsPaga = transacao.IsPaga,
            IsDividida = transacao.IsDividida,
            ValorTotalOriginal = transacao.ValorTotalOriginal,
            PercentualDivisao = transacao.PercentualDivisao,
            CompraParceladaId = transacao.CompraParceladaId,
            NumeroParcelaQuitada = transacao.NumeroParcelaQuitada,
            Categoria = transacao.Categoria == null
                ? null
                : new Categoria
                {
                    Id = transacao.Categoria.Id,
                    Nome = transacao.Categoria.Nome,
                    CorHexa = transacao.Categoria.CorHexa
                },
            CartaoCredito = transacao.CartaoCredito == null
                ? null
                : new CartaoCredito
                {
                    Id = transacao.CartaoCredito.Id,
                    ApelidoCartao = transacao.CartaoCredito.ApelidoCartao
                }
        });
    }

    private static IQueryable<CompraParcelada> ProjetarComprasParaLeitura(
        IQueryable<CompraParcelada> query)
    {
        return query.Select(compra => new CompraParcelada
        {
            Id = compra.Id,
            UsuarioId = compra.UsuarioId,
            CartaoCreditoId = compra.CartaoCreditoId,
            CategoriaId = compra.CategoriaId,
            Descricao = compra.Descricao,
            QuantidadeParcelas = compra.QuantidadeParcelas,
            ValorTotal = compra.ValorTotal,
            DataCompra = compra.DataCompra,
            DataPrimeiroVencimento = compra.DataPrimeiroVencimento,
            FormaPagamento = compra.FormaPagamento,
            IsDividida = compra.IsDividida,
            ValorTotalOriginal = compra.ValorTotalOriginal,
            PercentualDivisao = compra.PercentualDivisao,
            Categoria = new Categoria
            {
                Id = compra.Categoria.Id,
                Nome = compra.Categoria.Nome,
                CorHexa = compra.Categoria.CorHexa
            }
        });
    }

    private async Task<decimal> CalcularSaldoAtualGlobalAsync(
        Guid usuarioId,
        DateOnly hoje,
        CancellationToken cancellationToken)
    {
        var somas = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                (
                    transacao.CartaoCreditoId == null ||
                    (transacao.CompraParceladaId.HasValue && transacao.NumeroParcelaQuitada.HasValue)
                ) &&
                (
                    (transacao.Tipo == TipoTransacao.Receita && transacao.DataOcorrencia <= hoje) ||
                    (transacao.Tipo != TipoTransacao.Receita && transacao.IsPaga)
                ))
            .GroupBy(_ => 1)
            .Select(grupo => new
            {
                Receitas = grupo
                    .Where(transacao => transacao.Tipo == TipoTransacao.Receita)
                    .Sum(transacao => transacao.Valor),
                Despesas = grupo
                    .Where(transacao => transacao.Tipo == TipoTransacao.Despesa)
                    .Sum(transacao => transacao.Valor),
                Investimentos = grupo
                    .Where(transacao => transacao.Tipo == TipoTransacao.Investimento)
                    .Sum(transacao => transacao.Valor)
            })
            .SingleOrDefaultAsync(cancellationToken);

        var saldoTransacoesReais = somas is null
            ? 0
            : somas.Receitas - somas.Despesas - somas.Investimentos;

        var somasFixasPagas = await _dbContext.TransacoesFixasPagamentos
            .AsNoTracking()
            .Where(pagamento =>
                pagamento.UsuarioId == usuarioId &&
                pagamento.IsPaga &&
                (
                    pagamento.TransacaoFixa.Tipo != TipoTransacao.Receita ||
                    pagamento.DataOcorrencia <= hoje
                ))
            .Select(pagamento => pagamento.TransacaoFixa)
            .GroupBy(_ => 1)
            .Select(grupo => new
            {
                Receitas = grupo
                    .Where(transacao => transacao.Tipo == TipoTransacao.Receita)
                    .Sum(transacao => transacao.Valor),
                Despesas = grupo
                    .Where(transacao => transacao.Tipo == TipoTransacao.Despesa)
                    .Sum(transacao => transacao.Valor),
                Investimentos = grupo
                    .Where(transacao => transacao.Tipo == TipoTransacao.Investimento)
                    .Sum(transacao => transacao.Valor)
            })
            .SingleOrDefaultAsync(cancellationToken);

        var saldoFixasPagas = somasFixasPagas is null
            ? 0
            : somasFixasPagas.Receitas - somasFixasPagas.Despesas - somasFixasPagas.Investimentos;

        var totalFaturasPagas = await CalcularTotalFaturasPagasAsync(
            usuarioId,
            hoje,
            cancellationToken);
        var totalCarnesPagos = await CalcularTotalCarnesPagosAsync(
            usuarioId,
            hoje,
            cancellationToken);

        return saldoTransacoesReais + saldoFixasPagas - totalFaturasPagas - totalCarnesPagos;
    }

    private async Task<decimal> CalcularTotalFaturasPagasAsync(
        Guid usuarioId,
        DateOnly hoje,
        CancellationToken cancellationToken)
    {
        var cartoes = await _dbContext.CartoesCredito
            .AsNoTracking()
            .Where(cartao => cartao.UsuarioId == usuarioId)
            .Select(cartao => new CartaoCredito
            {
                Id = cartao.Id,
                ApelidoCartao = cartao.ApelidoCartao,
                DiaVencimento = cartao.DiaVencimento,
                MelhorDiaCompra = cartao.MelhorDiaCompra
            })
            .ToListAsync(cancellationToken);

        if (cartoes.Count == 0)
        {
            return 0;
        }

        var pagamentos = await _dbContext.FaturasCartaoPagamentos
            .AsNoTracking()
            .Where(pagamento => pagamento.UsuarioId == usuarioId)
            .Select(pagamento => new
            {
                pagamento.CartaoCreditoId,
                pagamento.DataVencimento,
                pagamento.IsPaga
            })
            .ToListAsync(cancellationToken);
        var pagamentosMap = pagamentos.ToDictionary(
            pagamento => (pagamento.CartaoCreditoId, pagamento.DataVencimento),
            pagamento => pagamento.IsPaga);
        var ultimoMes = pagamentos
            .Where(pagamento => pagamento.IsPaga && pagamento.DataVencimento > hoje)
            .Select(pagamento => new DateOnly(
                pagamento.DataVencimento.Year,
                pagamento.DataVencimento.Month,
                1))
            .Append(new DateOnly(hoje.Year, hoje.Month, 1))
            .Max();
        var maiorFimCompetencia = cartoes
            .Select(cartao => CalcularPeriodoFatura(cartao, ultimoMes.Month, ultimoMes.Year).FimCompetencia)
            .Max();

        // Todo o histórico necessário é carregado uma única vez. O cálculo mensal abaixo
        // ocorre em memória e elimina o antigo N+1 de várias consultas para cada fatura.
        var transacoesCredito = await ProjetarTransacoesParaLeitura(
                _dbContext.Transacoes.AsNoTracking().AsSingleQuery())
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CartaoCreditoId.HasValue &&
                transacao.Tipo == TipoTransacao.Despesa &&
                !transacao.CompraParceladaId.HasValue &&
                transacao.DataOcorrencia <= maiorFimCompetencia)
            .ToListAsync(cancellationToken);

        var comprasParceladas = await ProjetarComprasParaLeitura(
                _dbContext.ComprasParceladas.AsNoTracking().AsSingleQuery())
            .Where(compra =>
                compra.UsuarioId == usuarioId &&
                compra.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito &&
                compra.CartaoCreditoId.HasValue &&
                compra.DataCompra <= maiorFimCompetencia)
            .ToListAsync(cancellationToken);

        var primeiraDataCredito = transacoesCredito
            .Select(transacao => transacao.DataOcorrencia)
            .Concat(comprasParceladas.Select(compra => compra.DataCompra))
            .DefaultIfEmpty()
            .Min();

        if (primeiraDataCredito == default)
        {
            return 0;
        }

        var transacoesFixas = transacoesCredito
            .Where(transacao => transacao.IsFixa)
            .ToList();
        var transacoesFixasIds = transacoesFixas
            .Select(transacao => transacao.Id)
            .ToList();
        var excecoesFixas = await _dbContext.TransacoesFixasExcecoes
            .AsNoTracking()
            .Where(excecao =>
                excecao.UsuarioId == usuarioId &&
                transacoesFixasIds.Contains(excecao.TransacaoFixaId) &&
                excecao.DataOcorrencia <= maiorFimCompetencia)
            .Select(excecao => new
            {
                excecao.TransacaoFixaId,
                excecao.DataOcorrencia
            })
            .ToListAsync(cancellationToken);
        var excecoesFixasSet = excecoesFixas
            .Select(excecao => (excecao.TransacaoFixaId, excecao.DataOcorrencia))
            .ToHashSet();

        var comprasIds = comprasParceladas.Select(compra => compra.Id).ToList();
        var parcelasQuitadas = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CompraParceladaId.HasValue &&
                comprasIds.Contains(transacao.CompraParceladaId.Value) &&
                transacao.NumeroParcelaQuitada.HasValue)
            .Select(transacao => new
            {
                CompraParceladaId = transacao.CompraParceladaId!.Value,
                NumeroParcela = transacao.NumeroParcelaQuitada!.Value
            })
            .ToListAsync(cancellationToken);
        var parcelasQuitadasSet = parcelasQuitadas
            .Select(parcela => (parcela.CompraParceladaId, parcela.NumeroParcela))
            .ToHashSet();

        decimal total = 0;
        var primeiroMes = new DateOnly(primeiraDataCredito.Year, primeiraDataCredito.Month, 1);

        foreach (var cartao in cartoes)
        {
            for (var cursor = primeiroMes; cursor <= ultimoMes; cursor = cursor.AddMonths(1))
            {
                var periodo = CalcularPeriodoFatura(cartao, cursor.Month, cursor.Year);
                var temPagamentoRegistrado = pagamentosMap.TryGetValue(
                    (cartao.Id, periodo.DataVencimento),
                    out var isFaturaPaga);
                var deveContabilizar = periodo.DataVencimento <= hoje
                    ? !temPagamentoRegistrado || isFaturaPaga
                    : temPagamentoRegistrado && isFaturaPaga;

                if (!deveContabilizar)
                {
                    continue;
                }

                var valorTransacoes = transacoesCredito
                    .Where(transacao =>
                        transacao.CartaoCreditoId == cartao.Id &&
                        transacao.DataOcorrencia >= periodo.InicioCompetencia &&
                        transacao.DataOcorrencia <= periodo.FimCompetencia)
                    .Sum(transacao => transacao.Valor);
                var valorFixasProjetadas = ProjetarTransacoesFixasCreditoParaFatura(
                        transacoesFixas,
                        cartao.Id,
                        periodo.InicioCompetencia,
                        periodo.FimCompetencia,
                        excecoesFixasSet)
                    .Sum(detalhe => detalhe.Valor);
                var valorParcelas = ProjetarParcelasParaFatura(
                        comprasParceladas,
                        cartao.Id,
                        periodo.InicioCompetencia,
                        periodo.FimCompetencia,
                        parcelasQuitadasSet)
                    .Sum(detalhe => detalhe.Valor);

                total += valorTransacoes + valorFixasProjetadas + valorParcelas;
            }
        }

        return total;
    }

    private async Task<decimal> CalcularTotalCarnesPagosAsync(
        Guid usuarioId,
        DateOnly hoje,
        CancellationToken cancellationToken)
    {
        var compras = await _dbContext.ComprasParceladas
            .AsNoTracking()
            .Where(compra =>
                compra.UsuarioId == usuarioId &&
                compra.FormaPagamento == FormaPagamentoCompraParcelada.Carne &&
                compra.DataPrimeiroVencimento.HasValue &&
                compra.DataPrimeiroVencimento.Value <= hoje)
            .ToListAsync(cancellationToken);

        if (compras.Count == 0)
        {
            return 0;
        }

        var comprasIds = compras.Select(compra => compra.Id).ToList();
        var parcelasQuitadas = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CompraParceladaId.HasValue &&
                comprasIds.Contains(transacao.CompraParceladaId.Value) &&
                transacao.NumeroParcelaQuitada.HasValue)
            .Select(transacao => new
            {
                CompraParceladaId = transacao.CompraParceladaId!.Value,
                NumeroParcela = transacao.NumeroParcelaQuitada!.Value
            })
            .ToListAsync(cancellationToken);

        var parcelasQuitadasSet = parcelasQuitadas
            .Select(parcela => (parcela.CompraParceladaId, parcela.NumeroParcela))
            .ToHashSet();

        decimal total = 0;
        foreach (var compra in compras)
        {
            var primeiroVencimento = compra.DataPrimeiroVencimento!.Value;

            for (var numeroParcela = 1; numeroParcela <= compra.QuantidadeParcelas; numeroParcela++)
            {
                if (parcelasQuitadasSet.Contains((compra.Id, numeroParcela)))
                {
                    continue;
                }

                var dataVencimento = primeiroVencimento.AddMonths(numeroParcela - 1);
                if (dataVencimento <= hoje)
                {
                    total += CalcularValorParcela(compra.ValorTotal, compra.QuantidadeParcelas, numeroParcela);
                }
            }
        }

        return total;
    }

    public async Task<Guid> CriarAsync(
        CriarTransacaoRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        ValidarDivisao(request);
        await ValidarRelacionamentosAsync(request, usuarioId, cancellationToken);

        var ultimoCodigo = await _dbContext.Transacoes
            .Where(transacao => transacao.UsuarioId == usuarioId)
            .MaxAsync(transacao => (int?)transacao.CodigoExibicao, cancellationToken);

        var transacao = new Transacao
        {
            CodigoExibicao = (ultimoCodigo ?? 0) + 1,
            UsuarioId = usuarioId,
            Tipo = request.Tipo,
            Descricao = request.Descricao.Trim(),
            Valor = request.Valor,
            DataOcorrencia = request.DataOcorrencia,
            CategoriaId = request.Tipo == TipoTransacao.Receita ? null : request.CategoriaId,
            FormaPagamento = request.FormaPagamento.Trim(),
            CartaoCreditoId = request.Tipo == TipoTransacao.Despesa ? request.CartaoCreditoId : null,
            ContaBancariaId = request.Tipo is TipoTransacao.Receita or TipoTransacao.Despesa
                ? request.ContaBancariaId
                : null,
            IsFixa = request.IsFixa,
            IsPaga = DeveEntrarComoPaga(request.DataOcorrencia),
            IsDividida = request.IsDividida,
            ValorTotalOriginal = request.IsDividida ? request.ValorTotalOriginal : null,
            PercentualDivisao = request.IsDividida ? request.PercentualDivisao : null,
            CompraParceladaId = request.CompraParceladaId,
            NumeroParcelaQuitada = request.NumeroParcelaQuitada
        };

        _dbContext.Transacoes.Add(transacao);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return transacao.Id;
    }

    public async Task<Guid?> AtualizarAsync(
        Guid id,
        CriarTransacaoRequest request,
        Guid usuarioId,
        bool replicarFuturas = true,
        CancellationToken cancellationToken = default)
    {
        ValidarDivisao(request);
        await ValidarRelacionamentosAsync(request, usuarioId, cancellationToken);

        var transacao = await _dbContext.Transacoes
            .SingleOrDefaultAsync(
                transacao => transacao.Id == id && transacao.UsuarioId == usuarioId,
                cancellationToken);

        if (transacao is null)
        {
            return null;
        }

        if (transacao.IsFixa && !replicarFuturas)
        {
            var ultimoCodigoPontual = await ObterUltimoCodigoExibicaoAsync(usuarioId, cancellationToken);

            if (request.DataOcorrencia > transacao.DataOcorrencia)
            {
                await RegistrarExcecaoFixaAsync(
                    transacao.Id,
                    request.DataOcorrencia,
                    usuarioId,
                    cancellationToken);

                var transacaoPontual = CriarTransacaoAPartirRequest(
                    request,
                    usuarioId,
                    ultimoCodigoPontual + 1,
                    isFixa: false);

                _dbContext.Transacoes.Add(transacaoPontual);
                await _dbContext.SaveChangesAsync(cancellationToken);

                return transacaoPontual.Id;
            }

            var proximaOcorrencia = CriarDataNoMes(
                transacao.DataOcorrencia.AddMonths(1),
                transacao.DataOcorrencia.Day);
            var novaRecorrenciaOriginal = ClonarTransacaoFixa(
                transacao,
                ultimoCodigoPontual + 1,
                proximaOcorrencia);

            _dbContext.Transacoes.Add(novaRecorrenciaOriginal);

            AplicarRequestNaTransacao(transacao, request, isFixa: false);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return transacao.Id;
        }

        if (transacao.IsFixa && request.IsFixa && request.DataOcorrencia > transacao.DataOcorrencia)
        {
            transacao.IsFixa = false;

            var ultimoCodigo = await ObterUltimoCodigoExibicaoAsync(usuarioId, cancellationToken);
            var novaRecorrencia = CriarTransacaoAPartirRequest(
                request,
                usuarioId,
                ultimoCodigo + 1,
                isFixa: true);

            _dbContext.Transacoes.Add(novaRecorrencia);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return novaRecorrencia.Id;
        }

        AplicarRequestNaTransacao(transacao, request, request.IsFixa);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return transacao.Id;
    }

    public async Task<IReadOnlyList<TransacaoResponse>> AnteciparParcelaAsync(
        AnteciparParcelaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        if (request.NumeroParcela < 1)
        {
            throw new InvalidOperationException("O número da parcela deve ser maior que zero.");
        }

        if (request.ValorPago <= 0)
        {
            throw new InvalidOperationException("O valor pago deve ser maior que zero.");
        }

        var compra = await _dbContext.ComprasParceladas
            .Include(item => item.Categoria)
            .Include(item => item.CartaoCredito)
            .SingleOrDefaultAsync(
                item => item.Id == request.IdCompraParcelada && item.UsuarioId == usuarioId,
                cancellationToken);

        if (compra is null)
        {
            throw new InvalidOperationException("Compra parcelada não encontrada para este usuário.");
        }

        if (request.NumeroParcela > compra.QuantidadeParcelas)
        {
            throw new InvalidOperationException("A parcela informada não existe para esta compra.");
        }

        var ultimaParcela = request.AnteciparParcelasFuturas
            ? compra.QuantidadeParcelas
            : request.NumeroParcela;
        var numerosParcelas = Enumerable.Range(
                request.NumeroParcela,
                ultimaParcela - request.NumeroParcela + 1)
            .ToList();

        var parcelasJaQuitadas = await _dbContext.Transacoes
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CompraParceladaId == compra.Id &&
                transacao.NumeroParcelaQuitada.HasValue &&
                numerosParcelas.Contains(transacao.NumeroParcelaQuitada.Value))
            .Select(transacao => transacao.NumeroParcelaQuitada!.Value)
            .ToListAsync(cancellationToken);

        if (parcelasJaQuitadas.Count > 0 && !request.AnteciparParcelasFuturas)
        {
            throw new InvalidOperationException("Esta parcela já foi quitada ou antecipada.");
        }

        var parcelasJaQuitadasSet = parcelasJaQuitadas.ToHashSet();
        var ultimoCodigo = await ObterUltimoCodigoExibicaoAsync(usuarioId, cancellationToken);
        var transacoes = new List<Transacao>();

        foreach (var numeroParcela in numerosParcelas)
        {
            if (parcelasJaQuitadasSet.Contains(numeroParcela))
            {
                continue;
            }

            var valorParcela = numeroParcela == request.NumeroParcela
                ? request.ValorPago
                : CalcularValorParcela(compra.ValorTotal, compra.QuantidadeParcelas, numeroParcela);
            var valorParcelaOriginal = compra.IsDividida && compra.ValorTotalOriginal.HasValue
                ? CalcularValorParcela(compra.ValorTotalOriginal.Value, compra.QuantidadeParcelas, numeroParcela)
                : (decimal?)null;

            transacoes.Add(new Transacao
            {
                CodigoExibicao = ++ultimoCodigo,
                UsuarioId = usuarioId,
                Tipo = TipoTransacao.Despesa,
                Descricao = $"{compra.Descricao} ({numeroParcela}/{compra.QuantidadeParcelas}) - antecipada",
                Valor = Math.Round(valorParcela, 2, MidpointRounding.AwayFromZero),
                DataOcorrencia = DateOnly.FromDateTime(request.DataAntecipacao),
                CategoriaId = compra.CategoriaId,
                FormaPagamento = compra.FormaPagamento == FormaPagamentoCompraParcelada.Carne
                    ? "Carnê/Crediário"
                    : "Cartão de crédito",
                CartaoCreditoId = compra.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito
                    ? compra.CartaoCreditoId
                    : null,
                IsFixa = false,
                IsPaga = true,
                IsDividida = compra.IsDividida,
                ValorTotalOriginal = valorParcelaOriginal,
                PercentualDivisao = compra.PercentualDivisao,
                CompraParceladaId = compra.Id,
                NumeroParcelaQuitada = numeroParcela
            });
        }

        if (transacoes.Count == 0)
        {
            throw new InvalidOperationException("Todas as parcelas selecionadas já foram quitadas ou antecipadas.");
        }

        _dbContext.Transacoes.AddRange(transacoes);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return transacoes.Select(MapearTransacaoResponse).ToList();
    }

    public async Task<bool?> AlternarStatusPagamentoAsync(
        Guid id,
        Guid usuarioId,
        DateOnly? dataOcorrencia = null,
        CancellationToken cancellationToken = default)
    {
        var transacao = await _dbContext.Transacoes
            .SingleOrDefaultAsync(
                transacao => transacao.Id == id && transacao.UsuarioId == usuarioId,
                cancellationToken);

        if (transacao is null)
        {
            return null;
        }

        if (transacao.IsFixa && dataOcorrencia.HasValue)
        {
            var pagamento = await _dbContext.TransacoesFixasPagamentos
                .SingleOrDefaultAsync(
                    item =>
                        item.UsuarioId == usuarioId &&
                        item.TransacaoFixaId == transacao.Id &&
                        item.DataOcorrencia == dataOcorrencia.Value,
                    cancellationToken);

            var isPagaAtual = pagamento?.IsPaga ??
                (dataOcorrencia.Value == transacao.DataOcorrencia && transacao.IsPaga);

            if (pagamento is null)
            {
                pagamento = new TransacaoFixaPagamento
                {
                    UsuarioId = usuarioId,
                    TransacaoFixaId = transacao.Id,
                    DataOcorrencia = dataOcorrencia.Value,
                    IsPaga = !isPagaAtual
                };

                _dbContext.TransacoesFixasPagamentos.Add(pagamento);
            }
            else
            {
                pagamento.IsPaga = !pagamento.IsPaga;
            }

            transacao.IsPaga = false;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return pagamento.IsPaga;
        }

        transacao.IsPaga = !transacao.IsPaga;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return transacao.IsPaga;
    }

    public async Task<bool?> AlternarStatusFaturaAsync(
        Guid cartaoCreditoId,
        DateOnly dataVencimento,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var cartaoExiste = await _dbContext.CartoesCredito
            .AnyAsync(
                cartao => cartao.Id == cartaoCreditoId && cartao.UsuarioId == usuarioId,
                cancellationToken);

        if (!cartaoExiste)
        {
            return null;
        }

        var pagamento = await _dbContext.FaturasCartaoPagamentos
            .SingleOrDefaultAsync(
                item =>
                    item.UsuarioId == usuarioId &&
                    item.CartaoCreditoId == cartaoCreditoId &&
                    item.DataVencimento == dataVencimento,
                cancellationToken);

        if (pagamento is null)
        {
            pagamento = new FaturaCartaoPagamento
            {
                UsuarioId = usuarioId,
                CartaoCreditoId = cartaoCreditoId,
                DataVencimento = dataVencimento,
                IsPaga = true
            };

            _dbContext.FaturasCartaoPagamentos.Add(pagamento);
        }
        else
        {
            pagamento.IsPaga = !pagamento.IsPaga;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return pagamento.IsPaga;
    }

    public async Task<bool> ExcluirAsync(
        Guid id,
        Guid usuarioId,
        DateOnly? dataOcorrencia = null,
        bool replicarFuturas = true,
        CancellationToken cancellationToken = default)
    {
        var transacao = await _dbContext.Transacoes
            .SingleOrDefaultAsync(
                transacao => transacao.Id == id && transacao.UsuarioId == usuarioId,
                cancellationToken);

        if (transacao is null)
        {
            return false;
        }

        if (transacao.IsFixa &&
            dataOcorrencia.HasValue &&
            dataOcorrencia.Value == transacao.DataOcorrencia &&
            !replicarFuturas)
        {
            var ultimoCodigo = await ObterUltimoCodigoExibicaoAsync(usuarioId, cancellationToken);
            var proximaOcorrencia = CriarDataNoMes(
                transacao.DataOcorrencia.AddMonths(1),
                transacao.DataOcorrencia.Day);
            var novaRecorrencia = ClonarTransacaoFixa(
                transacao,
                ultimoCodigo + 1,
                proximaOcorrencia);

            _dbContext.Transacoes.Add(novaRecorrencia);
            _dbContext.Transacoes.Remove(transacao);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        if (transacao.IsFixa &&
            dataOcorrencia.HasValue &&
            dataOcorrencia.Value > transacao.DataOcorrencia)
        {
            if (replicarFuturas)
            {
                transacao.IsFixa = false;
            }
            else
            {
                await RegistrarExcecaoFixaAsync(
                    transacao.Id,
                    dataOcorrencia.Value,
                    usuarioId,
                    cancellationToken);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        _dbContext.Transacoes.Remove(transacao);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<int> ObterUltimoCodigoExibicaoAsync(
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        return await _dbContext.Transacoes
            .Where(transacao => transacao.UsuarioId == usuarioId)
            .MaxAsync(transacao => (int?)transacao.CodigoExibicao, cancellationToken) ?? 0;
    }

    private async Task RegistrarExcecaoFixaAsync(
        Guid transacaoFixaId,
        DateOnly dataOcorrencia,
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var excecaoExiste = await _dbContext.TransacoesFixasExcecoes
            .AnyAsync(
                excecao =>
                    excecao.UsuarioId == usuarioId &&
                    excecao.TransacaoFixaId == transacaoFixaId &&
                    excecao.DataOcorrencia == dataOcorrencia,
                cancellationToken);

        if (excecaoExiste)
        {
            return;
        }

        _dbContext.TransacoesFixasExcecoes.Add(new TransacaoFixaExcecao
        {
            UsuarioId = usuarioId,
            TransacaoFixaId = transacaoFixaId,
            DataOcorrencia = dataOcorrencia
        });
    }

    private static Transacao CriarTransacaoAPartirRequest(
        CriarTransacaoRequest request,
        Guid usuarioId,
        int codigoExibicao,
        bool isFixa)
    {
        var transacao = new Transacao
        {
            CodigoExibicao = codigoExibicao,
            UsuarioId = usuarioId
        };

        AplicarRequestNaTransacao(transacao, request, isFixa);
        return transacao;
    }

    private static void AplicarRequestNaTransacao(
        Transacao transacao,
        CriarTransacaoRequest request,
        bool isFixa)
    {
        transacao.Tipo = request.Tipo;
        transacao.Descricao = request.Descricao.Trim();
        transacao.Valor = request.Valor;
        transacao.DataOcorrencia = request.DataOcorrencia;
        transacao.CategoriaId = request.Tipo == TipoTransacao.Receita ? null : request.CategoriaId;
        transacao.FormaPagamento = request.FormaPagamento.Trim();
        transacao.CartaoCreditoId = request.Tipo == TipoTransacao.Despesa ? request.CartaoCreditoId : null;
        transacao.ContaBancariaId = request.Tipo is TipoTransacao.Receita or TipoTransacao.Despesa
            ? request.ContaBancariaId
            : null;
        transacao.IsFixa = isFixa;
        transacao.IsPaga = DeveEntrarComoPaga(request.DataOcorrencia);
        transacao.IsDividida = request.IsDividida;
        transacao.ValorTotalOriginal = request.IsDividida ? request.ValorTotalOriginal : null;
        transacao.PercentualDivisao = request.IsDividida ? request.PercentualDivisao : null;
        transacao.CompraParceladaId = request.CompraParceladaId;
        transacao.NumeroParcelaQuitada = request.NumeroParcelaQuitada;
    }

    private static Transacao ClonarTransacaoFixa(
        Transacao transacao,
        int codigoExibicao,
        DateOnly dataOcorrencia)
    {
        return new Transacao
        {
            CodigoExibicao = codigoExibicao,
            UsuarioId = transacao.UsuarioId,
            Tipo = transacao.Tipo,
            Descricao = transacao.Descricao,
            Valor = transacao.Valor,
            DataOcorrencia = dataOcorrencia,
            CategoriaId = transacao.CategoriaId,
            FormaPagamento = transacao.FormaPagamento,
            CartaoCreditoId = transacao.CartaoCreditoId,
            ContaBancariaId = transacao.ContaBancariaId,
            IsFixa = true,
            IsPaga = DeveEntrarComoPaga(dataOcorrencia),
            IsDividida = transacao.IsDividida,
            ValorTotalOriginal = transacao.ValorTotalOriginal,
            PercentualDivisao = transacao.PercentualDivisao
        };
    }

    private static ExtratoMensalItemResponse MapearTransacaoReal(
        Transacao transacao,
        IReadOnlyDictionary<(Guid TransacaoFixaId, DateOnly DataOcorrencia), bool>? pagamentosFixas = null)
    {
        var isPaga = transacao.IsFixa && pagamentosFixas is not null
            ? pagamentosFixas.GetValueOrDefault((transacao.Id, transacao.DataOcorrencia), transacao.IsPaga)
            : transacao.IsPaga;

        return new ExtratoMensalItemResponse
        {
            Id = transacao.Id,
            CodigoExibicao = transacao.CodigoExibicao,
            Tipo = transacao.Tipo,
            Descricao = transacao.Descricao,
            Valor = transacao.Valor,
            DataOcorrencia = transacao.DataOcorrencia,
            CategoriaId = transacao.CategoriaId,
            CategoriaNome = transacao.Categoria?.Nome ?? "Sem categoria",
            CategoriaCorHexa = transacao.Categoria?.CorHexa ?? "#64748B",
            FormaPagamento = transacao.FormaPagamento,
            CartaoCreditoId = transacao.CartaoCreditoId,
            ContaBancariaId = transacao.ContaBancariaId,
            CartaoCreditoApelido = transacao.CartaoCredito?.ApelidoCartao,
            IsFixa = transacao.IsFixa,
            IsPaga = isPaga,
            IsDividida = transacao.IsDividida,
            ValorTotalOriginal = transacao.ValorTotalOriginal,
            PercentualDivisao = transacao.PercentualDivisao,
            IsProjetada = false,
            Origem = "Transacao",
            CompraParceladaId = transacao.CompraParceladaId,
            NumeroParcela = transacao.NumeroParcelaQuitada
        };
    }

    private static ExtratoMensalItemResponse MapearFaturaParaExtrato(FaturaConsolidadaResponse fatura)
    {
        return new ExtratoMensalItemResponse
        {
            Tipo = TipoTransacao.Despesa,
            Descricao = $"Fatura Cartão {fatura.NomeCartao}",
            Valor = fatura.ValorTotal,
            IsDividida = fatura.ValorTotalOriginal != fatura.ValorTotal,
            ValorTotalOriginal = fatura.ValorTotalOriginal,
            DataOcorrencia = fatura.DataVencimento,
            CategoriaNome = "Fatura de cartão",
            CategoriaCorHexa = "#334155",
            FormaPagamento = "Fatura de cartão",
            CartaoCreditoId = fatura.CartaoCreditoId,
            CartaoCreditoApelido = fatura.NomeCartao,
            IsFixa = false,
            IsPaga = fatura.IsPaga,
            IsProjetada = true,
            Origem = "FaturaCartao"
        };
    }

    private static ExtratoMensalItemResponse MapearDetalheFaturaParaExtrato(
        FaturaConsolidadaResponse fatura,
        FaturaDetalheResponse detalhe)
    {
        return new ExtratoMensalItemResponse
        {
            Id = detalhe.TransacaoId,
            Tipo = TipoTransacao.Despesa,
            Descricao = detalhe.Descricao,
            Valor = detalhe.Valor,
            DataOcorrencia = detalhe.DataOcorrencia,
            CategoriaId = detalhe.CategoriaId,
            CategoriaNome = detalhe.CategoriaNome,
            CategoriaCorHexa = detalhe.CategoriaCorHexa,
            FormaPagamento = "Cartão de crédito",
            CartaoCreditoId = fatura.CartaoCreditoId,
            CartaoCreditoApelido = fatura.NomeCartao,
            IsFixa = detalhe.Origem == "DespesaFixa",
            IsPaga = fatura.IsPaga,
            IsDividida = detalhe.IsDividida,
            ValorTotalOriginal = detalhe.ValorTotalOriginal,
            PercentualDivisao = detalhe.PercentualDivisao,
            IsProjetada = detalhe.Origem != "Transacao",
            Origem = detalhe.Origem,
            CompraParceladaId = detalhe.CompraParceladaId,
            NumeroParcela = detalhe.NumeroParcela,
            QuantidadeParcelas = detalhe.QuantidadeParcelas
        };
    }

    private static FaturaDetalheResponse MapearTransacaoParaDetalheFatura(Transacao transacao)
    {
        return new FaturaDetalheResponse
        {
            TransacaoId = transacao.Id,
            DataOcorrencia = transacao.DataOcorrencia,
            Descricao = transacao.Descricao,
            Valor = transacao.Valor,
            IsDividida = transacao.IsDividida,
            ValorTotalOriginal = transacao.ValorTotalOriginal,
            PercentualDivisao = transacao.PercentualDivisao,
            CategoriaId = transacao.CategoriaId,
            CategoriaNome = transacao.Categoria?.Nome ?? "Sem categoria",
            CategoriaCorHexa = transacao.Categoria?.CorHexa ?? "#64748B",
            Origem = "Transacao"
        };
    }

    private async Task ValidarRelacionamentosAsync(
        CriarTransacaoRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        if (request.Tipo is TipoTransacao.Despesa or TipoTransacao.Investimento &&
            !request.CategoriaId.HasValue)
        {
            throw new InvalidOperationException("Categoria é obrigatória para despesas e investimentos.");
        }

        if (request.Tipo == TipoTransacao.Receita && request.CategoriaId.HasValue)
        {
            throw new InvalidOperationException("Receitas não devem possuir categoria.");
        }

        if (request.CategoriaId.HasValue)
        {
            var categoriaExiste = await _dbContext.Categorias
                .AnyAsync(
                    categoria => categoria.Id == request.CategoriaId.Value &&
                        (categoria.UsuarioId == null || categoria.UsuarioId == usuarioId),
                    cancellationToken);

            if (!categoriaExiste)
            {
                throw new InvalidOperationException("Categoria não encontrada para este usuário.");
            }
        }

        if (request.CartaoCreditoId.HasValue)
        {
            if (request.Tipo != TipoTransacao.Despesa)
            {
                throw new InvalidOperationException("Cartão de crédito só pode ser usado em despesas.");
            }

            var cartaoExiste = await _dbContext.CartoesCredito
                .AnyAsync(
                    cartao => cartao.Id == request.CartaoCreditoId.Value && cartao.UsuarioId == usuarioId,
                    cancellationToken);

            if (!cartaoExiste)
            {
                throw new InvalidOperationException("Cartão de crédito não encontrado para este usuário.");
            }
        }

        if (request.ContaBancariaId.HasValue)
        {
            if (request.Tipo is not (TipoTransacao.Receita or TipoTransacao.Despesa))
            {
                throw new InvalidOperationException(
                    "Conta bancária só pode ser vinculada a receitas ou despesas.");
            }

            if (request.CartaoCreditoId.HasValue)
            {
                throw new InvalidOperationException(
                    "Uma despesa de cartão de crédito não pode ser debitada diretamente de uma conta.");
            }

            var contaExiste = await _dbContext.ContasBancarias
                .AnyAsync(
                    conta => conta.Id == request.ContaBancariaId.Value &&
                        conta.UsuarioId == usuarioId,
                    cancellationToken);

            if (!contaExiste)
            {
                throw new InvalidOperationException("Conta bancária não encontrada para este usuário.");
            }
        }

        if (request.CompraParceladaId.HasValue)
        {
            var compraExiste = await _dbContext.ComprasParceladas
                .AnyAsync(
                    compra => compra.Id == request.CompraParceladaId.Value && compra.UsuarioId == usuarioId,
                    cancellationToken);

            if (!compraExiste)
            {
                throw new InvalidOperationException("Compra parcelada não encontrada para este usuário.");
            }
        }
    }

    private static void ValidarDivisao(CriarTransacaoRequest request)
    {
        if (!request.IsDividida)
        {
            return;
        }

        if (request.Tipo != TipoTransacao.Despesa)
        {
            throw new InvalidOperationException("A divisão está disponível apenas para despesas.");
        }

        if (!request.ValorTotalOriginal.HasValue || !request.PercentualDivisao.HasValue)
        {
            throw new InvalidOperationException("Informe o valor total original e o percentual da divisão.");
        }

        if (request.ValorTotalOriginal.Value <= 0)
        {
            throw new InvalidOperationException("O valor total da compra deve ser maior que zero.");
        }

        if (request.PercentualDivisao.Value <= 0 || request.PercentualDivisao.Value > 100)
        {
            throw new InvalidOperationException("O percentual da divisão deve ser maior que zero e no máximo 100%.");
        }

        if (request.Valor <= 0 || request.Valor > request.ValorTotalOriginal.Value)
        {
            throw new InvalidOperationException(
                "O valor da sua parte deve ser maior que zero e não pode superar o valor total da compra.");
        }

        var valorCalculado = Math.Round(
            request.ValorTotalOriginal.Value * (request.PercentualDivisao.Value / 100m),
            2,
            MidpointRounding.AwayFromZero);

        if (request.Valor != valorCalculado)
        {
            throw new InvalidOperationException(
                $"O valor da sua parte deve ser {valorCalculado:C2} para o percentual informado.");
        }
    }

    private static TransacaoResponse MapearTransacaoResponse(Transacao transacao)
    {
        return new TransacaoResponse
        {
            Id = transacao.Id,
            CodigoExibicao = transacao.CodigoExibicao,
            UsuarioId = transacao.UsuarioId,
            Tipo = transacao.Tipo,
            Descricao = transacao.Descricao,
            Valor = transacao.Valor,
            DataOcorrencia = transacao.DataOcorrencia,
            CategoriaId = transacao.CategoriaId,
            FormaPagamento = transacao.FormaPagamento,
            CartaoCreditoId = transacao.CartaoCreditoId,
            ContaBancariaId = transacao.ContaBancariaId,
            IsFixa = transacao.IsFixa,
            IsPaga = transacao.IsPaga,
            IsDividida = transacao.IsDividida,
            ValorTotalOriginal = transacao.ValorTotalOriginal,
            PercentualDivisao = transacao.PercentualDivisao,
            CompraParceladaId = transacao.CompraParceladaId,
            NumeroParcelaQuitada = transacao.NumeroParcelaQuitada
        };
    }

    private static ExtratoMensalItemResponse? ProjetarParcela(
        CompraParcelada compra,
        DateOnly inicioMes,
        DateOnly fimMes,
        HashSet<(Guid CompraParceladaId, int NumeroParcela)> parcelasQuitadas)
    {
        var mesesDesdeCompra = ((inicioMes.Year - compra.DataCompra.Year) * 12) + inicioMes.Month - compra.DataCompra.Month;
        var numeroParcela = mesesDesdeCompra + 1;

        if (numeroParcela < 1 || numeroParcela > compra.QuantidadeParcelas)
        {
            return null;
        }

        if (parcelasQuitadas.Contains((compra.Id, numeroParcela)))
        {
            return null;
        }

        var dataProjetada = CriarDataNoMes(inicioMes, compra.DataCompra.Day);
        var valorParcela = CalcularValorParcela(compra.ValorTotal, compra.QuantidadeParcelas, numeroParcela);

        return new ExtratoMensalItemResponse
        {
            Tipo = TipoTransacao.Despesa,
            Descricao = compra.Descricao,
            Valor = valorParcela,
            DataOcorrencia = dataProjetada > fimMes ? fimMes : dataProjetada,
            CategoriaId = compra.CategoriaId,
            CategoriaNome = compra.Categoria.Nome,
            CategoriaCorHexa = compra.Categoria.CorHexa,
            FormaPagamento = "Cartão de crédito",
            CartaoCreditoId = compra.CartaoCreditoId,
            CartaoCreditoApelido = compra.CartaoCredito?.ApelidoCartao,
            IsFixa = false,
            IsPaga = DeveEntrarComoPaga(dataProjetada > fimMes ? fimMes : dataProjetada),
            IsDividida = compra.IsDividida,
            ValorTotalOriginal = compra.IsDividida && compra.ValorTotalOriginal.HasValue
                ? CalcularValorParcela(compra.ValorTotalOriginal.Value, compra.QuantidadeParcelas, numeroParcela)
                : null,
            PercentualDivisao = compra.PercentualDivisao,
            IsProjetada = true,
            Origem = "CompraParcelada",
            CompraParceladaId = compra.Id,
            NumeroParcela = numeroParcela,
            QuantidadeParcelas = compra.QuantidadeParcelas
        };
    }

    private static IReadOnlyList<FaturaDetalheResponse> ProjetarParcelasParaFatura(
        IReadOnlyList<CompraParcelada> compras,
        Guid cartaoCreditoId,
        DateOnly inicioCompetencia,
        DateOnly fimCompetencia,
        HashSet<(Guid CompraParceladaId, int NumeroParcela)> parcelasQuitadas)
    {
        var detalhes = new List<FaturaDetalheResponse>();

        foreach (var compra in compras.Where(compra =>
            compra.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito &&
            compra.CartaoCreditoId == cartaoCreditoId))
        {
            foreach (var referenciaMes in EnumerarMeses(inicioCompetencia, fimCompetencia))
            {
                var mesesDesdeCompra = ((referenciaMes.Year - compra.DataCompra.Year) * 12) +
                    referenciaMes.Month -
                    compra.DataCompra.Month;
                var numeroParcela = mesesDesdeCompra + 1;

                if (numeroParcela < 1 || numeroParcela > compra.QuantidadeParcelas)
                {
                    continue;
                }

                if (parcelasQuitadas.Contains((compra.Id, numeroParcela)))
                {
                    continue;
                }

                var dataParcela = CriarDataNoMes(referenciaMes, compra.DataCompra.Day);
                if (dataParcela < inicioCompetencia || dataParcela > fimCompetencia)
                {
                    continue;
                }

                detalhes.Add(new FaturaDetalheResponse
                {
                    CompraParceladaId = compra.Id,
                    NumeroParcela = numeroParcela,
                    QuantidadeParcelas = compra.QuantidadeParcelas,
                    DataOcorrencia = dataParcela,
                    Descricao = compra.Descricao,
                    Valor = CalcularValorParcela(compra.ValorTotal, compra.QuantidadeParcelas, numeroParcela),
                    IsDividida = compra.IsDividida,
                    ValorTotalOriginal = compra.IsDividida && compra.ValorTotalOriginal.HasValue
                        ? CalcularValorParcela(
                            compra.ValorTotalOriginal.Value,
                            compra.QuantidadeParcelas,
                            numeroParcela)
                        : null,
                    PercentualDivisao = compra.PercentualDivisao,
                    CategoriaId = compra.CategoriaId,
                    CategoriaNome = compra.Categoria.Nome,
                    CategoriaCorHexa = compra.Categoria.CorHexa,
                    Origem = "CompraParcelada"
                });
            }
        }

        return detalhes;
    }

    private static IReadOnlyList<FaturaDetalheResponse> ProjetarTransacoesFixasCreditoParaFatura(
        IReadOnlyList<Transacao> transacoesFixas,
        Guid cartaoCreditoId,
        DateOnly inicioCompetencia,
        DateOnly fimCompetencia,
        HashSet<(Guid TransacaoFixaId, DateOnly DataOcorrencia)> excecoesFixas)
    {
        var detalhes = new List<FaturaDetalheResponse>();

        foreach (var transacao in transacoesFixas.Where(transacao => transacao.CartaoCreditoId == cartaoCreditoId))
        {
            foreach (var referenciaMes in EnumerarMeses(inicioCompetencia, fimCompetencia))
            {
                var dataProjetada = CriarDataNoMes(referenciaMes, transacao.DataOcorrencia.Day);

                // No mês de origem a transação real já entra na fatura; aqui projetamos apenas meses futuros.
                if (dataProjetada <= transacao.DataOcorrencia ||
                    dataProjetada < inicioCompetencia ||
                    dataProjetada > fimCompetencia ||
                    excecoesFixas.Contains((transacao.Id, dataProjetada)))
                {
                    continue;
                }

                detalhes.Add(new FaturaDetalheResponse
                {
                    TransacaoId = transacao.Id,
                    DataOcorrencia = dataProjetada,
                    Descricao = transacao.Descricao,
                    Valor = transacao.Valor,
                    IsDividida = transacao.IsDividida,
                    ValorTotalOriginal = transacao.ValorTotalOriginal,
                    PercentualDivisao = transacao.PercentualDivisao,
                    CategoriaId = transacao.CategoriaId,
                    CategoriaNome = transacao.Categoria?.Nome ?? "Sem categoria",
                    CategoriaCorHexa = transacao.Categoria?.CorHexa ?? "#64748B",
                    Origem = "DespesaFixa"
                });
            }
        }

        return detalhes;
    }

    private static IReadOnlyList<ExtratoMensalItemResponse> ProjetarParcelasCarneParaExtrato(
        IReadOnlyList<CompraParcelada> compras,
        DateOnly inicioMes,
        DateOnly fimMes,
        HashSet<(Guid CompraParceladaId, int NumeroParcela)> parcelasQuitadas)
    {
        var itens = new List<ExtratoMensalItemResponse>();

        foreach (var compra in compras.Where(compra =>
            compra.FormaPagamento == FormaPagamentoCompraParcelada.Carne &&
            compra.DataPrimeiroVencimento.HasValue))
        {
            var primeiroVencimento = compra.DataPrimeiroVencimento!.Value;

            for (var numeroParcela = 1; numeroParcela <= compra.QuantidadeParcelas; numeroParcela++)
            {
                if (parcelasQuitadas.Contains((compra.Id, numeroParcela)))
                {
                    continue;
                }

                // Carnê/Crediário não usa fechamento: cada parcela vence N-1 meses após o primeiro vencimento.
                var dataVencimento = primeiroVencimento.AddMonths(numeroParcela - 1);
                if (dataVencimento < inicioMes || dataVencimento > fimMes)
                {
                    continue;
                }

                itens.Add(new ExtratoMensalItemResponse
                {
                    Tipo = TipoTransacao.Despesa,
                    Descricao = $"{compra.Descricao} ({numeroParcela}/{compra.QuantidadeParcelas}) [Carnê]",
                    Valor = CalcularValorParcela(compra.ValorTotal, compra.QuantidadeParcelas, numeroParcela),
                    DataOcorrencia = dataVencimento,
                    CategoriaId = compra.CategoriaId,
                    CategoriaNome = compra.Categoria.Nome,
                    CategoriaCorHexa = compra.Categoria.CorHexa,
                    FormaPagamento = "Carnê/Crediário",
                    IsFixa = false,
                    IsPaga = DeveEntrarComoPaga(dataVencimento),
                    IsDividida = compra.IsDividida,
                    ValorTotalOriginal = compra.IsDividida && compra.ValorTotalOriginal.HasValue
                        ? CalcularValorParcela(
                            compra.ValorTotalOriginal.Value,
                            compra.QuantidadeParcelas,
                            numeroParcela)
                        : null,
                    PercentualDivisao = compra.PercentualDivisao,
                    IsProjetada = true,
                    Origem = "Carne",
                    CompraParceladaId = compra.Id,
                    NumeroParcela = numeroParcela,
                    QuantidadeParcelas = compra.QuantidadeParcelas
                });
            }
        }

        return itens;
    }

    private static ExtratoMensalItemResponse ProjetarTransacaoFixa(
        Transacao transacao,
        DateOnly inicioMes,
        IReadOnlyDictionary<(Guid TransacaoFixaId, DateOnly DataOcorrencia), bool> pagamentosFixas)
    {
        var dataProjetada = CriarDataNoMes(inicioMes, transacao.DataOcorrencia.Day);

        return new ExtratoMensalItemResponse
        {
            Id = transacao.Id,
            CodigoExibicao = transacao.CodigoExibicao,
            Tipo = transacao.Tipo,
            Descricao = transacao.Descricao,
            Valor = transacao.Valor,
            DataOcorrencia = dataProjetada,
            CategoriaId = transacao.CategoriaId,
            CategoriaNome = transacao.Categoria?.Nome ?? "Sem categoria",
            CategoriaCorHexa = transacao.Categoria?.CorHexa ?? "#64748B",
            FormaPagamento = transacao.FormaPagamento,
            CartaoCreditoId = transacao.CartaoCreditoId,
            ContaBancariaId = transacao.ContaBancariaId,
            CartaoCreditoApelido = transacao.CartaoCredito?.ApelidoCartao,
            IsFixa = true,
            IsPaga = pagamentosFixas.GetValueOrDefault((transacao.Id, dataProjetada)),
            IsDividida = transacao.IsDividida,
            ValorTotalOriginal = transacao.ValorTotalOriginal,
            PercentualDivisao = transacao.PercentualDivisao,
            IsProjetada = true,
            Origem = transacao.Tipo switch
            {
                TipoTransacao.Receita => "ReceitaFixa",
                TipoTransacao.Investimento => "InvestimentoFixo",
                _ => "DespesaFixa"
            }
        };
    }

    private static DateOnly CriarDataNoMes(DateOnly inicioMes, int dia)
    {
        var ultimoDia = DateTime.DaysInMonth(inicioMes.Year, inicioMes.Month);
        return new DateOnly(inicioMes.Year, inicioMes.Month, Math.Min(dia, ultimoDia));
    }

    private static FaturaPeriodo CalcularPeriodoFatura(CartaoCredito cartao, int mes, int ano)
    {
        var mesAtual = new DateOnly(ano, mes, 1);
        var mesAnterior = mesAtual.AddMonths(-1);

        // A competência da fatura vai do fechamento do mês anterior até a véspera do fechamento atual.
        var inicioCompetencia = CriarDataNoMes(mesAnterior, cartao.MelhorDiaCompra);
        var fechamentoAtual = CriarDataNoMes(mesAtual, cartao.MelhorDiaCompra);
        var fimCompetencia = fechamentoAtual.AddDays(-1);
        var dataVencimento = CriarDataNoMes(mesAtual, cartao.DiaVencimento);

        return new FaturaPeriodo(inicioCompetencia, fimCompetencia, dataVencimento);
    }

    private static string CalcularStatusFatura(DateOnly dataVencimento, DateOnly fimCompetencia)
    {
        var hoje = DateOnly.FromDateTime(DateTime.Today);

        if (hoje > dataVencimento)
        {
            return "Vencida";
        }

        return hoje > fimCompetencia ? "Fechada" : "Aberta";
    }

    private static IEnumerable<DateOnly> EnumerarMeses(DateOnly inicio, DateOnly fim)
    {
        var cursor = new DateOnly(inicio.Year, inicio.Month, 1);
        var ultimoMes = new DateOnly(fim.Year, fim.Month, 1);

        while (cursor <= ultimoMes)
        {
            yield return cursor;
            cursor = cursor.AddMonths(1);
        }
    }

    private static decimal CalcularValorParcela(decimal valorTotal, int quantidadeParcelas, int numeroParcela)
    {
        var valorBase = Math.Round(valorTotal / quantidadeParcelas, 2, MidpointRounding.AwayFromZero);
        return numeroParcela == quantidadeParcelas
            ? valorTotal - (valorBase * (quantidadeParcelas - 1))
            : valorBase;
    }

    private static bool DeveEntrarComoPaga(DateOnly dataOcorrencia)
    {
        return dataOcorrencia <= DateOnly.FromDateTime(DateTime.Today);
    }

    private sealed record FaturaPeriodo(
        DateOnly InicioCompetencia,
        DateOnly FimCompetencia,
        DateOnly DataVencimento);
}
