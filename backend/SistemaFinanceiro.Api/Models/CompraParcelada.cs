using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class CompraParcelada : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid? CartaoCreditoId { get; set; }
    public Guid CategoriaId { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public int QuantidadeParcelas { get; set; }
    public decimal ValorTotal { get; set; }
    public DateOnly DataCompra { get; set; }
    public DateOnly? DataPrimeiroVencimento { get; set; }
    public FormaPagamentoCompraParcelada FormaPagamento { get; set; } = FormaPagamentoCompraParcelada.CartaoCredito;
    public bool IsDividida { get; set; }
    public decimal? ValorTotalOriginal { get; set; }
    public decimal? PercentualDivisao { get; set; }

    public Usuario Usuario { get; set; } = null!;
    public CartaoCredito? CartaoCredito { get; set; }
    public Categoria Categoria { get; set; } = null!;
    public ICollection<Transacao> TransacoesQuitacao { get; set; } = new List<Transacao>();
}
