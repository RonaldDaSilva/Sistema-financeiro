using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.Dashboard;

public sealed class DashboardInicioDto
{
    /// <summary>Saldo real das contas no dia atual, ou saldo de fechamento quando o período consultado já terminou.</summary>
    public decimal SaldoAtual { get; set; }
    public decimal ReceitasRealizadasNoPeriodo { get; set; }
    public decimal DespesasRealizadasNoPeriodo { get; set; }
    public decimal InvestimentosRealizadosNoPeriodo { get; set; }
    public decimal BalancoRealizadoNoPeriodo { get; set; }
    public decimal ReceitasPendentesNoPeriodo { get; set; }
    public decimal DespesasPendentesNoPeriodo { get; set; }
    public decimal InvestimentosPendentesNoPeriodo { get; set; }
    /// <summary>Saldo atual menos despesas e investimentos pendentes aplicáveis. Receitas futuras não são somadas.</summary>
    public decimal SaldoPrevistoFimDoPeriodo { get; set; }
    public decimal DespesasEmAberto { get; set; }
    public bool TemFiltroAnalitico { get; set; }
    public string ContextoPeriodo { get; set; } = "Atual";
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
