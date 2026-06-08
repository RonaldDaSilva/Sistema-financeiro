using SistemaFinanceiro.Api.Dtos.Usuarios;

namespace SistemaFinanceiro.Api.Services.Usuarios;

public interface IUsuarioService
{
    Task<UsuarioPerfilResponse?> ObterPerfilAsync(Guid usuarioId, CancellationToken cancellationToken = default);
    Task<UsuarioPerfilResponse?> AtualizarPerfilAsync(Guid usuarioId, AtualizarUsuarioRequest request, CancellationToken cancellationToken = default);
    Task<bool> AlterarSenhaAsync(Guid usuarioId, AlterarSenhaRequest request, CancellationToken cancellationToken = default);
    Task<bool> ExcluirContaAsync(Guid usuarioId, ExcluirContaRequest request, CancellationToken cancellationToken = default);
}
