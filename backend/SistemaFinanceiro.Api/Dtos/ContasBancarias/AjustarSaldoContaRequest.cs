using System.ComponentModel.DataAnnotations;

namespace SistemaFinanceiro.Api.Dtos.ContasBancarias;

public sealed class AjustarSaldoContaRequest
{
    [Range(-999999999999.99, 999999999999.99)]
    public decimal SaldoInformado { get; set; }

    public DateOnly? Data { get; set; }

    [MaxLength(500)]
    public string? Observacao { get; set; }
}
