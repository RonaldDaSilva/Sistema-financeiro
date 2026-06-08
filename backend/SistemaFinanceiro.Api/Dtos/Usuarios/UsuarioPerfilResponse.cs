namespace SistemaFinanceiro.Api.Dtos.Usuarios;

public sealed class UsuarioPerfilResponse
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Telefone { get; set; }
    public string? Cpf { get; set; }
}
