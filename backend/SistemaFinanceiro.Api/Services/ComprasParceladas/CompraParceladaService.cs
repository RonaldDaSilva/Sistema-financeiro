using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.ComprasParceladas;
using SistemaFinanceiro.Api.Dtos.Divisoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Divisoes;

namespace SistemaFinanceiro.Api.Services.ComprasParceladas;

public sealed class CompraParceladaService : ICompraParceladaService
{
    private readonly AppDbContext _dbContext;
    private readonly IDivisaoTransacaoService? _divisaoTransacaoService;

    public CompraParceladaService(
        AppDbContext dbContext,
        IDivisaoTransacaoService? divisaoTransacaoService = null)
    {
        _dbContext = dbContext;
        _divisaoTransacaoService = divisaoTransacaoService;
    }

    public async Task<CompraParceladaResponse> CriarAsync(
        CriarCompraParceladaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        if (request.QuantidadeParcelas < 2)
        {
            throw new InvalidOperationException(
                "Uma nova compra parcelada deve possuir pelo menos 2 parcelas.");
        }

        ValidarDivisao(request);
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

        if (request.DivisaoVinculada is not null && !request.IsDividida)
        {
            throw new InvalidOperationException("A divisão vinculada exige uma compra marcada como dividida.");
        }

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
            FormaPagamento = request.FormaPagamento,
            IsDividida = request.IsDividida,
            ValorTotalOriginal = request.IsDividida ? request.ValorTotalOriginal : null,
            PercentualDivisao = request.IsDividida ? request.PercentualDivisao : null
        };

        await using var dbTransaction = request.DivisaoVinculada is not null
            ? await _dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        _dbContext.ComprasParceladas.Add(compra);
        await _dbContext.SaveChangesAsync(cancellationToken);

        Guid? divisaoTransacaoId = null;
        if (request.DivisaoVinculada is not null)
        {
            if (_divisaoTransacaoService is null)
            {
                throw new InvalidOperationException("Serviço de divisão vinculada não configurado.");
            }

            var divisao = await _divisaoTransacaoService.CriarConviteAsync(
                usuarioId,
                new CriarConviteDivisaoRequest
                {
                    CompraParceladaId = compra.Id,
                    ParticipantesUsuarios = request.DivisaoVinculada.ParticipantesUsuarios,
                    ParticipantesExternos = request.DivisaoVinculada.ParticipantesExternos
                },
                cancellationToken);
            divisaoTransacaoId = divisao.Id;
            await dbTransaction!.CommitAsync(cancellationToken);
        }

        return Mapear(compra, divisaoTransacaoId);
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
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(compra => compra.Id == id && compra.UsuarioId == usuarioId, cancellationToken);

        if (compraOriginal is null)
        {
            return null;
        }

        var participacaoCompartilhada = await _dbContext.DivisoesTransacoesParticipantes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(item =>
                item.CompraParceladaGeradaId == compraOriginal.Id &&
                item.ParticipanteUsuarioId == usuarioId &&
                item.Ativo,
                cancellationToken);
        if (participacaoCompartilhada is not null)
        {
            if (request.ValorTotal != participacaoCompartilhada.Valor ||
                request.QuantidadeParcelas != compraOriginal.QuantidadeParcelas ||
                request.IsDividida || request.ValorTotalOriginal.HasValue ||
                request.PercentualDivisao.HasValue || request.DivisaoVinculada is not null)
            {
                throw new InvalidOperationException(
                    "Valor, parcelas e responsabilidade compartilhada exigem o fluxo de alteração da divisão.");
            }

            await ValidarRelacionamentosAsync(request, usuarioId, cancellationToken);
            compraOriginal.CategoriaId = request.CategoriaId;
            compraOriginal.CartaoCreditoId = request.CartaoCreditoId;
            compraOriginal.Descricao = request.Descricao.Trim();
            compraOriginal.FormaPagamento = request.FormaPagamento;
            compraOriginal.DataCompra = request.FormaPagamento == FormaPagamentoCompraParcelada.Carne
                ? request.DataCompra
                : dataOcorrencia;
            compraOriginal.DataPrimeiroVencimento = request.FormaPagamento == FormaPagamentoCompraParcelada.Carne
                ? request.DataPrimeiroVencimento ?? dataOcorrencia
                : null;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return Mapear(compraOriginal);
        }

