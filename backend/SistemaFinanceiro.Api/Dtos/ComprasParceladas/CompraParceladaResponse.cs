using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.ComprasParceladas;

public sealed class CompraParceladaResponse
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public Guid? CartaoCreditoId { get; set; }
    public Guid CategoriaId { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public int QuantidadeParcelas { get; set; }
    public decimal ValorTotal { get; set; }
    public DateOnly DataCompra { get; set; }
    public DateOnly? DataPrimeiroVencimento { get; set; }
    public FormaPagamentoCompraParcelada FormaPagamento { get; set; }
}
