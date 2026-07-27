using System.ComponentModel.DataAnnotations;

namespace SistemaFinanceiro.Api.Dtos.Divisoes;

public sealed class ContatoDivisaoResponse
{
    public Guid Id { get; set; }
    public Guid UsuarioContatoId { get; set; }
    public string NomeExibicao { get; set; } = string.Empty;
    public string EmailMascarado { get; set; } = string.Empty;
    public string? Apelido { get; set; }
    public DateTimeOffset? UltimoUsoEm { get; set; }
    public DateTimeOffset CriadoEm { get; set; }
    public bool Ativo { get; set; }
}

public sealed class CriarContatoDivisaoRequest
{
    [Required]
    public Guid UsuarioContatoId { get; set; }

    [MaxLength(120)]
    public string? Apelido { get; set; }
}

public sealed class AtualizarContatoDivisaoRequest
{
    [MaxLength(120)]
    public string? Apelido { get; set; }

    public bool? Ativo { get; set; }
}
