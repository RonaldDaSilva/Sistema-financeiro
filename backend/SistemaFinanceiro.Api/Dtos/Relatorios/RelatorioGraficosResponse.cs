namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioGraficosResponse
{
    public int Mes { get; set; }
    public int Ano { get; set; }
    public IReadOnlyList<RelatorioCategoriaResponse> DespesasPorCategoria { get; set; } = [];
    public IReadOnlyList<RelatorioMensalResponse> SaldoAnual { get; set; } = [];
    public IReadOnlyList<RelatorioMensalResponse> SerieFluxo { get; set; } = [];
    public RelatorioKpisResponse Kpis { get; set; } = new();
    public IReadOnlyList<RelatorioProjecaoDiariaResponse> ProjecaoDiaria { get; set; } = [];
    public IReadOnlyList<RelatorioPrevistoRealizadoResponse> PrevistoVersusRealizado { get; set; } = [];
    public IReadOnlyList<RelatorioMensalResponse> EvolucaoMensal { get; set; } = [];
    public RelatorioDisponivelAposCompromissosResponse DisponivelAposCompromissos { get; set; } = new();
    public IReadOnlyList<RelatorioCompromissoFuturoResponse> CompromissosFuturos { get; set; } = [];
}
