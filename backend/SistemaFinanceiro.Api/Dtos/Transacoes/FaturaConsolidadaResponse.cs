namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class FaturaConsolidadaResponse
{
    public Guid CartaoCreditoId { get; set; }
    public string NomeCartao { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public DateOnly DataVencimento { get; set; }
    public DateOnly InicioCompetencia { get; set; }
    public DateOnly FimCompetencia { get; set; }
    public string Status { get; set; } = string.Empty;
    public IReadOnlyList<FaturaDetalheResponse> Detalhes { get; set; } = [];
}
