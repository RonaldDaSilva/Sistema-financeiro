using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class ReembolsoDivisao : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid DivisaoTransacaoId { get; set; }
    public Guid? ParticipanteId { get; set; }
    public Guid? ParticipanteUsuarioId { get; set; }
    public string? ParticipanteExternoNome { get; set; }
    public decimal ValorDevido { get; set; }
    public decimal ValorRecebido { get; set; }
    public ReembolsoDivisaoStatus Status { get; set; } = ReembolsoDivisaoStatus.Pendente;
    public DateTimeOffset CriadoEm { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset AtualizadoEm { get; set; } = DateTimeOffset.UtcNow;

    public decimal SaldoPendente => ValorDevido - ValorRecebido;

    public DivisaoTransacao DivisaoTransacao { get; set; } = null!;
    public DivisaoTransacaoParticipante? Participante { get; set; }
    public Usuario? ParticipanteUsuario { get; set; }
    public ICollection<Transacao> TransacoesReembolso { get; set; } = new List<Transacao>();
}
