namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class ResumoFinanceiroMensalResponse
{
    public int Mes { get; set; }
    public int Ano { get; set; }
    public decimal ReceitasRealizadas { get; set; }
    public decimal ReceitasPrevistas { get; set; }
    public decimal DespesasRealizadas { get; set; }
    public decimal DespesasPrevistas { get; set; }
    public decimal DemaisSaidasPrevistas { get; set; }
    public decimal SobraPrevista { get; set; }
    public IReadOnlyList<RelatorioCategoriaResponse> DespesasPorCategoria { get; set; } = [];
    public IReadOnlyList<ResumoFinanceiroMesResponse> ProximosMeses { get; set; } = [];
}

public sealed class ResumoFinanceiroMesResponse
{
    public int Mes { get; set; }
    public int Ano { get; set; }
    public decimal ReceitasPrevistas { get; set; }
    public decimal DespesasPrevistas { get; set; }
    public decimal DemaisSaidasPrevistas { get; set; }
    public decimal SobraPrevista { get; set; }
}
