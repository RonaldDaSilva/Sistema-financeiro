namespace SistemaFinanceiro.Api.Dtos.Dashboard;

public sealed class DashboardRelatoriosDto
{
    public IReadOnlyList<DashboardCategoriaRankingDto> RankingCategorias { get; set; } = [];
    public IReadOnlyList<DashboardProjecaoDiariaDto> ProjecaoDiaria { get; set; } = [];
}

public sealed class DashboardCategoriaRankingDto
{
    public string NomeCategoria { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public decimal Percentual { get; set; }
}

public sealed class DashboardProjecaoDiariaDto
{
    public DateOnly Data { get; set; }
    public decimal Entradas { get; set; }
    public decimal Saidas { get; set; }
    public decimal SaldoAcumulado { get; set; }
}
