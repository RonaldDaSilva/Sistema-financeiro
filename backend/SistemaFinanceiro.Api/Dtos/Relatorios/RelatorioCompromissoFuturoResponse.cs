namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioCompromissoFuturoResponse
{
    public int Mes { get; set; }
    public int Ano { get; set; }
    public decimal Faturas { get; set; }
    public decimal Parcelas { get; set; }
    public decimal DespesasFixas { get; set; }
    public decimal ReceitasRecorrentes { get; set; }
    public decimal Total { get; set; }
}
