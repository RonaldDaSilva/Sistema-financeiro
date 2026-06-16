namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class AnteciparParcelaRequest
{
    public Guid IdCompraParcelada { get; set; }
    public int NumeroParcela { get; set; }
    public DateTime DataAntecipacao { get; set; }
    public decimal ValorPago { get; set; }
}
