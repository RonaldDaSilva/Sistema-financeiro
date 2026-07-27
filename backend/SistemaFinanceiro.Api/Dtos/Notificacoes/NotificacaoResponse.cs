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
    public string? Entidade { get; set; }
    public Guid? EntidadeId { get; set; }
    public string? Rota { get; set; }
    public string? AcaoPendente { get; set; }
    public int? Versao { get; set; }
}
