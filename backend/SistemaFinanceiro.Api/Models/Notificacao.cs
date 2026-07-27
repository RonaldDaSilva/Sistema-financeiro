using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class Notificacao : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
    public bool Lida { get; set; }
    public DateTimeOffset DataCriacao { get; set; } = DateTimeOffset.UtcNow;
    public TipoNotificacao TipoNotificacao { get; set; }
    public string? Entidade { get; set; }
    public Guid? EntidadeId { get; set; }
    public string? Rota { get; set; }
    public string? AcaoPendente { get; set; }
    public int? Versao { get; set; }

    public Usuario Usuario { get; set; } = null!;
}
