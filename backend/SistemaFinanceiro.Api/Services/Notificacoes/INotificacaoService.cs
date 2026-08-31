using SistemaFinanceiro.Api.Dtos.Notificacoes;

namespace SistemaFinanceiro.Api.Services.Notificacoes;

public interface INotificacaoService
{
    Task<NotificacoesPaginadasResponse> ListarAsync(Guid usuarioId, ListarNotificacoesRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<NotificacaoResponse>> GetNaoLidasAsync(Guid usuarioId, CancellationToken cancellationToken = default);
    Task<bool> MarcarComoLidaAsync(Guid usuarioId, Guid notificacaoId, CancellationToken cancellationToken = default);
    Task MarcarComoLidasAsync(Guid usuarioId, CancellationToken cancellationToken = default);
    Task<ConfiguracoesNotificacaoResponse> ObterConfiguracoesAsync(Guid usuarioId, CancellationToken cancellationToken = default);
    Task<ConfiguracoesNotificacaoResponse> AtualizarConfiguracoesAsync(Guid usuarioId, AtualizarConfiguracoesNotificacaoRequest request, CancellationToken cancellationToken = default);
}
