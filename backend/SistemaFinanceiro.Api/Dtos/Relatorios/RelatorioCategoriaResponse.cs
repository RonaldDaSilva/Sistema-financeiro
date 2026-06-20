namespace SistemaFinanceiro.Api.Dtos.Relatorios;

public sealed class RelatorioCategoriaResponse
{
    public Guid? CategoriaId { get; set; }
    public string CategoriaNome { get; set; } = string.Empty;
    public string CategoriaCorHexa { get; set; } = "#64748B";
    public decimal Valor { get; set; }
}
