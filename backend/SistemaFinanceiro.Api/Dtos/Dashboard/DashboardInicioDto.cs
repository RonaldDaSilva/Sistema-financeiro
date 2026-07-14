using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.Dashboard;

public sealed class DashboardInicioDto
{
    public decimal SaldoAtual { get; set; }
    public decimal ReceitasRealizadasNoMes { get; set; }
    public decimal DespesasRealizadasNoMes { get; set; }
    public decimal InvestimentosRealizadosNoMes { get; set; }
    public decimal BalancoRealizadoNoMes { get; set; }
    public decimal ReceitasPendentesNoMes { get; set; }
    public decimal DespesasPendentesNoMes { get; set; }
    public decimal SaldoPrevistoFimDoMes { get; set; }
    public decimal LivreParaGastar { get; set; }
    public decimal DespesasAPagar { get; set; }
    public IReadOnlyList<DashboardLancamentoDto> ProximosLancamentos { get; set; } = [];
    public IReadOnlyList<string> Insights { get; set; } = [];
}

public sealed class DashboardLancamentoDto
{
    public Guid Id { get; set; }
    public TipoTransacao Tipo { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateOnly DataOcorrencia { get; set; }
    public string StatusVisual { get; set; } = string.Empty;
    public string CategoriaNome { get; set; } = string.Empty;
    public string FormaPagamento { get; set; } = string.Empty;
    public string Grupo { get; set; } = string.Empty;
}
