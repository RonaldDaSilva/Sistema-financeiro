using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class CartaoCredito : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public string ApelidoCartao { get; set; } = string.Empty;
    public string Banco { get; set; } = string.Empty;
    public int DiaVencimento { get; set; }
    public int MelhorDiaCompra { get; set; }
    public decimal LimiteTotal { get; set; }

    public Usuario Usuario { get; set; } = null!;
    public ICollection<CompraParcelada> ComprasParceladas { get; set; } = new List<CompraParcelada>();
    public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();
}
