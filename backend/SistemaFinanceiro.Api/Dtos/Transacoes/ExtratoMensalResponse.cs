namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class ExtratoMensalResponse
{
    public int Mes { get; set; }
    public int Ano { get; set; }
    public decimal TotalReceitas { get; set; }
    public decimal TotalDespesas { get; set; }
    public decimal TotalInvestido { get; set; }
    public decimal Saldo { get; set; }
    public IReadOnlyList<ExtratoMensalItemResponse> Itens { get; set; } = [];
}
