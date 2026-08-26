using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class AlteracaoRecorrenciaEmprestimo : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid EmprestimoId { get; set; }
    public DateOnly Competencia { get; set; }
    public decimal Valor { get; set; }
    public EscopoAlteracaoRecorrenciaEmprestimo Escopo { get; set; }
    public DateTimeOffset CriadoEm { get; set; } = DateTimeOffset.UtcNow;

    public Usuario Usuario { get; set; } = null!;
    public Emprestimo Emprestimo { get; set; } = null!;
}
