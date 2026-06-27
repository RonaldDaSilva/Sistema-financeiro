using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class ContaBancaria : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public string NomeCustomizado { get; set; } = string.Empty;
    public string CodigoBanco { get; set; } = string.Empty;
    public decimal SaldoInicial { get; set; }
    public DateTimeOffset DataCriacao { get; set; } = DateTimeOffset.UtcNow;

    public Usuario Usuario { get; set; } = null!;
    public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();
}
