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
    public Guid? Id { get; set; }
    public TipoTransacao Tipo { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateOnly DataOcorrencia { get; set; }
    public string Competencia { get; set; } = string.Empty;
    public string StatusVisual { get; set; } = string.Empty;
    public string CategoriaNome { get; set; } = string.Empty;
    public string FormaPagamento { get; set; } = string.Empty;
    public string Grupo { get; set; } = string.Empty;
    public string TipoOrigem { get; set; } = string.Empty;
    public Guid? OrigemId { get; set; }
    public Guid? CartaoCreditoId { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public Guid? CompraParceladaId { get; set; }
    public int? NumeroParcela { get; set; }
    public bool IsProjetada { get; set; }
    public bool PodeLiquidar { get; set; }
    public string RotaDestino { get; set; } = "/";
    public IReadOnlyDictionary<string, string> FiltrosDestino { get; set; } =
        new Dictionary<string, string>();
}
