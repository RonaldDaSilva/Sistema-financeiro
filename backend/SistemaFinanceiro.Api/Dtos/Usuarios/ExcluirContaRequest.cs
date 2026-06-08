namespace SistemaFinanceiro.Api.Dtos.Usuarios;

public sealed class ExcluirContaRequest
{
    public string Senha { get; set; } = string.Empty;
    public string Confirmacao { get; set; } = string.Empty;
}
