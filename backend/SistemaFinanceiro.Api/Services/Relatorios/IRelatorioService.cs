using SistemaFinanceiro.Api.Dtos.Relatorios;

namespace SistemaFinanceiro.Api.Services.Relatorios;

public interface IRelatorioService
{
    Task<RelatorioGraficosResponse> GetGraficosAsync(
        int mes,
        int ano,
        Guid usuarioId,
        CancellationToken cancellationToken = default);
}
