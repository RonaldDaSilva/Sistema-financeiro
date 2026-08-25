using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class DivisaoTransacaoParticipante : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid DivisaoTransacaoId { get; set; }
    public Guid? ParticipanteUsuarioId { get; set; }
    public TipoParticipanteDivisao TipoParticipante { get; set; }
    public decimal Percentual { get; set; }
    public decimal Valor { get; set; }
    public ModoDefinicaoParticipacaoDivisao ModoDefinicao { get; set; } =
        ModoDefinicaoParticipacaoDivisao.Percentual;
    public DivisaoTransacaoParticipanteStatus Status { get; set; } = DivisaoTransacaoParticipanteStatus.Pendente;
    public DateTimeOffset? ExpiraEm { get; set; }
    public Guid? TransacaoGeradaId { get; set; }
    public Guid? CompraParceladaGeradaId { get; set; }
    public DateTimeOffset? RespondidoEm { get; set; }
    public int? VersaoAceita { get; set; }
    public int VersaoConvite { get; set; } = 1;
    public string? MotivoResposta { get; set; }
    public bool Ativo { get; set; } = true;

    public DivisaoTransacao DivisaoTransacao { get; set; } = null!;
    public Usuario? ParticipanteUsuario { get; set; }
    public Transacao? TransacaoGerada { get; set; }
    public CompraParcelada? CompraParceladaGerada { get; set; }
    public ICollection<DivisaoTransacaoVersaoParticipante> Alteracoes { get; set; } =
        new List<DivisaoTransacaoVersaoParticipante>();
}
