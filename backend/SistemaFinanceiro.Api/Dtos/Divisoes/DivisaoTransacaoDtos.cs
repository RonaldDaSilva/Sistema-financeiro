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
