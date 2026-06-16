using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class Transacao : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int CodigoExibicao { get; set; }
    public Guid UsuarioId { get; set; }
    public TipoTransacao Tipo { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateOnly DataOcorrencia { get; set; }
    public Guid? CategoriaId { get; set; }
    public string FormaPagamento { get; set; } = string.Empty;
    public Guid? CartaoCreditoId { get; set; }
    public bool IsFixa { get; set; }
    public bool IsPaga { get; set; }
    public bool IsDividida { get; set; }
    public decimal? ValorTotalOriginal { get; set; }
    public decimal? PercentualDivisao { get; set; }
    public Guid? CompraParceladaId { get; set; }
    public int? NumeroParcelaQuitada { get; set; }

    public Usuario Usuario { get; set; } = null!;
    public Categoria? Categoria { get; set; }
    public CartaoCredito? CartaoCredito { get; set; }
    public CompraParcelada? CompraParcelada { get; set; }
}
