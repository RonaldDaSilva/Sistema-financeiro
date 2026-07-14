namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioComparativoValorResponse
{
    public decimal ValorAtual { get; set; }
    public decimal ValorAnterior { get; set; }
    public decimal DiferencaAbsoluta { get; set; }
    public decimal? VariacaoPercentual { get; set; }
    public string Tendencia { get; set; } = "Neutra";
    public string Mensagem { get; set; } = "Sem base para comparação";
}
