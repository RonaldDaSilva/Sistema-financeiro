using SistemaFinanceiro.Api.Dtos.Dashboard;

namespace SistemaFinanceiro.Api.Services.Dashboard;

public interface IDashboardService
{
    Task<DashboardInicioDto> GetInicioAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default);

    Task<DashboardRelatoriosDto> GetRelatoriosAsync(
        int mes,
        int ano,
        Guid usuarioId,
        Guid? contaBancariaId = null,
        CancellationToken cancellationToken = default);
}
