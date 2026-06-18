using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class TransacaoFixaExcecao : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid TransacaoFixaId { get; set; }
    public DateOnly DataOcorrencia { get; set; }

    public Usuario Usuario { get; set; } = null!;
    public Transacao TransacaoFixa { get; set; } = null!;
}
