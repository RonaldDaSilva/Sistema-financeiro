namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioGraficosResponse
{
    public int Mes { get; set; }
    public int Ano { get; set; }
    public IReadOnlyList<RelatorioCategoriaResponse> DespesasPorCategoria { get; set; } = [];
    public IReadOnlyList<RelatorioMensalResponse> SaldoAnual { get; set; } = [];
    public IReadOnlyList<RelatorioMensalResponse> SerieFluxo { get; set; } = [];
}
