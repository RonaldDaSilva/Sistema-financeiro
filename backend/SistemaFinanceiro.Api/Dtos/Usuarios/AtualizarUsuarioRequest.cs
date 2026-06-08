namespace SistemaFinanceiro.Api.Dtos.Usuarios;

public sealed class AtualizarUsuarioRequest
{
    public string Nome { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public string? Cpf { get; set; }
    public bool ConfirmarAlteracao { get; set; }
}
