using System.ComponentModel.DataAnnotations;

namespace SistemaFinanceiro.Api.Dtos.Auth;

public sealed class CadastrarUsuarioRequest
{
    [Required]
    [MaxLength(160)]
    public string Nome { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    [MaxLength(100)]
    public string Senha { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? Telefone { get; set; }

    [MaxLength(14)]
    public string? Cpf { get; set; }
}
