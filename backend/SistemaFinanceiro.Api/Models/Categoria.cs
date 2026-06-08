using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class Categoria : IHasGuidId
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? UsuarioId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string CorHexa { get; set; } = "#000000";

    public Usuario? Usuario { get; set; }
    public ICollection<CompraParcelada> ComprasParceladas { get; set; } = new List<CompraParcelada>();
    public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();
}
