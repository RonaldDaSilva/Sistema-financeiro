using SistemaFinanceiro.Api.Dtos.CartoesCredito;

namespace SistemaFinanceiro.Api.Services.CartoesCredito;

public interface ICartaoCreditoService
{
    Task<IReadOnlyList<CartaoCreditoResponse>> ListarAsync(Guid usuarioId, CancellationToken cancellationToken = default);
    Task<CartaoCreditoResponse?> ObterPorIdAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<CartaoCreditoResponse> CriarAsync(CartaoCreditoRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<CartaoCreditoResponse?> AtualizarAsync(Guid id, CartaoCreditoRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<bool> ExcluirAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default);
}
