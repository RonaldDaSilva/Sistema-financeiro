namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioProjecaoDiariaResponse
{
    public DateOnly Data { get; set; }
    public decimal Entradas { get; set; }
    public decimal Saidas { get; set; }
    public decimal SaldoAcumulado { get; set; }
}
