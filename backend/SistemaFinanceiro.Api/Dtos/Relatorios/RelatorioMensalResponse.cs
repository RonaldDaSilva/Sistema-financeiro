namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioMensalResponse
{
    public int Mes { get; set; }
    public int Ano { get; set; }
    public decimal Receitas { get; set; }
    public decimal Despesas { get; set; }
    public decimal Investimentos { get; set; }
    public decimal Saldo { get; set; }
}
