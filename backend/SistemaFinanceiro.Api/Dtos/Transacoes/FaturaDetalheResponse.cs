namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class FaturaDetalheResponse
{
    public Guid? TransacaoId { get; set; }
    public Guid? CompraParceladaId { get; set; }
    public int? NumeroParcela { get; set; }
    public int? QuantidadeParcelas { get; set; }
    public DateOnly DataOcorrencia { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public bool IsDividida { get; set; }
    public decimal? ValorTotalOriginal { get; set; }
    public decimal? PercentualDivisao { get; set; }
    public Guid? CategoriaId { get; set; }
    public string CategoriaNome { get; set; } = string.Empty;
    public string CategoriaCorHexa { get; set; } = string.Empty;
    public string Origem { get; set; } = string.Empty;
}
