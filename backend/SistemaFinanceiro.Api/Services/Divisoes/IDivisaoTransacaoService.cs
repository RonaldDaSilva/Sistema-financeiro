using SistemaFinanceiro.Api.Dtos.Divisoes;

namespace SistemaFinanceiro.Api.Services.Divisoes;

public interface IDivisaoTransacaoService
{
    Task<DivisaoTransacaoResponse?> ObterAsync(Guid usuarioId, Guid divisaoId, CancellationToken cancellationToken = default);
    Task<DivisoesCompartilhadasResponse> ListarCompartilhadasAsync(Guid usuarioId, ListarDivisoesCompartilhadasRequest request, CancellationToken cancellationToken = default);
    Task<ResolverConvidadoDivisaoResponse> ResolverConvidadoAsync(Guid usuarioId, ResolverConvidadoDivisaoRequest request, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse> CriarConviteAsync(Guid usuarioId, CriarConviteDivisaoRequest request, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> AceitarAsync(Guid usuarioId, Guid participanteId, ClassificarAceiteDivisaoRequest? request = null, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> RecusarAsync(Guid usuarioId, Guid participanteId, RecusarDivisaoRequest request, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> AssumirValorAsync(Guid usuarioId, Guid divisaoId, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> AssumirValorParticipanteAsync(Guid usuarioId, Guid participanteId, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> ManterParteCriadorAsync(Guid usuarioId, Guid participanteId, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> ReenviarAsync(Guid usuarioId, Guid divisaoId, ReenviarDivisaoRequest request, CancellationToken cancellationToken = default);
    Task<bool> ExcluirAsync(Guid usuarioId, Guid divisaoId, ExcluirDivisaoRequest request, CancellationToken cancellationToken = default);
    Task<bool> CancelarParticipacaoAsync(Guid usuarioId, Guid participanteId, CancellationToken cancellationToken = default);
    Task<int> ProcessarExpiracoesAsync(DateTimeOffset agora, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> ProporAlteracaoAsync(Guid usuarioId, Guid divisaoId, ProporAlteracaoDivisaoRequest request, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> AceitarAlteracaoAsync(Guid usuarioId, Guid versaoId, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> RecusarAlteracaoAsync(Guid usuarioId, Guid versaoId, ResponderAlteracaoDivisaoRequest request, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> ReenviarAlteracaoAsync(Guid usuarioId, Guid versaoId, ReenviarAlteracaoDivisaoRequest request, CancellationToken cancellationToken = default);
    Task<DivisaoTransacaoResponse?> ManterVersaoAnteriorAsync(Guid usuarioId, Guid versaoId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ReembolsoDivisaoResponse>> ListarReembolsosPendentesAsync(Guid usuarioId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ReembolsoDivisaoResponse>> ListarReembolsosAsync(Guid usuarioId, Guid divisaoId, CancellationToken cancellationToken = default);
    Task<ReembolsoDivisaoResponse?> DispensarReembolsoAsync(Guid usuarioId, Guid reembolsoId, CancellationToken cancellationToken = default);
}
