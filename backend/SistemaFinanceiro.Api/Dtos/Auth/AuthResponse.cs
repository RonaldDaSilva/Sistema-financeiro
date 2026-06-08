namespace SistemaFinanceiro.Api.Dtos.Auth;

public sealed class AuthResponse
{
    public Guid UsuarioId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Telefone { get; set; }
    public string? Cpf { get; set; }
    public string AccessToken { get; set; } = string.Empty;
    public DateTimeOffset AccessTokenExpiraEm { get; set; }
    public string RefreshToken { get; set; } = string.Empty;
    public DateTimeOffset RefreshTokenExpiraEm { get; set; }
}
