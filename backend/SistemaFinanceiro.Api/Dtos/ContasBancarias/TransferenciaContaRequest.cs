using System.ComponentModel.DataAnnotations;

namespace SistemaFinanceiro.Api.Dtos.ContasBancarias;

public sealed class TransferenciaContaRequest
{
    [Required]
    public Guid ContaOrigemId { get; set; }

    [Required]
    public Guid ContaDestinoId { get; set; }

    [Range(0.01, 999999999999.99)]
    public decimal Valor { get; set; }

    public DateOnly? Data { get; set; }

    [MaxLength(180)]
    public string? Descricao { get; set; }

    public bool ConfirmarSemSaldo { get; set; }
}
