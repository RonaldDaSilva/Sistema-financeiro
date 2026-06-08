using System.ComponentModel.DataAnnotations;

namespace SistemaFinanceiro.Api.Dtos.CartoesCredito;

public sealed class CartaoCreditoRequest
{
    [Required]
    [MaxLength(80)]
    public string ApelidoCartao { get; set; } = string.Empty;

    [Required]
    [MaxLength(120)]
    public string Banco { get; set; } = string.Empty;

    [Range(1, 31)]
    public int DiaVencimento { get; set; }

    [Range(1, 31)]
    public int MelhorDiaCompra { get; set; }

    [Range(0, 999999999999.99)]
    public decimal LimiteTotal { get; set; }
}
