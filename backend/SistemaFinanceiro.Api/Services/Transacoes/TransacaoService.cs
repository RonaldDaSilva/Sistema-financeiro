using Microsoft.EntityFrameworkCore;
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

        var transacoesDoMes = await _dbContext.Transacoes
            .AsNoTracking()
            .Include(transacao => transacao.Categoria)
            .Include(transacao => transacao.CartaoCredito)
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.DataOcorrencia >= inicioMes &&
                transacao.DataOcorrencia <= fimMes)
            .ToListAsync(cancellationToken);

        var transacoesFixas = await _dbContext.Transacoes
            .AsNoTracking()
            .Include(transacao => transacao.Categoria)
            .Include(transacao => transacao.CartaoCredito)
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.IsFixa &&
                transacao.DataOcorrencia < inicioMes)
            .ToListAsync(cancellationToken);

        var transacoesFixasIds = transacoesFixas.Select(transacao => transacao.Id).ToList();
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

        var comprasCarne = await _dbContext.ComprasParceladas
            .AsNoTracking()
            .Include(compra => compra.Categoria)
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
            .Select(MapearTransacaoReal));
        itens.AddRange(transacoesFixas
            .Where(transacao => transacao.CartaoCreditoId is null)
            .Select(transacao => ProjetarTransacaoFixa(transacao, inicioMes))
            .Where(item => !excecoesFixasSet.Contains((item.Id!.Value, item.DataOcorrencia))));
        itens.AddRange(ProjetarParcelasCarneParaExtrato(
            comprasCarne,
            inicioMes,
            fimMes,
            parcelasCarneQuitadasSet));

        var faturas = await GetFaturasDoMesAsync(mes, ano, usuarioId, cancellationToken);
        itens.AddRange(faturas
            .Where(fatura => fatura.ValorTotal > 0)
            .Select(MapearFaturaParaExtrato));

        var itensOrdenados = itens
            .OrderBy(item => item.DataOcorrencia)
            .ThenBy(item => item.IsProjetada)
            .ThenBy(item => item.Descricao)
            .ToList();

        var totalReceitas = itensOrdenados
            .Where(item => item.Tipo == TipoTransacao.Receita)
            .Sum(item => item.Valor);

        var totalDespesas = itensOrdenados
            .Where(item => item.Tipo == TipoTransacao.Despesa)
            .Sum(item => item.Valor);
        var totalInvestido = itensOrdenados
            .Where(item => item.Tipo == TipoTransacao.Investimento)
            .Sum(item => item.Valor);
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var itensConsolidadosAteHoje = itensOrdenados
            .Where(item =>
                item.Tipo == TipoTransacao.Receita
                    ? item.DataOcorrencia <= hoje
                    : item.IsPaga)
            .ToList();
        var saldoAtual = CalcularSaldo(itensConsolidadosAteHoje);
        var saldoPrevistoFimDoMes = totalReceitas - totalDespesas - totalInvestido;

        return new ExtratoMensalResponse
        {
            Mes = mes,
            Ano = ano,
            TotalReceitas = totalReceitas,
            TotalDespesas = totalDespesas,
            TotalInvestido = totalInvestido,
            Saldo = saldoPrevistoFimDoMes,
            SaldoAtual = saldoAtual,
            SaldoPrevistoFimDoMes = saldoPrevistoFimDoMes,
            Itens = itensOrdenados
        };
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

        var transacoesCredito = await _dbContext.Transacoes
            .AsNoTracking()
            .Include(transacao => transacao.Categoria)
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CartaoCreditoId.HasValue &&
                transacao.Tipo == TipoTransacao.Despesa &&
                !transacao.CompraParceladaId.HasValue &&
                transacao.DataOcorrencia >= menorInicioCompetencia &&
                transacao.DataOcorrencia <= maiorFimCompetencia)
            .ToListAsync(cancellationToken);

        var transacoesFixasCredito = await _dbContext.Transacoes
            .AsNoTracking()
            .Include(transacao => transacao.Categoria)
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

        var comprasParceladas = await _dbContext.ComprasParceladas
            .AsNoTracking()
            .Include(compra => compra.Categoria)
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
                    DataVencimento = periodo.DataVencimento,
                    InicioCompetencia = periodo.InicioCompetencia,
                    FimCompetencia = periodo.FimCompetencia,
                    Status = CalcularStatusFatura(periodo.DataVencimento, periodo.FimCompetencia),
                    IsPaga = pagamentosFaturasMap.GetValueOrDefault((cartao.Id, periodo.DataVencimento)),
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

    public async Task<TransacaoResponse> CriarAsync(
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
            IsFixa = request.IsFixa,
            IsPaga = request.Tipo != TipoTransacao.Receita &&
                request.DataOcorrencia == DateOnly.FromDateTime(DateTime.Today),
            IsDividida = request.IsDividida,
            ValorTotalOriginal = request.IsDividida ? request.ValorTotalOriginal : null,
            PercentualDivisao = request.IsDividida ? request.PercentualDivisao : null,
            CompraParceladaId = request.CompraParceladaId,
            NumeroParcelaQuitada = request.NumeroParcelaQuitada
        };

        _dbContext.Transacoes.Add(transacao);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapearTransacaoResponse(transacao);
    }

    public async Task<TransacaoResponse?> AtualizarAsync(
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

                return MapearTransacaoResponse(transacaoPontual);
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

            return MapearTransacaoResponse(transacao);
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

            return MapearTransacaoResponse(novaRecorrencia);
        }

        AplicarRequestNaTransacao(transacao, request, request.IsFixa);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapearTransacaoResponse(transacao);
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
        transacao.IsFixa = isFixa;
        transacao.IsPaga = request.Tipo != TipoTransacao.Receita &&
            request.DataOcorrencia == DateOnly.FromDateTime(DateTime.Today);
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
            IsFixa = true,
            IsPaga = false,
            IsDividida = transacao.IsDividida,
            ValorTotalOriginal = transacao.ValorTotalOriginal,
            PercentualDivisao = transacao.PercentualDivisao
        };
    }

    private static ExtratoMensalItemResponse MapearTransacaoReal(Transacao transacao)
    {
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
            CartaoCreditoApelido = transacao.CartaoCredito?.ApelidoCartao,
            IsFixa = transacao.IsFixa,
            IsPaga = transacao.IsPaga,
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
            IsPaga = false,
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
                    IsPaga = false,
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

    private static ExtratoMensalItemResponse ProjetarTransacaoFixa(Transacao transacao, DateOnly inicioMes)
    {
        return new ExtratoMensalItemResponse
        {
            Id = transacao.Id,
            CodigoExibicao = transacao.CodigoExibicao,
            Tipo = transacao.Tipo,
            Descricao = transacao.Descricao,
            Valor = transacao.Valor,
            DataOcorrencia = CriarDataNoMes(inicioMes, transacao.DataOcorrencia.Day),
            CategoriaId = transacao.CategoriaId,
            CategoriaNome = transacao.Categoria?.Nome ?? "Sem categoria",
            CategoriaCorHexa = transacao.Categoria?.CorHexa ?? "#64748B",
            FormaPagamento = transacao.FormaPagamento,
            CartaoCreditoId = transacao.CartaoCreditoId,
            CartaoCreditoApelido = transacao.CartaoCredito?.ApelidoCartao,
            IsFixa = true,
            IsPaga = transacao.IsPaga,
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

    private sealed record FaturaPeriodo(
        DateOnly InicioCompetencia,
        DateOnly FimCompetencia,
        DateOnly DataVencimento);
}
