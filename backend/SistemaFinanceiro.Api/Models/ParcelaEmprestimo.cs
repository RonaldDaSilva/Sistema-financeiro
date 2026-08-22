using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class ParcelaEmprestimo : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid EmprestimoId { get; set; }
    public Guid? PagamentoEmprestimoId { get; set; }
    public int NumeroParcela { get; set; }
    public DateOnly DataVencimento { get; set; }
    public decimal Valor { get; set; }
    public StatusParcelaEmprestimo Status { get; set; } = StatusParcelaEmprestimo.Pendente;
    public DateOnly? DataPagamento { get; set; }

    public Usuario Usuario { get; set; } = null!;
    public Emprestimo Emprestimo { get; set; } = null!;
    public PagamentoEmprestimo? PagamentoEmprestimo { get; set; }
    public Transacao? LancamentoFinanceiro { get; set; }
}
