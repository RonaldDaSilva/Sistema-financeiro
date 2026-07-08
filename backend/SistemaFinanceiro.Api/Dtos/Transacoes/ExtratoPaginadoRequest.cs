using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class ExtratoPaginadoRequest
{
    public int Mes { get; set; }
    public int Ano { get; set; }
    public DateOnly? DataInicial { get; set; }
    public DateOnly? DataFinal { get; set; }
    public bool? ApenasDivididas { get; set; }
    public TipoTransacao? Tipo { get; set; }
    public Guid? CategoriaId { get; set; }
    public StatusFiltro? Status { get; set; }
    public string OrdenarPor { get; set; } = "data";
    public string Direcao { get; set; } = "desc";
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}
