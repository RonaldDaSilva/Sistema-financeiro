using System.ComponentModel.DataAnnotations;

namespace SistemaFinanceiro.Api.Dtos.ContasBancarias;

public sealed class ContaBancariaRequest
{
    [Required]
    [MaxLength(100)]
    public string NomeCustomizado { get; set; } = string.Empty;

    [Required]
    [RegularExpression(@"^\d{3}$", ErrorMessage = "O código COMPE deve conter exatamente 3 dígitos.")]
    public string CodigoBanco { get; set; } = string.Empty;

    [Range(-999999999999.99, 999999999999.99)]
    public decimal SaldoInicial { get; set; }
}
