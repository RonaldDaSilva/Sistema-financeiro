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

        return cartoes.Select(Mapear).ToList();
    }

    public async Task<CartaoCreditoResponse?> ObterPorIdAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var cartao = await BuscarCartao(id, usuarioId, cancellationToken);
        return cartao is null ? null : Mapear(cartao);
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

        return Mapear(cartao);
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
        return Mapear(cartao);
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

    private static CartaoCreditoResponse Mapear(CartaoCredito cartao)
    {
        return new CartaoCreditoResponse
        {
            Id = cartao.Id,
            UsuarioId = cartao.UsuarioId,
            ApelidoCartao = cartao.ApelidoCartao,
            Banco = cartao.Banco,
            DiaVencimento = cartao.DiaVencimento,
            MelhorDiaCompra = cartao.MelhorDiaCompra,
            LimiteTotal = cartao.LimiteTotal
        };
    }
}
