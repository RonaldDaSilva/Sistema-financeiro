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
    public Guid? TransacaoOrigemId { get; set; }

    public Guid? CompraParceladaId { get; set; }

    [MaxLength(254)]
    public string? EmailConvidado { get; set; }

    [Range(0.01, 99.99)]
    public decimal? PercentualConvidado { get; set; }

    public bool SalvarContato { get; set; }

    [MaxLength(120)]
    public string? ApelidoContato { get; set; }

    public IReadOnlyList<CriarParticipanteUsuarioDivisaoRequest> ParticipantesUsuarios { get; set; } = [];

    public IReadOnlyList<CriarParticipanteExternoDivisaoRequest> ParticipantesExternos { get; set; } = [];
}

public sealed class CriarDivisaoCompraParceladaRequest
{
    public IReadOnlyList<CriarParticipanteUsuarioDivisaoRequest> ParticipantesUsuarios { get; set; } = [];
    public IReadOnlyList<CriarParticipanteExternoDivisaoRequest> ParticipantesExternos { get; set; } = [];
}

public sealed class CriarParticipanteUsuarioDivisaoRequest
{
    [EmailAddress]
    [MaxLength(254)]
    public string? Email { get; set; }

    public Guid? ContatoId { get; set; }

    [Range(0.01, 99.99)]
    public decimal Percentual { get; set; }

    public bool SalvarContato { get; set; }

    [MaxLength(120)]
    public string? ApelidoContato { get; set; }
}

public sealed class CriarParticipanteExternoDivisaoRequest
{
    public ModoDefinicaoParticipacaoDivisao ModoDefinicao { get; set; } =
        ModoDefinicaoParticipacaoDivisao.Percentual;

    [Range(0.01, 99.99)]
    public decimal? Percentual { get; set; }

    [Range(0.01, 999999999999.99)]
    public decimal? Valor { get; set; }

    [MaxLength(160)]
    public string? Nome { get; set; }
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
    public Guid? ParticipanteId { get; set; }

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

    public IReadOnlyList<AlterarParticipanteDivisaoRequest> Participantes { get; set; } = [];

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

public sealed class AlterarParticipanteDivisaoRequest
{
    public Guid ParticipanteId { get; set; }

    [Range(0.01, 99.99)]
    public decimal Percentual { get; set; }
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
    public Guid? CompraParceladaId { get; set; }
    public int? QuantidadeParcelas { get; set; }
    public FormaPagamentoCompraParcelada? FormaPagamentoCompraParcelada { get; set; }
    public DateOnly? DataPrimeiraParcela { get; set; }
    public string? DescricaoOrigem { get; set; }
    public DateOnly? DataSugeridaConvidado { get; set; }
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
    public string? NomeExibicao { get; set; }
    public string? EmailMascarado { get; set; }
    public TipoParticipanteDivisao TipoParticipante { get; set; }
    public decimal Percentual { get; set; }
    public decimal Valor { get; set; }
    public ModoDefinicaoParticipacaoDivisao ModoDefinicao { get; set; }
    public DivisaoTransacaoParticipanteStatus Status { get; set; }
    public int VersaoConvite { get; set; }
    public DateTimeOffset? ExpiraEm { get; set; }
    public Guid? TransacaoGeradaId { get; set; }
    public Guid? CompraParceladaGeradaId { get; set; }
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
    public IReadOnlyList<DivisaoVersaoParticipanteResponse> Participantes { get; set; } = [];
}

public sealed class DivisaoVersaoParticipanteResponse
{
    public Guid Id { get; set; }
    public Guid ParticipanteId { get; set; }
    public Guid? ParticipanteUsuarioId { get; set; }
    public decimal PercentualAnterior { get; set; }
    public decimal PercentualProposto { get; set; }
    public decimal ValorAnterior { get; set; }
    public decimal ValorProposto { get; set; }
    public DivisaoTransacaoVersaoParticipanteStatus Status { get; set; }
    public DateTimeOffset? RespondidoEm { get; set; }
    public string? MotivoResposta { get; set; }
}

public sealed class ReembolsoDivisaoResponse
{
    public Guid Id { get; set; }
    public Guid DivisaoTransacaoId { get; set; }
    public Guid? ParticipanteId { get; set; }
    public Guid? ParticipanteUsuarioId { get; set; }
    public string? ParticipanteExternoNome { get; set; }
    public decimal ValorDevido { get; set; }
    public decimal ValorRecebido { get; set; }
    public decimal SaldoPendente { get; set; }
    public ReembolsoDivisaoStatus Status { get; set; }
}
