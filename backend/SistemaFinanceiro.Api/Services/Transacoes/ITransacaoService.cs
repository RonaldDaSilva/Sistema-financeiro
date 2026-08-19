using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Dtos;

namespace SistemaFinanceiro.Api.Services.Transacoes;

public interface ITransacaoService
{
    Task<ExtratoMensalResponse> GetExtratoMensalAsync(int mes, int ano, Guid usuarioId, bool? apenasDivididas = null, StatusFiltro? status = null, CancellationToken cancellationToken = default);
    async Task<DadosMensaisRelatorioResponse> GetDadosMensaisRelatorioAsync(
        int mes,
        int ano,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var extrato = await GetExtratoMensalAsync(
            mes,
            ano,
            usuarioId,
            cancellationToken: cancellationToken);
        var faturas = await GetFaturasDoMesAsync(mes, ano, usuarioId, cancellationToken);
        return new DadosMensaisRelatorioResponse
        {
            Extrato = extrato,
            Faturas = faturas
        };
    }
    Task<PagedResponse<ExtratoMensalItemResponse>> GetExtratoMensalPaginadoAsync(ExtratoPaginadoRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<FaturaConsolidadaResponse>> GetFaturasDoMesAsync(int mes, int ano, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<Guid> CriarAsync(CriarTransacaoRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<Guid?> AtualizarAsync(Guid id, CriarTransacaoRequest request, Guid usuarioId, bool replicarFuturas = true, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TransacaoResponse>> AnteciparParcelaAsync(AnteciparParcelaRequest request, Guid usuarioId, CancellationToken cancellationToken = default);
    Task<bool> ExcluirAsync(Guid id, Guid usuarioId, DateOnly? dataOcorrencia = null, bool replicarFuturas = true, CancellationToken cancellationToken = default);
    Task<bool?> AlternarStatusPagamentoAsync(Guid id, Guid usuarioId, DateOnly? dataOcorrencia = null, AlterarStatusPagamentoRequest? request = null, CancellationToken cancellationToken = default);
    Task<bool?> AlternarStatusFaturaAsync(Guid cartaoCreditoId, DateOnly dataVencimento, Guid usuarioId, PagarFaturaRequest? request = null, CancellationToken cancellationToken = default);
}
