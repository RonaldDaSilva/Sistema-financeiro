using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class ExtratoMensalItemResponse
{
    public Guid? Id { get; set; }
    public int? CodigoExibicao { get; set; }
    public TipoTransacao Tipo { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateOnly DataOcorrencia { get; set; }
    public Guid? CategoriaId { get; set; }
    public string CategoriaNome { get; set; } = string.Empty;
    public string CategoriaCorHexa { get; set; } = string.Empty;
    public string FormaPagamento { get; set; } = string.Empty;
    public Guid? CartaoCreditoId { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public string? CartaoCreditoApelido { get; set; }
    public bool IsFixa { get; set; }
    public bool IsPaga { get; set; }
    public bool IsDividida { get; set; }
    public decimal? ValorTotalOriginal { get; set; }
    public decimal? PercentualDivisao { get; set; }
    public bool IsProjetada { get; set; }
    public string Origem { get; set; } = string.Empty;
    public Guid? CompraParceladaId { get; set; }
    public int? NumeroParcela { get; set; }
    public int? QuantidadeParcelas { get; set; }
}
