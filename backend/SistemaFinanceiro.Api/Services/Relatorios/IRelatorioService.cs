using SistemaFinanceiro.Api.Dtos.Relatorios;

namespace SistemaFinanceiro.Api.Services.Relatorios;

public interface IRelatorioService
{
    Task<RelatorioGraficosResponse> GetGraficosAsync(
        DateOnly dataInicial,
        DateOnly dataFinal,
        Guid usuarioId,
        CancellationToken cancellationToken = default);
}
