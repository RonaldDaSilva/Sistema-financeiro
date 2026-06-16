namespace SistemaFinanceiro.Api.Dtos.Auth;

public sealed class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}
