namespace SistemaFinanceiro.Api.Dtos.CartoesCredito;

public sealed class CartaoCreditoResponse
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public string ApelidoCartao { get; set; } = string.Empty;
    public string Banco { get; set; } = string.Empty;
    public int DiaVencimento { get; set; }
    public int MelhorDiaCompra { get; set; }
    public decimal LimiteTotal { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public string? ContaBancariaNome { get; set; }
    public bool IsArquivado { get; set; }
    public decimal ValorFaturaAtual { get; set; }
    public decimal ValorFaturasFechadasNaoPagas { get; set; }
    public decimal ValorProximasFaturas { get; set; }
    public int QuantidadeParcelasFuturas { get; set; }
    public decimal ValorParcelasFuturas { get; set; }
    public decimal ValorOutrosCompromissos { get; set; }
    public decimal ValorUtilizado { get; set; }
    public decimal LimiteDisponivel { get; set; }
    public decimal PercentualUtilizado { get; set; }
    public decimal FaturaAtual { get; set; }
    public string StatusFaturaAtual { get; set; } = string.Empty;
    public DateOnly? DataFechamentoAtual { get; set; }
    public DateOnly? DataVencimentoAtual { get; set; }
    public int? DiasParaFechamento { get; set; }
    public int? DiasParaVencimento { get; set; }
    public int ComprasParceladasFuturas { get; set; }
    public decimal LimiteComprometidoFuturo { get; set; }
    public decimal ProximaFaturaValor { get; set; }
    public DateOnly? ProximaFaturaVencimento { get; set; }
}
