namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class DadosMensaisRelatorioResponse
{
    public ExtratoMensalResponse Extrato { get; set; } = new();
    public IReadOnlyList<FaturaConsolidadaResponse> Faturas { get; set; } = [];
}
