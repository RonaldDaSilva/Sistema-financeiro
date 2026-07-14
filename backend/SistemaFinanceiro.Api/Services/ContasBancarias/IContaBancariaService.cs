using SistemaFinanceiro.Api.Dtos.ContasBancarias;

namespace SistemaFinanceiro.Api.Services.ContasBancarias;

public interface IContaBancariaService
{
    Task<IReadOnlyList<ContaBancariaResponse>> ListarAsync(Guid usuarioId, CancellationToken cancellationToken = default);
    Task<ContaBancariaResponse?> ObterPorIdAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<ContaBancariaResponse> CriarAsync(ContaBancariaRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<ContaBancariaResponse?> AtualizarAsync(Guid id, ContaBancariaRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<ContaBancariaResponse?> FavoritarAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<ContaBancariaResponse?> ArquivarAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<ContaBancariaResponse?> AjustarSaldoAsync(Guid id, AjustarSaldoContaRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<Guid> TransferirAsync(TransferenciaContaRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<bool> ExcluirAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ContaDistribuicaoResponse>> ObterDistribuicaoAsync(Guid usuarioId, CancellationToken cancellationToken = default);
}
