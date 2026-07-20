namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioResumoAuditavelResponse
{
    public decimal ReceitasRealizadas { get; set; }
    public decimal ReceitasPrevistas { get; set; }
    public decimal ReceitasVencidas { get; set; }
    public decimal DespesasDoPeriodo { get; set; }
    public decimal DespesasPagas { get; set; }
    public decimal DespesasEmAberto { get; set; }
    public decimal DespesasCartao { get; set; }
    public decimal DespesasRecorrentes { get; set; }
    public decimal DemaisDespesas { get; set; }
    public decimal InvestimentosRealizados { get; set; }
    public decimal InvestimentosPendentes { get; set; }
    public decimal ObrigacoesEmAberto { get; set; }
    public decimal ResultadoLiquido { get; set; }
    public decimal SaldoAtual { get; set; }
    public decimal SaldoPrevistoFimPeriodo { get; set; }
    public DateOnly DataLimite { get; set; }
}
