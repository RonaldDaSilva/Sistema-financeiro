namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioKpisResponse
{
    public RelatorioComparativoValorResponse Receitas { get; set; } = new();
    public RelatorioComparativoValorResponse Despesas { get; set; } = new();
    public RelatorioComparativoValorResponse Investimentos { get; set; } = new();
    public RelatorioComparativoValorResponse ResultadoLiquido { get; set; } = new();
    public RelatorioComparativoValorResponse SaldoPrevistoFimPeriodo { get; set; } = new();
    public RelatorioComparativoValorResponse TaxaEconomia { get; set; } = new();
}
