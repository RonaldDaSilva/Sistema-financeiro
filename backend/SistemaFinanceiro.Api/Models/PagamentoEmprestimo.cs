using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class PagamentoEmprestimo : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid EmprestimoId { get; set; }
    public DateOnly Data { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public decimal ValorTotal { get; set; }
    public string? Observacao { get; set; }
    public DateTimeOffset CriadoEm { get; set; } = DateTimeOffset.UtcNow;

    public Usuario Usuario { get; set; } = null!;
    public Emprestimo Emprestimo { get; set; } = null!;
    public ContaBancaria? ContaBancaria { get; set; }
    public ICollection<ParcelaEmprestimo> Parcelas { get; set; } = new List<ParcelaEmprestimo>();
    public Transacao? LancamentoFinanceiro { get; set; }
}
