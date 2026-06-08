namespace SistemaFinanceiro.Api.Dtos.Categorias;

public sealed class CategoriaResponse
{
    public Guid Id { get; set; }
    public Guid? UsuarioId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string CorHexa { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
}
