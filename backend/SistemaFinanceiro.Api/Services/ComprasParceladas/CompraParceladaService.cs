using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.ComprasParceladas;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.ComprasParceladas;

public sealed class CompraParceladaService : ICompraParceladaService
{
    private readonly AppDbContext _dbContext;

    public CompraParceladaService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<CompraParceladaResponse> CriarAsync(
        CriarCompraParceladaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var categoriaExiste = await _dbContext.Categorias
            .AnyAsync(
                categoria => categoria.Id == request.CategoriaId &&
                    (categoria.UsuarioId == null || categoria.UsuarioId == usuarioId),
                cancellationToken);

        if (!categoriaExiste)
        {
            throw new InvalidOperationException("Categoria não encontrada para este usuário.");
        }

        await ValidarFormaPagamentoAsync(request, usuarioId, cancellationToken);

        var compra = new CompraParcelada
        {
            UsuarioId = usuarioId,
            CartaoCreditoId = request.CartaoCreditoId,
            CategoriaId = request.CategoriaId,
            Descricao = request.Descricao.Trim(),
            QuantidadeParcelas = request.QuantidadeParcelas,
            ValorTotal = request.ValorTotal,
            DataCompra = request.DataCompra,
            DataPrimeiroVencimento = request.FormaPagamento == FormaPagamentoCompraParcelada.Carne
                ? request.DataPrimeiroVencimento
                : null,
            FormaPagamento = request.FormaPagamento
        };

        _dbContext.ComprasParceladas.Add(compra);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Mapear(compra);
    }

    public async Task<CompraParceladaResponse?> AtualizarProjecaoAsync(
        Guid id,
        int numeroParcela,
        DateOnly dataOcorrencia,
        CriarCompraParceladaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var compraOriginal = await _dbContext.ComprasParceladas
            .SingleOrDefaultAsync(compra => compra.Id == id && compra.UsuarioId == usuarioId, cancellationToken);

        if (compraOriginal is null)
        {
            return null;
        }

        ValidarNumeroParcela(compraOriginal, numeroParcela);
        await ValidarRelacionamentosAsync(request, usuarioId, cancellationToken);

        var parcelasRestantes = compraOriginal.QuantidadeParcelas - numeroParcela + 1;
        var novaCompra = new CompraParcelada
        {
            UsuarioId = usuarioId,
            CartaoCreditoId = request.CartaoCreditoId,
            CategoriaId = request.CategoriaId,
            Descricao = request.Descricao.Trim(),
            QuantidadeParcelas = parcelasRestantes,
            ValorTotal = request.ValorTotal,
            DataCompra = request.FormaPagamento == FormaPagamentoCompraParcelada.Carne
                ? request.DataCompra
                : dataOcorrencia,
            DataPrimeiroVencimento = request.FormaPagamento == FormaPagamentoCompraParcelada.Carne
                ? request.DataPrimeiroVencimento ?? dataOcorrencia
                : null,
            FormaPagamento = request.FormaPagamento
        };

        if (numeroParcela == 1)
        {
            _dbContext.ComprasParceladas.Remove(compraOriginal);
        }
        else
        {
            compraOriginal.ValorTotal = SomarParcelas(compraOriginal, numeroParcela - 1);
            compraOriginal.QuantidadeParcelas = numeroParcela - 1;
        }

        _dbContext.ComprasParceladas.Add(novaCompra);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Mapear(novaCompra);
    }

    public async Task<bool> ExcluirProjecaoAsync(
        Guid id,
        int numeroParcela,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var compra = await _dbContext.ComprasParceladas
            .SingleOrDefaultAsync(compra => compra.Id == id && compra.UsuarioId == usuarioId, cancellationToken);

        if (compra is null)
        {
            return false;
        }

        ValidarNumeroParcela(compra, numeroParcela);

        if (numeroParcela == 1)
        {
            _dbContext.ComprasParceladas.Remove(compra);
        }
        else
        {
            compra.ValorTotal = SomarParcelas(compra, numeroParcela - 1);
            compra.QuantidadeParcelas = numeroParcela - 1;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task ValidarRelacionamentosAsync(
        CriarCompraParceladaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var categoriaExiste = await _dbContext.Categorias
            .AnyAsync(
                categoria => categoria.Id == request.CategoriaId &&
                    (categoria.UsuarioId == null || categoria.UsuarioId == usuarioId),
                cancellationToken);

        if (!categoriaExiste)
        {
            throw new InvalidOperationException("Categoria não encontrada para este usuário.");
        }

        await ValidarFormaPagamentoAsync(request, usuarioId, cancellationToken);
    }

    private async Task ValidarFormaPagamentoAsync(
        CriarCompraParceladaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        if (request.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito)
        {
            if (!request.CartaoCreditoId.HasValue)
            {
                throw new InvalidOperationException("Cartão de crédito é obrigatório para compras parceladas no cartão.");
            }

            var cartaoExiste = await _dbContext.CartoesCredito
                .AnyAsync(
                    cartao => cartao.Id == request.CartaoCreditoId.Value && cartao.UsuarioId == usuarioId,
                    cancellationToken);

            if (!cartaoExiste)
            {
                throw new InvalidOperationException("Cartão de crédito não encontrado para este usuário.");
            }

            return;
        }

        if (request.FormaPagamento == FormaPagamentoCompraParcelada.Carne)
        {
            if (!request.DataPrimeiroVencimento.HasValue)
            {
                throw new InvalidOperationException("Data do primeiro vencimento é obrigatória para carnê/crediário.");
            }

            if (request.CartaoCreditoId.HasValue)
            {
                throw new InvalidOperationException("Carnê/crediário não deve possuir cartão de crédito.");
            }

            return;
        }

        throw new InvalidOperationException("Forma de pagamento inválida para compra parcelada.");
    }

    private static void ValidarNumeroParcela(CompraParcelada compra, int numeroParcela)
    {
        if (numeroParcela < 1 || numeroParcela > compra.QuantidadeParcelas)
        {
            throw new InvalidOperationException("Número da parcela inválido para esta compra parcelada.");
        }
    }

    private static decimal SomarParcelas(CompraParcelada compra, int ateParcela)
    {
        return Enumerable.Range(1, ateParcela)
            .Sum(numero => CalcularValorParcela(compra.ValorTotal, compra.QuantidadeParcelas, numero));
    }

    private static decimal CalcularValorParcela(decimal valorTotal, int quantidadeParcelas, int numeroParcela)
    {
        var valorBase = Math.Round(valorTotal / quantidadeParcelas, 2, MidpointRounding.AwayFromZero);
        return numeroParcela == quantidadeParcelas
            ? valorTotal - (valorBase * (quantidadeParcelas - 1))
            : valorBase;
    }

    private static CompraParceladaResponse Mapear(CompraParcelada compra)
    {
        return new CompraParceladaResponse
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
            FormaPagamento = compra.FormaPagamento
        };
    }
}
