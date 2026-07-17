using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Dtos.Transacoes;

namespace SistemaFinanceiro.Api.Dtos.Dashboard;

public sealed class DashboardInicioRequest
{
    public DateOnly? DataInicial { get; set; }
    public DateOnly? DataFinal { get; set; }
    public TipoTransacao? Tipo { get; set; }
    public Guid? CategoriaId { get; set; }
    public List<Guid> CategoriaIds { get; set; } = [];
    public StatusFiltro? Status { get; set; }
    public List<StatusFiltro> Statuses { get; set; } = [];
}
