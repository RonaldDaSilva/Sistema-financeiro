using System.ComponentModel.DataAnnotations;

namespace SistemaFinanceiro.Api.Dtos.Categorias;

public sealed class CategoriaRequest
{
    [Required]
    [MaxLength(120)]
    public string Nome { get; set; } = string.Empty;

    [RegularExpression("^#[0-9A-Fa-f]{6}$")]
    public string? CorHexa { get; set; }
}
