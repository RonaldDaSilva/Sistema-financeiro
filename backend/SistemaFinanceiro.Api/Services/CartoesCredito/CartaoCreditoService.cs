using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.CartoesCredito;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.CartoesCredito;

public sealed class CartaoCreditoService : ICartaoCreditoService
{
    private readonly AppDbContext _dbContext;

    public CartaoCreditoService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<CartaoCreditoResponse>> ListarAsync(Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var cartoes = await _dbContext.CartoesCredito
            .AsNoTracking()
            .Where(cartao => cartao.UsuarioId == usuarioId)
            .OrderBy(cartao => cartao.ApelidoCartao)
            .ToListAsync(cancellationToken);

        var usoPorCartao = await CalcularUsoPorCartaoAsync(usuarioId, cancellationToken);
        return cartoes
            .Select(cartao => Mapear(cartao, usoPorCartao.GetValueOrDefault(cartao.Id)))
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
        return Mapear(cartao, usoPorCartao.GetValueOrDefault(cartao.Id));
    }

    public async Task<CartaoCreditoResponse> CriarAsync(
        CartaoCreditoRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var cartao = new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = request.ApelidoCartao.Trim(),
            Banco = request.Banco.Trim(),
            DiaVencimento = request.DiaVencimento,
            MelhorDiaCompra = request.MelhorDiaCompra,
            LimiteTotal = request.LimiteTotal
        };

        _dbContext.CartoesCredito.Add(cartao);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Mapear(cartao, 0m);
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

        cartao.ApelidoCartao = request.ApelidoCartao.Trim();
        cartao.Banco = request.Banco.Trim();
        cartao.DiaVencimento = request.DiaVencimento;
        cartao.MelhorDiaCompra = request.MelhorDiaCompra;
        cartao.LimiteTotal = request.LimiteTotal;

        await _dbContext.SaveChangesAsync(cancellationToken);
        var usoPorCartao = await CalcularUsoPorCartaoAsync(usuarioId, cancellationToken);
        return Mapear(cartao, usoPorCartao.GetValueOrDefault(cartao.Id));
    }

    public async Task<bool> ExcluirAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var cartao = await BuscarCartao(id, usuarioId, cancellationToken);
        if (cartao is null)
        {
            return false;
        }

        _dbContext.CartoesCredito.Remove(cartao);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<CartaoCredito?> BuscarCartao(Guid id, Guid usuarioId, CancellationToken cancellationToken)
    {
        return await _dbContext.CartoesCredito
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
                !transacao.CompraParceladaId.HasValue)
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

        return transacoes
            .Concat(usoComprasParceladas)
            .GroupBy(item => item.CartaoId)
            .ToDictionary(grupo => grupo.Key, grupo => grupo.Sum(item => item.ValorLimite));
    }

    private static decimal CalcularValorParcela(decimal valorTotal, int quantidadeParcelas, int numeroParcela)
    {
        var valorBase = Math.Round(valorTotal / quantidadeParcelas, 2, MidpointRounding.AwayFromZero);
        return numeroParcela == quantidadeParcelas
            ? valorTotal - (valorBase * (quantidadeParcelas - 1))
            : valorBase;
    }

    private static CartaoCreditoResponse Mapear(CartaoCredito cartao, decimal valorUtilizado)
    {
        return new CartaoCreditoResponse
        {
            Id = cartao.Id,
            UsuarioId = cartao.UsuarioId,
            ApelidoCartao = cartao.ApelidoCartao,
            Banco = cartao.Banco,
            DiaVencimento = cartao.DiaVencimento,
            MelhorDiaCompra = cartao.MelhorDiaCompra,
            LimiteTotal = cartao.LimiteTotal,
            LimiteDisponivel = cartao.LimiteTotal - valorUtilizado
        };
    }
}
