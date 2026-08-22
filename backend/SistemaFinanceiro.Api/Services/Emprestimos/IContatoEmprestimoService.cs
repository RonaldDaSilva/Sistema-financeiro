using SistemaFinanceiro.Api.Dtos.Emprestimos;

namespace SistemaFinanceiro.Api.Services.Emprestimos;

public interface IContatoEmprestimoService
{
    Task<IReadOnlyList<ContatoEmprestimoResponse>> ListarAsync(Guid usuarioId, CancellationToken cancellationToken = default);
    Task<ContatoEmprestimoResponse> CriarAsync(Guid usuarioId, CriarContatoEmprestimoRequest request, CancellationToken cancellationToken = default);
    Task<ContatoEmprestimoResponse?> AtualizarAsync(Guid usuarioId, Guid id, AtualizarContatoEmprestimoRequest request, CancellationToken cancellationToken = default);
    Task<bool> RemoverAsync(Guid usuarioId, Guid id, CancellationToken cancellationToken = default);
}
