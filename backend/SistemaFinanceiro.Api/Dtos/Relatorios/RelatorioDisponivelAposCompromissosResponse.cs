namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioDisponivelAposCompromissosResponse
{
    public decimal SaldoAtual { get; set; }
    public decimal ObrigacoesPendentesAteDataLimite { get; set; }
    public decimal InvestimentosPendentesAteDataLimite { get; set; }
    public decimal ReservaMinimaConfigurada { get; set; }
    public decimal DisponivelAposCompromissos { get; set; }
    public decimal ReceitasPrevistas { get; set; }
    public decimal DisponivelConsiderandoReceitasPrevistas { get; set; }
    public DateOnly DataLimite { get; set; }
    public string? Observacao { get; set; }
}
