using SistemaFinanceiro.Api.Dtos.Categorias;

namespace SistemaFinanceiro.Api.Services.Categorias;

public interface ICategoriaService
{
    Task<IReadOnlyList<CategoriaResponse>> ListarAsync(Guid usuarioId, CancellationToken cancellationToken = default);
    Task<CategoriaResponse?> ObterPorIdAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<CategoriaResponse> CriarAsync(CategoriaRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<CategoriaResponse?> AtualizarAsync(Guid id, CategoriaRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<bool> ExcluirAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default);
}
