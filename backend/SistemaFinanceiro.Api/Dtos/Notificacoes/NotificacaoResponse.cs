using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.Notificacoes;

public sealed class NotificacaoResponse
{
    public Guid Id { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
    public bool Lida { get; set; }
    public DateTimeOffset DataCriacao { get; set; }
    public TipoNotificacao TipoNotificacao { get; set; }
}
