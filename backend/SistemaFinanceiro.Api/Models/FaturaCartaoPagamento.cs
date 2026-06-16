using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class FaturaCartaoPagamento : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid CartaoCreditoId { get; set; }
    public DateOnly DataVencimento { get; set; }
    public bool IsPaga { get; set; }

    public Usuario Usuario { get; set; } = null!;
    public CartaoCredito CartaoCredito { get; set; } = null!;
}
