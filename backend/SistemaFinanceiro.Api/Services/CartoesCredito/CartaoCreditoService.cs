using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.CartoesCredito;
using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Transacoes;

namespace SistemaFinanceiro.Api.Services.CartoesCredito;

public sealed class CartaoCreditoService : ICartaoCreditoService
{
    private const string FormaPagamentoFaturaCartao = "Pagamento de fatura";

    private readonly AppDbContext _dbContext;
    private readonly ITransacaoService _transacaoService;

    public CartaoCreditoService(AppDbContext dbContext, ITransacaoService transacaoService)
    {
        _dbContext = dbContext;
        _transacaoService = transacaoService;
    }

    public async Task<IReadOnlyList<CartaoCreditoResponse>> ListarAsync(Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var cartoes = await _dbContext.CartoesCredito
            .AsNoTracking()
            .Include(cartao => cartao.ContaBancaria)
            .Where(cartao => cartao.UsuarioId == usuarioId && !cartao.IsArquivado)
            .OrderBy(cartao => cartao.ApelidoCartao)
            .ToListAsync(cancellationToken);

        var usoPorCartao = await CalcularUsoPorCartaoAsync(usuarioId, cancellationToken);
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var faturasAtual = (await _transacaoService.GetFaturasDoMesAsync(
                hoje.Month,
                hoje.Year,
                usuarioId,
                cancellationToken))
            .ToDictionary(fatura => fatura.CartaoCreditoId);
        var proximoMes = new DateOnly(hoje.Year, hoje.Month, 1).AddMonths(1);
        var faturasProximoMes = (await _transacaoService.GetFaturasDoMesAsync(
                proximoMes.Month,
                proximoMes.Year,
                usuarioId,
                cancellationToken))
            .ToDictionary(fatura => fatura.CartaoCreditoId);
        var futuroPorCartao = await CalcularCompromissoFuturoAsync(usuarioId, hoje, cancellationToken);

        return cartoes
            .Select(cartao => Mapear(
                cartao,
                usoPorCartao.GetValueOrDefault(cartao.Id),
                faturasAtual.GetValueOrDefault(cartao.Id),
                faturasProximoMes.GetValueOrDefault(cartao.Id),
                futuroPorCartao.GetValueOrDefault(cartao.Id)))
            .ToList();
    }

    public async Task<CartaoCreditoResponse?> ObterPorIdAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var cartao = await BuscarCartao(id, usuarioId, cancellationToken);
        if (cartao is null)
        {
            return null;
        }

        var usoPorCartao = await CalcularUsoPorCartaoAsync(usuarioId, cancellationToken);
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var faturaAtual = (await _transacaoService.GetFaturasDoMesAsync(
                hoje.Month,
                hoje.Year,
                usuarioId,
                cancellationToken))
            .FirstOrDefault(fatura => fatura.CartaoCreditoId == cartao.Id);
        var proximoMes = new DateOnly(hoje.Year, hoje.Month, 1).AddMonths(1);
        var proximaFatura = (await _transacaoService.GetFaturasDoMesAsync(
                proximoMes.Month,
                proximoMes.Year,
                usuarioId,
                cancellationToken))
            .FirstOrDefault(fatura => fatura.CartaoCreditoId == cartao.Id);
        var futuroPorCartao = await CalcularCompromissoFuturoAsync(usuarioId, hoje, cancellationToken);

