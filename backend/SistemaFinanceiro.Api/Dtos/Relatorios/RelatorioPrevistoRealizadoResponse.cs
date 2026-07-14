namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioPrevistoRealizadoResponse
{
    public string Nome { get; set; } = string.Empty;
    public decimal Previsto { get; set; }
    public decimal Realizado { get; set; }
}