        var divisaoComoCriador = await _dbContext.DivisoesTransacoes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(item =>
                item.CompraParceladaId == compraOriginal.Id &&
                item.UsuarioCriadorId == usuarioId &&
                item.EncerradoEm == null,
                cancellationToken);
        if (divisaoComoCriador is not null)
        {
            ValidarNumeroParcela(compraOriginal, numeroParcela);
            if (!request.IsDividida || request.DivisaoVinculada is not null ||
                request.FormaPagamento != compraOriginal.FormaPagamento)
            {
                throw new InvalidOperationException(
                    "Valor, parcelas, origem e responsabilidade compartilhada exigem o fluxo de alteração da divisão.");
            }

            await ValidarRelacionamentosAsync(request, usuarioId, cancellationToken);
            compraOriginal.CategoriaId = request.CategoriaId;
            compraOriginal.CartaoCreditoId = request.CartaoCreditoId;
            compraOriginal.Descricao = request.Descricao.Trim();
            if (numeroParcela == 1)
            {
                compraOriginal.DataCompra = request.FormaPagamento == FormaPagamentoCompraParcelada.Carne
                    ? request.DataCompra
                    : dataOcorrencia;
                compraOriginal.DataPrimeiroVencimento = request.FormaPagamento == FormaPagamentoCompraParcelada.Carne
                    ? request.DataPrimeiroVencimento ?? dataOcorrencia
                    : null;
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            return Mapear(compraOriginal, divisaoComoCriador.Id);
        }

        await GarantirSemDivisaoVinculadaAsync(compraOriginal.Id, usuarioId, cancellationToken);

        ValidarNumeroParcela(compraOriginal, numeroParcela);
        ValidarDivisao(request);
        await ValidarRelacionamentosAsync(request, usuarioId, cancellationToken);
        if (request.DivisaoVinculada is not null && !request.IsDividida)
        {
            throw new InvalidOperationException("A divisão vinculada exige uma compra marcada como dividida.");
        }

        await using var dbTransaction = request.DivisaoVinculada is not null
            ? await _dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var parcelasRestantes = compraOriginal.QuantidadeParcelas - numeroParcela + 1;
        CompraParcelada novaCompra;
        if (numeroParcela == 1)
        {
            novaCompra = compraOriginal;
            AplicarRequestNaCompra(
                novaCompra,
                request,
                usuarioId,
                dataOcorrencia,
                parcelasRestantes);
        }
        else
        {
            novaCompra = new CompraParcelada();
            AplicarRequestNaCompra(
                novaCompra,
                request,
                usuarioId,
                dataOcorrencia,
                parcelasRestantes);

            if (compraOriginal.IsDividida && compraOriginal.ValorTotalOriginal.HasValue)
            {
                compraOriginal.ValorTotalOriginal = SomarParcelas(
                    compraOriginal.ValorTotalOriginal.Value,
                    compraOriginal.QuantidadeParcelas,
                    numeroParcela - 1);
            }

            compraOriginal.ValorTotal = SomarParcelas(compraOriginal, numeroParcela - 1);
            compraOriginal.QuantidadeParcelas = numeroParcela - 1;
            _dbContext.ComprasParceladas.Add(novaCompra);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        Guid? divisaoTransacaoId = null;
        if (request.DivisaoVinculada is not null)
        {
            if (_divisaoTransacaoService is null)
            {
                throw new InvalidOperationException("Serviço de divisão vinculada não configurado.");
            }

            var divisao = await _divisaoTransacaoService.CriarConviteAsync(
                usuarioId,
                new CriarConviteDivisaoRequest
                {
                    CompraParceladaId = novaCompra.Id,
                    ParticipantesUsuarios = request.DivisaoVinculada.ParticipantesUsuarios,
                    ParticipantesExternos = request.DivisaoVinculada.ParticipantesExternos
                },
                cancellationToken);
            divisaoTransacaoId = divisao.Id;
            await dbTransaction!.CommitAsync(cancellationToken);
        }

        return Mapear(novaCompra, divisaoTransacaoId);
    }

    public async Task<bool> ExcluirProjecaoAsync(
        Guid id,
        int numeroParcela,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var compra = await _dbContext.ComprasParceladas
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(compra => compra.Id == id && compra.UsuarioId == usuarioId, cancellationToken);

        if (compra is null)
        {
            return false;
        }

        var participacaoCompartilhada = await _dbContext.DivisoesTransacoesParticipantes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(item =>
                item.CompraParceladaGeradaId == compra.Id &&
                item.ParticipanteUsuarioId == usuarioId &&
                item.Ativo,
                cancellationToken);
        if (participacaoCompartilhada is not null)
        {
            if (_divisaoTransacaoService is null)
            {
                throw new InvalidOperationException(
                    "Use o fluxo de cancelamento da participação para excluir uma compra compartilhada.");
            }

            return await _divisaoTransacaoService.CancelarParticipacaoAsync(
                usuarioId,
                participacaoCompartilhada.Id,
                cancellationToken);
        }

        await GarantirSemDivisaoVinculadaAsync(compra.Id, usuarioId, cancellationToken);

        ValidarNumeroParcela(compra, numeroParcela);

        if (numeroParcela == 1)
        {
            await DesvincularDivisoesEncerradasAsync(compra.Id, cancellationToken);
            _dbContext.ComprasParceladas.Remove(compra);
        }
        else
        {
            if (compra.IsDividida && compra.ValorTotalOriginal.HasValue)
            {
                compra.ValorTotalOriginal = SomarParcelas(
                    compra.ValorTotalOriginal.Value,
                    compra.QuantidadeParcelas,
                    numeroParcela - 1);
            }

            compra.ValorTotal = SomarParcelas(compra, numeroParcela - 1);
            compra.QuantidadeParcelas = numeroParcela - 1;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static void AplicarRequestNaCompra(
        CompraParcelada compra,
        CriarCompraParceladaRequest request,
        Guid usuarioId,
        DateOnly dataOcorrencia,
        int quantidadeParcelas)
    {
        compra.UsuarioId = usuarioId;
        compra.CartaoCreditoId = request.CartaoCreditoId;
        compra.CategoriaId = request.CategoriaId;
        compra.Descricao = request.Descricao.Trim();
        compra.QuantidadeParcelas = quantidadeParcelas;
        compra.ValorTotal = request.ValorTotal;
        compra.DataCompra = request.FormaPagamento == FormaPagamentoCompraParcelada.Carne
            ? request.DataCompra
            : dataOcorrencia;
        compra.DataPrimeiroVencimento = request.FormaPagamento == FormaPagamentoCompraParcelada.Carne
            ? request.DataPrimeiroVencimento ?? dataOcorrencia
            : null;
        compra.FormaPagamento = request.FormaPagamento;
        compra.IsDividida = request.IsDividida;
        compra.ValorTotalOriginal = request.IsDividida ? request.ValorTotalOriginal : null;
        compra.PercentualDivisao = request.IsDividida ? request.PercentualDivisao : null;
    }

    private async Task DesvincularDivisoesEncerradasAsync(
        Guid compraParceladaId,
        CancellationToken cancellationToken)
    {
        var divisoesEncerradas = await _dbContext.DivisoesTransacoes
            .IgnoreQueryFilters()
            .Where(divisao =>
                divisao.CompraParceladaId == compraParceladaId &&
                divisao.EncerradoEm != null)
            .ToListAsync(cancellationToken);
        foreach (var divisao in divisoesEncerradas)
        {
            divisao.CompraParceladaId = null;
            divisao.CompraParcelada = null;
        }
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

    private static void ValidarDivisao(CriarCompraParceladaRequest request)
    {
        if (!request.IsDividida)
        {
            return;
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

        if (request.ValorTotal <= 0 || request.ValorTotal > request.ValorTotalOriginal.Value)
        {
            throw new InvalidOperationException(
                "O valor da sua parte deve ser maior que zero e não pode superar o valor total da compra.");
        }

        var valorCalculado = Math.Round(
            request.ValorTotalOriginal.Value * (request.PercentualDivisao.Value / 100m),
            2,
            MidpointRounding.AwayFromZero);

        if (request.ValorTotal != valorCalculado)
        {
            throw new InvalidOperationException(
                $"O valor da sua parte deve ser {valorCalculado:C2} para o percentual informado.");
        }
    }

    private static decimal SomarParcelas(CompraParcelada compra, int ateParcela)
    {
        return SomarParcelas(compra.ValorTotal, compra.QuantidadeParcelas, ateParcela);
    }

    private static decimal SomarParcelas(decimal valorTotal, int quantidadeParcelas, int ateParcela)
    {
        return Enumerable.Range(1, ateParcela)
            .Sum(numero => CalcularValorParcela(valorTotal, quantidadeParcelas, numero));
    }

    private static decimal CalcularValorParcela(decimal valorTotal, int quantidadeParcelas, int numeroParcela)
    {
        var valorBase = Math.Round(valorTotal / quantidadeParcelas, 2, MidpointRounding.AwayFromZero);
        return numeroParcela == quantidadeParcelas
            ? valorTotal - (valorBase * (quantidadeParcelas - 1))
            : valorBase;
    }

    private async Task GarantirSemDivisaoVinculadaAsync(
        Guid compraParceladaId,
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var possuiDivisao = await _dbContext.DivisoesTransacoes
            .AsNoTracking()
            .AnyAsync(
                divisao => divisao.UsuarioCriadorId == usuarioId &&
                    divisao.CompraParceladaId == compraParceladaId &&
                    divisao.EncerradoEm == null,
                cancellationToken);
        if (possuiDivisao)
        {
            throw new InvalidOperationException(
                "Esta compra possui divisão vinculada. Use o fluxo de alteração da divisão.");
        }
    }

    private static CompraParceladaResponse Mapear(CompraParcelada compra, Guid? divisaoTransacaoId = null)
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
            IsDividida = compra.IsDividida,
            ValorTotalOriginal = compra.ValorTotalOriginal,
            PercentualDivisao = compra.PercentualDivisao,
            DataCompra = compra.DataCompra,
            DataPrimeiroVencimento = compra.DataPrimeiroVencimento,
            FormaPagamento = compra.FormaPagamento,
            DivisaoTransacaoId = divisaoTransacaoId
        };
    }
}
