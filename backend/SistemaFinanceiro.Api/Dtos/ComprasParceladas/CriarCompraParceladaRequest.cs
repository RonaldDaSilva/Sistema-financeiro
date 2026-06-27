using System.ComponentModel.DataAnnotations;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.ComprasParceladas;

public sealed class CriarCompraParceladaRequest
{
    public Guid? CartaoCreditoId { get; set; }

    [Required]
    public Guid CategoriaId { get; set; }

    [Required]
    [MaxLength(180)]
    public string Descricao { get; set; } = string.Empty;

    [Range(1, 120)]
    public int QuantidadeParcelas { get; set; }

    [Range(0.01, 999999999999.99)]
    public decimal ValorTotal { get; set; }

    public bool IsDividida { get; set; }

    [Range(0.01, 999999999999.99)]
    public decimal? ValorTotalOriginal { get; set; }

    [Range(0.01, 100)]
    public decimal? PercentualDivisao { get; set; }

    [Required]
    public DateOnly DataCompra { get; set; }

    public DateOnly? DataPrimeiroVencimento { get; set; }

    public FormaPagamentoCompraParcelada FormaPagamento { get; set; } = FormaPagamentoCompraParcelada.CartaoCredito;
}