        return Mapear(
            cartao,
            usoPorCartao.GetValueOrDefault(cartao.Id),
            faturaAtual,
            proximaFatura,
            futuroPorCartao.GetValueOrDefault(cartao.Id));
    }

    public async Task<CartaoCreditoResponse> CriarAsync(
        CartaoCreditoRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        ValidarRequest(request);
        await ValidarContaBancariaAsync(request.ContaBancariaId, usuarioId, cancellationToken);

        var cartao = new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = request.ApelidoCartao.Trim(),
            Banco = request.Banco.Trim(),
            DiaVencimento = request.DiaVencimento,
            MelhorDiaCompra = request.MelhorDiaCompra,
            LimiteTotal = request.LimiteTotal,
            ContaBancariaId = request.ContaBancariaId
        };

        _dbContext.CartoesCredito.Add(cartao);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Mapear(cartao, 0m, null, null, default);
    }

    public async Task<CartaoCreditoResponse?> AtualizarAsync(
        Guid id,
        CartaoCreditoRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var cartao = await BuscarCartao(id, usuarioId, cancellationToken);
        if (cartao is null)
        {
            return null;
        }

        ValidarRequest(request);
        await ValidarContaBancariaAsync(request.ContaBancariaId, usuarioId, cancellationToken);

        cartao.ApelidoCartao = request.ApelidoCartao.Trim();
        cartao.Banco = request.Banco.Trim();
        cartao.DiaVencimento = request.DiaVencimento;
        cartao.MelhorDiaCompra = request.MelhorDiaCompra;
        cartao.LimiteTotal = request.LimiteTotal;
        cartao.ContaBancariaId = request.ContaBancariaId;

        await _dbContext.SaveChangesAsync(cancellationToken);
        var usoPorCartao = await CalcularUsoPorCartaoAsync(usuarioId, cancellationToken);
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var faturaAtual = (await _transacaoService.GetFaturasDoMesAsync(
                hoje.Month,
                hoje.Year,
                usuarioId,
                cancellationToken))
            .FirstOrDefault(fatura => fatura.CartaoCreditoId == cartao.Id);
        var proximoMes = new DateOnly(hoje.Year, hoje.Month, 1).AddMonths(1);
        var proximaFatura = (await _transacaoService.GetFaturasDoMesAsync(
                proximoMes.Month,
                proximoMes.Year,
                usuarioId,
                cancellationToken))
            .FirstOrDefault(fatura => fatura.CartaoCreditoId == cartao.Id);
        var futuroPorCartao = await CalcularCompromissoFuturoAsync(usuarioId, hoje, cancellationToken);

        return Mapear(
            cartao,
            usoPorCartao.GetValueOrDefault(cartao.Id),
            faturaAtual,
            proximaFatura,
            futuroPorCartao.GetValueOrDefault(cartao.Id));
    }

    public async Task<CartaoCreditoResponse?> ArquivarAsync(
        Guid id,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var cartao = await BuscarCartao(id, usuarioId, cancellationToken);
        if (cartao is null)
        {
            return null;
        }

        cartao.IsArquivado = true;
        await _dbContext.SaveChangesAsync(cancellationToken);

        var usoPorCartao = await CalcularUsoPorCartaoAsync(usuarioId, cancellationToken);
        return Mapear(cartao, usoPorCartao.GetValueOrDefault(cartao.Id), null, null, default);
    }

    public async Task<bool> ExcluirAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var cartao = await BuscarCartao(id, usuarioId, cancellationToken);
        if (cartao is null)
        {
            return false;
        }

        var possuiVinculos = await _dbContext.Transacoes
            .AsNoTracking()
            .AnyAsync(
                transacao => transacao.UsuarioId == usuarioId &&
                    transacao.CartaoCreditoId == id,
                cancellationToken) ||
            await _dbContext.ComprasParceladas
                .AsNoTracking()
                .AnyAsync(
                    compra => compra.UsuarioId == usuarioId &&
                        compra.CartaoCreditoId == id,
                    cancellationToken) ||
            await _dbContext.FaturasCartaoPagamentos
                .AsNoTracking()
                .AnyAsync(
                    fatura => fatura.UsuarioId == usuarioId &&
                        fatura.CartaoCreditoId == id,
                    cancellationToken);

        if (possuiVinculos)
        {
            cartao.IsArquivado = true;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        _dbContext.CartoesCredito.Remove(cartao);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<CartaoCredito?> BuscarCartao(Guid id, Guid usuarioId, CancellationToken cancellationToken)
    {
        return await _dbContext.CartoesCredito
            .Include(cartao => cartao.ContaBancaria)
            .SingleOrDefaultAsync(cartao => cartao.Id == id && cartao.UsuarioId == usuarioId, cancellationToken);
    }

    private async Task<Dictionary<Guid, decimal>> CalcularUsoPorCartaoAsync(
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var transacoes = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CartaoCreditoId.HasValue &&
                !transacao.CompraParceladaId.HasValue &&
                transacao.FormaPagamento != FormaPagamentoFaturaCartao)
            .Select(transacao => new
            {
                CartaoId = transacao.CartaoCreditoId!.Value,
                ValorLimite = transacao.IsDividida && transacao.ValorTotalOriginal.HasValue
                    ? transacao.ValorTotalOriginal.Value
                    : transacao.Valor
            })
            .ToListAsync(cancellationToken);

        var comprasParceladas = await _dbContext.ComprasParceladas
            .AsNoTracking()
            .Where(compra =>
                compra.UsuarioId == usuarioId &&
                compra.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito &&
                compra.CartaoCreditoId.HasValue)
            .Select(compra => new
            {
                compra.Id,
                CartaoId = compra.CartaoCreditoId!.Value,
                compra.QuantidadeParcelas,
                compra.IsDividida,
                compra.ValorTotalOriginal,
                compra.ValorTotal,
                ValorLimite = compra.IsDividida && compra.ValorTotalOriginal.HasValue
                    ? compra.ValorTotalOriginal.Value
                    : compra.ValorTotal
            })
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

        var parcelasQuitadasPorCompra = parcelasQuitadas
            .GroupBy(parcela => parcela.CompraParceladaId)
            .ToDictionary(
                grupo => grupo.Key,
                grupo => grupo.Select(parcela => parcela.NumeroParcela).Distinct().ToList());

        var usoComprasParceladas = comprasParceladas.Select(compra =>
        {
            var valorRestituido = parcelasQuitadasPorCompra
                .GetValueOrDefault(compra.Id, [])
                .Where(numeroParcela => numeroParcela >= 1 && numeroParcela <= compra.QuantidadeParcelas)
                .Sum(numeroParcela => CalcularValorParcela(
                    compra.IsDividida && compra.ValorTotalOriginal.HasValue
                        ? compra.ValorTotalOriginal.Value
                        : compra.ValorTotal,
                    compra.QuantidadeParcelas,
                    numeroParcela));

            return new
            {
                compra.CartaoId,
                ValorLimite = Math.Max(0m, compra.ValorLimite - valorRestituido)
            };
        });

        var usoBrutoPorCartao = transacoes
            .Concat(usoComprasParceladas)
            .GroupBy(item => item.CartaoId)
            .ToDictionary(grupo => grupo.Key, grupo => grupo.Sum(item => item.ValorLimite));

        var faturasPagasPorCartao = await CalcularFaturasPagasPorCartaoAsync(usuarioId, cancellationToken);

        return usoBrutoPorCartao
            .ToDictionary(
                item => item.Key,
                item => Math.Max(0m, item.Value - faturasPagasPorCartao.GetValueOrDefault(item.Key)));
    }

    private async Task<Dictionary<Guid, decimal>> CalcularFaturasPagasPorCartaoAsync(
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var primeiraTransacaoCredito = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CartaoCreditoId.HasValue &&
                transacao.Tipo == TipoTransacao.Despesa &&
                transacao.FormaPagamento != FormaPagamentoFaturaCartao)
            .MinAsync(transacao => (DateOnly?)transacao.DataOcorrencia, cancellationToken);

        var primeiraCompraParceladaCredito = await _dbContext.ComprasParceladas
            .AsNoTracking()
            .Where(compra =>
                compra.UsuarioId == usuarioId &&
                compra.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito &&
                compra.CartaoCreditoId.HasValue)
            .MinAsync(compra => (DateOnly?)compra.DataCompra, cancellationToken);

        var primeiraDataCredito = new[] { primeiraTransacaoCredito, primeiraCompraParceladaCredito }
            .Where(data => data.HasValue)
            .Select(data => data!.Value)
            .DefaultIfEmpty()
            .Min();

        if (primeiraDataCredito == default)
        {
            return [];
        }

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var ultimaFaturaMarcada = await _dbContext.FaturasCartaoPagamentos
            .AsNoTracking()
            .Where(pagamento =>
                pagamento.UsuarioId == usuarioId &&
                pagamento.IsPaga)
            .MaxAsync(pagamento => (DateOnly?)pagamento.DataVencimento, cancellationToken);

        var ultimoMesReferencia = ultimaFaturaMarcada.HasValue && ultimaFaturaMarcada.Value > hoje
            ? new DateOnly(ultimaFaturaMarcada.Value.Year, ultimaFaturaMarcada.Value.Month, 1)
            : new DateOnly(hoje.Year, hoje.Month, 1);

        var cursor = new DateOnly(primeiraDataCredito.Year, primeiraDataCredito.Month, 1);
        var faturasPagasPorCartao = new Dictionary<Guid, decimal>();

        while (cursor <= ultimoMesReferencia)
        {
            var faturasDoMes = await _transacaoService.GetFaturasDoMesAsync(
                cursor.Month,
                cursor.Year,
                usuarioId,
                cancellationToken);

            foreach (var fatura in faturasDoMes.Where(fatura => fatura.IsPaga && fatura.ValorTotal > 0))
            {
                faturasPagasPorCartao[fatura.CartaoCreditoId] =
                    faturasPagasPorCartao.GetValueOrDefault(fatura.CartaoCreditoId) +
                    fatura.Detalhes.Sum(detalhe =>
                        detalhe.IsDividida && detalhe.ValorTotalOriginal.HasValue
                            ? detalhe.ValorTotalOriginal.Value
                            : detalhe.Valor);
            }

            cursor = cursor.AddMonths(1);
        }

        return faturasPagasPorCartao;
    }

    private static decimal CalcularValorParcela(decimal valorTotal, int quantidadeParcelas, int numeroParcela)
    {
        var valorBase = Math.Round(valorTotal / quantidadeParcelas, 2, MidpointRounding.AwayFromZero);
        return numeroParcela == quantidadeParcelas
            ? valorTotal - (valorBase * (quantidadeParcelas - 1))
            : valorBase;
    }

    private async Task<Dictionary<Guid, CompromissoFuturoCartao>> CalcularCompromissoFuturoAsync(
        Guid usuarioId,
        DateOnly hoje,
        CancellationToken cancellationToken)
    {
        var compras = await _dbContext.ComprasParceladas
            .AsNoTracking()
            .Where(compra =>
                compra.UsuarioId == usuarioId &&
                compra.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito &&
                compra.CartaoCreditoId.HasValue &&
                compra.DataCompra > hoje)
            .Select(compra => new
            {
                CartaoId = compra.CartaoCreditoId!.Value,
                compra.IsDividida,
                compra.ValorTotalOriginal,
                compra.ValorTotal
            })
            .ToListAsync(cancellationToken);

        return compras
            .GroupBy(compra => compra.CartaoId)
            .ToDictionary(
                grupo => grupo.Key,
                grupo => new CompromissoFuturoCartao(
                    grupo.Count(),
                    grupo.Sum(compra =>
                        compra.IsDividida && compra.ValorTotalOriginal.HasValue
                            ? compra.ValorTotalOriginal.Value
                            : compra.ValorTotal)));
    }

    private static CartaoCreditoResponse Mapear(
        CartaoCredito cartao,
        decimal valorUtilizado,
        FaturaConsolidadaResponse? faturaAtual,
        FaturaConsolidadaResponse? proximaFatura,
        CompromissoFuturoCartao futuro)
    {
        var valorUtilizadoAtual = Math.Max(0m, valorUtilizado);
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var dataVencimento = faturaAtual?.DataVencimento ?? AjustarDiaMes(hoje.Year, hoje.Month, cartao.DiaVencimento);
        var dataFechamento = faturaAtual?.FimCompetencia ?? AjustarDiaMes(hoje.Year, hoje.Month, cartao.MelhorDiaCompra).AddDays(-1);

        return new CartaoCreditoResponse
        {
            Id = cartao.Id,
            UsuarioId = cartao.UsuarioId,
            ApelidoCartao = cartao.ApelidoCartao,
            Banco = cartao.Banco,
            DiaVencimento = cartao.DiaVencimento,
            MelhorDiaCompra = cartao.MelhorDiaCompra,
            LimiteTotal = cartao.LimiteTotal,
            ContaBancariaId = cartao.ContaBancariaId,
            ContaBancariaNome = cartao.ContaBancaria?.NomeCustomizado,
            IsArquivado = cartao.IsArquivado,
            ValorUtilizado = valorUtilizadoAtual,
            LimiteDisponivel = cartao.LimiteTotal - valorUtilizadoAtual,
            PercentualUtilizado = cartao.LimiteTotal <= 0
                ? 0
                : Math.Round((valorUtilizadoAtual / cartao.LimiteTotal) * 100, 2),
            FaturaAtual = faturaAtual?.ValorTotal ?? 0,
            StatusFaturaAtual = faturaAtual?.IsPaga == true
                ? "Paga"
                : faturaAtual?.Status ?? "Aberta",
            DataFechamentoAtual = dataFechamento,
            DataVencimentoAtual = dataVencimento,
            DiasParaFechamento = dataFechamento.DayNumber - hoje.DayNumber,
            DiasParaVencimento = dataVencimento.DayNumber - hoje.DayNumber,
            ComprasParceladasFuturas = futuro.QuantidadeCompras,
            LimiteComprometidoFuturo = futuro.ValorComprometido,
            ProximaFaturaValor = proximaFatura?.ValorTotal ?? 0,
            ProximaFaturaVencimento = proximaFatura?.DataVencimento
        };
    }

    private static DateOnly AjustarDiaMes(int ano, int mes, int dia)
    {
        var diaSeguro = Math.Clamp(dia, 1, DateTime.DaysInMonth(ano, mes));
        return new DateOnly(ano, mes, diaSeguro);
    }

    private static void ValidarRequest(CartaoCreditoRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ApelidoCartao))
        {
            throw new InvalidOperationException("Nome do cartão é obrigatório.");
        }

        if (request.LimiteTotal <= 0)
        {
            throw new InvalidOperationException("Limite do cartão deve ser maior que zero.");
        }

        if (request.DiaVencimento is < 1 or > 31 || request.MelhorDiaCompra is < 1 or > 31)
        {
            throw new InvalidOperationException("Vencimento e melhor dia devem estar entre 1 e 31.");
        }
    }

    private async Task ValidarContaBancariaAsync(
        Guid? contaBancariaId,
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        if (!contaBancariaId.HasValue)
        {
            return;
        }

        var contaExiste = await _dbContext.ContasBancarias
            .AsNoTracking()
            .AnyAsync(
                conta => conta.Id == contaBancariaId.Value &&
                    conta.UsuarioId == usuarioId &&
                    !conta.IsArquivada,
                cancellationToken);

        if (!contaExiste)
        {
            throw new InvalidOperationException("Conta bancária não encontrada para este usuário.");
        }
    }

    private readonly record struct CompromissoFuturoCartao(int QuantidadeCompras, decimal ValorComprometido);
}
