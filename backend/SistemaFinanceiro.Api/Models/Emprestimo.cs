using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class Emprestimo : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid ContatoId { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public DateOnly Data { get; set; }
    public OrigemFinanceiraEmprestimo OrigemFinanceira { get; set; }
    public Guid? CartaoCreditoId { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public int QuantidadeParcelas { get; set; } = 1;
    public string? Observacao { get; set; }
    public StatusEmprestimo Status { get; set; } = StatusEmprestimo.EmAberto;
    public bool IsArquivado { get; set; }
    public DateTimeOffset CriadoEm { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset AtualizadoEm { get; set; } = DateTimeOffset.UtcNow;

    public Usuario Usuario { get; set; } = null!;
    public ContatoEmprestimo Contato { get; set; } = null!;
    public CartaoCredito? CartaoCredito { get; set; }
    public ContaBancaria? ContaBancaria { get; set; }
    public ICollection<ParcelaEmprestimo> Parcelas { get; set; } = new List<ParcelaEmprestimo>();
    public ICollection<PagamentoEmprestimo> Pagamentos { get; set; } = new List<PagamentoEmprestimo>();
    public ICollection<Transacao> LancamentosFinanceiros { get; set; } = new List<Transacao>();
}
