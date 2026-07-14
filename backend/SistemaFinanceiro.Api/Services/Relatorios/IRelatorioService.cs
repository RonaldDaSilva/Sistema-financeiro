using SistemaFinanceiro.Api.Dtos.Relatorios;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Relatorios;

public interface IRelatorioService
{
    Task<RelatorioGraficosResponse> GetGraficosAsync(
        DateOnly dataInicial,
        DateOnly dataFinal,
        Guid usuarioId,
        Guid? contaBancariaId = null,
        Guid? cartaoCreditoId = null,
        IReadOnlyCollection<Guid>? categoriaIds = null,
        TipoTransacao? tipoTransacao = null,
        string? status = null,
        bool somenteRecorrentes = false,
        bool somenteParceladas = false,
        CancellationToken cancellationToken = default);
}
