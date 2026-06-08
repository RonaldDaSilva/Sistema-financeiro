using SistemaFinanceiro.Api.Dtos.Auth;

namespace SistemaFinanceiro.Api.Services.Auth;

public interface IAuthService
{
    Task<AuthResponse> CadastrarAsync(CadastrarUsuarioRequest request, CancellationToken cancellationToken);
    Task<AuthResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken);
}
