using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class DivisaoTransacaoVersao : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid DivisaoTransacaoId { get; set; }
    public int Versao { get; set; }
    public DivisaoTransacaoVersaoStatus Status { get; set; } = DivisaoTransacaoVersaoStatus.PropostaPendente;
    public string Escopo { get; set; } = "EstaOcorrencia";
    public Guid UsuarioSolicitanteId { get; set; }
    public Guid? UsuarioRespondenteId { get; set; }
    public decimal ValorTotalAnterior { get; set; }
    public decimal ValorTotalProposto { get; set; }
    public decimal PercentualCriadorAnterior { get; set; }
    public decimal PercentualCriadorProposto { get; set; }
    public decimal ValorCriadorAnterior { get; set; }
    public decimal ValorCriadorProposto { get; set; }
    public decimal PercentualParticipanteAnterior { get; set; }
    public decimal PercentualParticipanteProposto { get; set; }
    public decimal ValorParticipanteAnterior { get; set; }
    public decimal ValorParticipanteProposto { get; set; }
    public DateOnly? VencimentoAnterior { get; set; }
    public DateOnly? VencimentoProposto { get; set; }
    public int? QuantidadeParcelasAnterior { get; set; }
    public int? QuantidadeParcelasProposta { get; set; }
    public string? RecorrenciaAnterior { get; set; }
    public string? RecorrenciaProposta { get; set; }
    public string? FrequenciaAnterior { get; set; }
    public string? FrequenciaProposta { get; set; }
    public string? ResponsabilidadeAnterior { get; set; }
    public string? ResponsabilidadeProposta { get; set; }
    public DateTimeOffset CriadoEm { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? RespondidoEm { get; set; }
    public string? MotivoResposta { get; set; }

    public DivisaoTransacao DivisaoTransacao { get; set; } = null!;
}
