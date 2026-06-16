using SistemaFinanceiro.Api.Dtos.Transacoes;

namespace SistemaFinanceiro.Api.Services.Transacoes;

public interface ITransacaoService
{
    Task<ExtratoMensalResponse> GetExtratoMensalAsync(int mes, int ano, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<FaturaConsolidadaResponse>> GetFaturasDoMesAsync(int mes, int ano, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<TransacaoResponse> CriarAsync(CriarTransacaoRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<TransacaoResponse?> AtualizarAsync(Guid id, CriarTransacaoRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<TransacaoResponse> AnteciparParcelaAsync(AnteciparParcelaRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<bool> ExcluirAsync(Guid id, Guid usuarioId, DateOnly? dataOcorrencia = null, CancellationToken cancellationToken = default);
    Task<bool?> AlternarStatusPagamentoAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<bool?> AlternarStatusFaturaAsync(Guid cartaoCreditoId, DateOnly dataVencimento, Guid usuarioId, CancellationToken cancellationToken = default);
}
