using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class FechamentoMensalSaldo : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public int Ano { get; set; }
    public int Mes { get; set; }
    public DateOnly DataFechamento { get; set; }
    public decimal SaldoGlobal { get; set; }
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    public DateTime DataAtualizacao { get; set; } = DateTime.UtcNow;
    public string VersaoRegra { get; set; } = "dashboard-v1";
    public string Status { get; set; } = "Fechado";
    public string? Observacao { get; set; }

    public Usuario Usuario { get; set; } = null!;
    public ICollection<FechamentoMensalConta> Contas { get; set; } = [];
}
