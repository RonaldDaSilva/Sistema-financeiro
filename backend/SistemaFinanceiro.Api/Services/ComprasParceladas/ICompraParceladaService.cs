using SistemaFinanceiro.Api.Dtos.ComprasParceladas;

namespace SistemaFinanceiro.Api.Services.ComprasParceladas;

public interface ICompraParceladaService
{
    Task<CompraParceladaResponse> CriarAsync(
        CriarCompraParceladaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default);

    Task<CompraParceladaResponse?> AtualizarProjecaoAsync(
        Guid id,
        int numeroParcela,
        DateOnly dataOcorrencia,
        CriarCompraParceladaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default);

    Task<bool> ExcluirProjecaoAsync(
        Guid id,
        int numeroParcela,
        Guid usuarioId,
        CancellationToken cancellationToken = default);
}
