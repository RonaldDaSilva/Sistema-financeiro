using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class DivisaoTransacao : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid UsuarioCriadorId { get; set; }
    public Guid? TransacaoOrigemId { get; set; }
    public Guid? CompraParceladaId { get; set; }
    public Guid? SerieId { get; set; }
    public decimal ValorTotal { get; set; }
    public DivisaoTransacaoStatus Status { get; set; } = DivisaoTransacaoStatus.Pendente;
    public int VersaoAtual { get; set; } = 1;
    public int QuantidadeReenvios { get; set; }
    public DateTimeOffset CriadoEm { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset AtualizadoEm { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EncerradoEm { get; set; }

    public Usuario UsuarioCriador { get; set; } = null!;
    public Transacao? TransacaoOrigem { get; set; }
    public CompraParcelada? CompraParcelada { get; set; }
    public ICollection<DivisaoTransacaoParticipante> Participantes { get; set; } = new List<DivisaoTransacaoParticipante>();
}
