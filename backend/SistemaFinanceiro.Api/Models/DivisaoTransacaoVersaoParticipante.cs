using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class DivisaoTransacaoVersaoParticipante : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid DivisaoTransacaoVersaoId { get; set; }
    public Guid DivisaoTransacaoParticipanteId { get; set; }
    public decimal PercentualAnterior { get; set; }
    public decimal PercentualProposto { get; set; }
    public decimal ValorAnterior { get; set; }
    public decimal ValorProposto { get; set; }
    public DivisaoTransacaoVersaoParticipanteStatus Status { get; set; } =
        DivisaoTransacaoVersaoParticipanteStatus.Pendente;
    public DateTimeOffset? RespondidoEm { get; set; }
    public string? MotivoResposta { get; set; }

    public DivisaoTransacaoVersao DivisaoTransacaoVersao { get; set; } = null!;
    public DivisaoTransacaoParticipante DivisaoTransacaoParticipante { get; set; } = null!;
}
