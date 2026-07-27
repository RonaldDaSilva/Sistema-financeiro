using System.ComponentModel.DataAnnotations;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.Divisoes;

public sealed class ResolverConvidadoDivisaoRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string Email { get; set; } = string.Empty;
}

public sealed class ResolverConvidadoDivisaoResponse
{
    public bool Encontrado { get; set; }
    public string? NomeExibicao { get; set; }
    public string? EmailMascarado { get; set; }
    public Guid? Identificador { get; set; }
}

public sealed class CriarConviteDivisaoRequest
{
    [Required]
    public Guid TransacaoOrigemId { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string EmailConvidado { get; set; } = string.Empty;

    [Range(0.01, 99.99)]
    public decimal PercentualConvidado { get; set; }

    public bool SalvarContato { get; set; }

    [MaxLength(120)]
    public string? ApelidoContato { get; set; }
}

public sealed class ClassificarAceiteDivisaoRequest
{
    public Guid? CategoriaId { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public Guid? CartaoCreditoId { get; set; }
}

public sealed class RecusarDivisaoRequest
{
    [MaxLength(500)]
    public string? Motivo { get; set; }
}

public sealed class ReenviarDivisaoRequest
{
    [Range(0.01, 99.99)]
    public decimal? PercentualConvidado { get; set; }
}

public sealed class ExcluirDivisaoRequest
{
    [Required]
    [MaxLength(40)]
    public string Escopo { get; set; } = "EstaOcorrencia";
}

public class ProporAlteracaoDivisaoRequest
{
    [Required]
    [MaxLength(40)]
    public string Escopo { get; set; } = "EstaOcorrencia";

    [Range(0.01, 999999999999.99)]
    public decimal? ValorTotal { get; set; }

    [Range(0.01, 99.99)]
    public decimal? PercentualConvidado { get; set; }

    public DateOnly? Vencimento { get; set; }

    [Range(1, 600)]
    public int? QuantidadeParcelas { get; set; }

    [MaxLength(40)]
    public string? Recorrencia { get; set; }

    [MaxLength(40)]
    public string? Frequencia { get; set; }

    [MaxLength(80)]
    public string? ResponsabilidadeParticipante { get; set; }
}

public sealed class ResponderAlteracaoDivisaoRequest
{
    [MaxLength(500)]
    public string? Motivo { get; set; }
}

public sealed class ReenviarAlteracaoDivisaoRequest : ProporAlteracaoDivisaoRequest
{
}

public sealed class DivisaoTransacaoResponse
{
    public Guid Id { get; set; }
    public Guid UsuarioCriadorId { get; set; }
    public Guid? TransacaoOrigemId { get; set; }
    public decimal ValorTotal { get; set; }
    public DivisaoTransacaoStatus Status { get; set; }
    public int VersaoAtual { get; set; }
    public int QuantidadeReenvios { get; set; }
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
    public IReadOnlyList<DivisaoParticipanteResponse> Participantes { get; set; } = [];
    public IReadOnlyList<DivisaoVersaoResponse> Versoes { get; set; } = [];
}

public sealed class DivisaoParticipanteResponse
{
    public Guid Id { get; set; }
    public Guid? ParticipanteUsuarioId { get; set; }
    public TipoParticipanteDivisao TipoParticipante { get; set; }
    public decimal Percentual { get; set; }
    public decimal Valor { get; set; }
    public DivisaoTransacaoParticipanteStatus Status { get; set; }
    public int VersaoConvite { get; set; }
    public DateTimeOffset? ExpiraEm { get; set; }
    public Guid? TransacaoGeradaId { get; set; }
    public bool Ativo { get; set; }
}

public sealed class DivisaoVersaoResponse
{
    public Guid Id { get; set; }
    public int Versao { get; set; }
    public DivisaoTransacaoVersaoStatus Status { get; set; }
    public string Escopo { get; set; } = string.Empty;
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
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset? RespondidoEm { get; set; }
    public string? MotivoResposta { get; set; }
}
