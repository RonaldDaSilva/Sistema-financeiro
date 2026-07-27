using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class ContatoDivisao : IHasGuidId, IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Guid UsuarioContatoId { get; set; }
    public string? Apelido { get; set; }
    public DateTimeOffset? UltimoUsoEm { get; set; }
    public DateTimeOffset CriadoEm { get; set; } = DateTimeOffset.UtcNow;
    public bool Ativo { get; set; } = true;

    public Usuario UsuarioProprietario { get; set; } = null!;
    public Usuario UsuarioContato { get; set; } = null!;
}
