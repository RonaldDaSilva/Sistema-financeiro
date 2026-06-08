namespace SistemaFinanceiro.Api.Dtos.Usuarios;

public sealed class AlterarSenhaRequest
{
    public string SenhaAtual { get; set; } = string.Empty;
    public string NovaSenha { get; set; } = string.Empty;
    public bool ConfirmarAlteracao { get; set; }
}
