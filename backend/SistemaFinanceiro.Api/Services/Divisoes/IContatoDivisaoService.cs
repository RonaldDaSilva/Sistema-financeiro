using SistemaFinanceiro.Api.Dtos.Divisoes;

namespace SistemaFinanceiro.Api.Services.Divisoes;

public interface IContatoDivisaoService
{
    Task<IReadOnlyList<ContatoDivisaoResponse>> ListarAsync(Guid usuarioId, CancellationToken cancellationToken = default);
    Task<ContatoDivisaoResponse> CriarAsync(Guid usuarioId, CriarContatoDivisaoRequest request, CancellationToken cancellationToken = default);
    Task<ContatoDivisaoResponse?> AtualizarAsync(Guid usuarioId, Guid id, AtualizarContatoDivisaoRequest request, CancellationToken cancellationToken = default);
    Task<bool> RemoverAsync(Guid usuarioId, Guid id, CancellationToken cancellationToken = default);
}
