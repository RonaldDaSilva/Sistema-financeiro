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

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var usoPorCartao = await CalcularUsoDetalhadoPorCartaoAsync(usuarioId, hoje, cancellationToken);
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

        return cartoes
            .Select(cartao => Mapear(
                cartao,
                usoPorCartao.GetValueOrDefault(cartao.Id),
                faturasAtual.GetValueOrDefault(cartao.Id),
                faturasProximoMes.GetValueOrDefault(cartao.Id)))
            .ToList();
    }

    public async Task<CartaoCreditoResponse?> ObterPorIdAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var cartao = await BuscarCartao(id, usuarioId, cancellationToken);
        if (cartao is null)
        {
            return null;
        }

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var usoPorCartao = await CalcularUsoDetalhadoPorCartaoAsync(usuarioId, hoje, cancellationToken);
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

        return Mapear(
            cartao,
            usoPorCartao.GetValueOrDefault(cartao.Id),
            faturaAtual,
            proximaFatura);
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

        return Mapear(cartao, default, null, null);
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
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var usoPorCartao = await CalcularUsoDetalhadoPorCartaoAsync(usuarioId, hoje, cancellationToken);
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

        return Mapear(
            cartao,
            usoPorCartao.GetValueOrDefault(cartao.Id),
            faturaAtual,
            proximaFatura);
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

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var usoPorCartao = await CalcularUsoDetalhadoPorCartaoAsync(usuarioId, hoje, cancellationToken);
        return Mapear(cartao, usoPorCartao.GetValueOrDefault(cartao.Id), null, null);
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

    private async Task<Dictionary<Guid, UsoCartaoDetalhado>> CalcularUsoDetalhadoPorCartaoAsync(
        Guid usuarioId,
        DateOnly hoje,
        CancellationToken cancellationToken)
    {
        var cartoes = await _dbContext.CartoesCredito
            .AsNoTracking()
            .Where(cartao => cartao.UsuarioId == usuarioId)
            .Select(cartao => cartao.Id)
            .ToListAsync(cancellationToken);

        if (cartoes.Count == 0)
        {
            return [];
        }

        var primeiraTransacaoCredito = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CartaoCreditoId.HasValue &&
                transacao.Tipo == TipoTransacao.Despesa &&
                transacao.FormaPagamento != FormaPagamentoFaturaCartao)
            .MinAsync(transacao => (DateOnly?)transacao.DataOcorrencia, cancellationToken);

        var comprasParceladas = await _dbContext.ComprasParceladas
            .AsNoTracking()
            .Where(compra =>
                compra.UsuarioId == usuarioId &&
                compra.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito &&
                compra.CartaoCreditoId.HasValue)
            .Select(compra => new
            {
                compra.DataCompra,
                compra.QuantidadeParcelas
            })
            .ToListAsync(cancellationToken);

        var primeiraCompraParceladaCredito = comprasParceladas.Count == 0
            ? null
            : comprasParceladas.Min(compra => (DateOnly?)compra.DataCompra);

        var primeiraDataCredito = new[] { primeiraTransacaoCredito, primeiraCompraParceladaCredito }
            .Where(data => data.HasValue)
            .Select(data => data!.Value)
            .DefaultIfEmpty()
            .Min();

        if (primeiraDataCredito == default)
        {
            return [];
        }

        var ultimaTransacaoCredito = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.CartaoCreditoId.HasValue &&
                transacao.Tipo == TipoTransacao.Despesa &&
                transacao.FormaPagamento != FormaPagamentoFaturaCartao)
            .MaxAsync(transacao => (DateOnly?)transacao.DataOcorrencia, cancellationToken);

        var ultimaParcelaCredito = comprasParceladas.Count == 0
            ? null
            : comprasParceladas.Max(compra =>
            {
                var mesFinal = new DateOnly(compra.DataCompra.Year, compra.DataCompra.Month, 1)
                    .AddMonths(compra.QuantidadeParcelas - 1);
                return (DateOnly?)AjustarDiaMes(mesFinal.Year, mesFinal.Month, compra.DataCompra.Day).AddMonths(1);
            });

        var ultimaDataCredito = new DateOnly?[] { ultimaTransacaoCredito, ultimaParcelaCredito, hoje }
            .Where(data => data.HasValue)
            .Select(data => data!.Value)
            .Max();

        var mesAtual = new DateOnly(hoje.Year, hoje.Month, 1);
        var ultimoMesReferencia = new DateOnly(ultimaDataCredito.Year, ultimaDataCredito.Month, 1);

        var cursor = new DateOnly(primeiraDataCredito.Year, primeiraDataCredito.Month, 1);
        var usoPorCartao = cartoes.ToDictionary(
            cartaoId => cartaoId,
            _ => UsoCartaoDetalhado.Vazio);

        while (cursor <= ultimoMesReferencia)
        {
            var faturasDoMes = await _transacaoService.GetFaturasDoMesAsync(
                cursor.Month,
                cursor.Year,
                usuarioId,
                cancellationToken);

            foreach (var fatura in faturasDoMes.Where(fatura => !fatura.IsPaga && fatura.Detalhes.Count > 0))
            {
                var atual = usoPorCartao.GetValueOrDefault(fatura.CartaoCreditoId);
                var valorLimiteFatura = SomarValorLimite(fatura.Detalhes);

                if (cursor < mesAtual)
                {
                    usoPorCartao[fatura.CartaoCreditoId] = atual with
                    {
                        ValorFaturasFechadasNaoPagas = atual.ValorFaturasFechadasNaoPagas + valorLimiteFatura
                    };
                    continue;
                }

                if (cursor == mesAtual)
                {
                    usoPorCartao[fatura.CartaoCreditoId] = atual with
                    {
                        ValorFaturaAtual = atual.ValorFaturaAtual + valorLimiteFatura
                    };
                    continue;
                }

                var parcelasFuturas = fatura.Detalhes
                    .Where(detalhe => detalhe.CompraParceladaId.HasValue)
                    .ToList();
                var valorParcelasFuturas = SomarValorLimite(parcelasFuturas);
                var valorProximasFaturas = valorLimiteFatura - valorParcelasFuturas;

                usoPorCartao[fatura.CartaoCreditoId] = atual with
                {
                    ValorProximasFaturas = atual.ValorProximasFaturas + valorProximasFaturas,
                    QuantidadeParcelasFuturas = atual.QuantidadeParcelasFuturas + parcelasFuturas.Count,
                    ValorParcelasFuturas = atual.ValorParcelasFuturas + valorParcelasFuturas
                };
            }

            cursor = cursor.AddMonths(1);
        }

        return usoPorCartao;
    }

    private static decimal SomarValorLimite(IEnumerable<FaturaDetalheResponse> detalhes)
    {
        return detalhes.Sum(detalhe =>
            detalhe.IsDividida && detalhe.ValorTotalOriginal.HasValue
                ? detalhe.ValorTotalOriginal.Value
                : detalhe.Valor);
    }

    private static void ValidarInvarianciaLimite(decimal limiteTotal, decimal limiteDisponivel, decimal valorUtilizado)
    {
        if (limiteTotal - limiteDisponivel != valorUtilizado)
        {
            throw new InvalidOperationException("Invariância de limite do cartão violada.");
        }
    }

    private static CartaoCreditoResponse Mapear(
        CartaoCredito cartao,
        UsoCartaoDetalhado uso,
        FaturaConsolidadaResponse? faturaAtual,
        FaturaConsolidadaResponse? proximaFatura)
    {
        // Regra de limite: o valor utilizado é a soma das competências de fatura ainda não pagas.
        // Parcelas futuras são projetadas pela competência de vencimento da fatura, não pela data da compra.
        var valorUtilizadoAtual = uso.ValorUtilizado;
        var limiteDisponivel = cartao.LimiteTotal - valorUtilizadoAtual;
        ValidarInvarianciaLimite(cartao.LimiteTotal, limiteDisponivel, valorUtilizadoAtual);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var possuiFaturaAtual = faturaAtual is not null && faturaAtual.Detalhes.Count > 0;
        DateOnly? dataVencimento = possuiFaturaAtual ? faturaAtual!.DataVencimento : null;
        DateOnly? dataFechamento = possuiFaturaAtual ? faturaAtual!.FimCompetencia : null;

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
            ValorFaturaAtual = uso.ValorFaturaAtual,
            ValorFaturasFechadasNaoPagas = uso.ValorFaturasFechadasNaoPagas,
            ValorProximasFaturas = uso.ValorProximasFaturas,
            QuantidadeParcelasFuturas = uso.QuantidadeParcelasFuturas,
            ValorParcelasFuturas = uso.ValorParcelasFuturas,
            ValorOutrosCompromissos = uso.ValorOutrosCompromissos,
            ValorUtilizado = valorUtilizadoAtual,
            LimiteDisponivel = limiteDisponivel,
            PercentualUtilizado = cartao.LimiteTotal <= 0
                ? 0
                : Math.Round((valorUtilizadoAtual / cartao.LimiteTotal) * 100, 2),
            FaturaAtual = possuiFaturaAtual ? faturaAtual!.ValorTotal : 0,
            StatusFaturaAtual = !possuiFaturaAtual
                ? "SemFatura"
                : faturaAtual!.IsPaga == true
                ? "Paga"
                : faturaAtual.Status,
            DataFechamentoAtual = dataFechamento,
            DataVencimentoAtual = dataVencimento,
            DiasParaFechamento = dataFechamento.HasValue
                ? dataFechamento.Value.DayNumber - hoje.DayNumber
                : null,
            DiasParaVencimento = dataVencimento.HasValue
                ? dataVencimento.Value.DayNumber - hoje.DayNumber
                : null,
            ComprasParceladasFuturas = uso.QuantidadeParcelasFuturas,
            LimiteComprometidoFuturo = uso.ValorProximasFaturas + uso.ValorParcelasFuturas + uso.ValorOutrosCompromissos,
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

    private readonly record struct UsoCartaoDetalhado(
        decimal ValorFaturaAtual,
        decimal ValorFaturasFechadasNaoPagas,
        decimal ValorProximasFaturas,
        int QuantidadeParcelasFuturas,
        decimal ValorParcelasFuturas,
        decimal ValorOutrosCompromissos)
    {
        public static UsoCartaoDetalhado Vazio => new(0m, 0m, 0m, 0, 0m, 0m);

        public decimal ValorUtilizado =>
            ValorFaturaAtual +
            ValorFaturasFechadasNaoPagas +
            ValorProximasFaturas +
            ValorParcelasFuturas +
            ValorOutrosCompromissos;
    }
}
