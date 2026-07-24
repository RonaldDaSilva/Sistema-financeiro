using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class RefreshToken : IHasGuidId
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiraEm { get; set; }
    public DateTimeOffset SessaoExpiraEm { get; set; }
    public DateTimeOffset UltimaAtividadeEm { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CriadoEm { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? RevogadoEm { get; set; }
    public DateTimeOffset? ReutilizadoEm { get; set; }

    public bool EstaAtivo =>
        RevogadoEm is null &&
        ReutilizadoEm is null &&
        ExpiraEm > DateTimeOffset.UtcNow &&
        SessaoExpiraEm > DateTimeOffset.UtcNow;

    public Usuario Usuario { get; set; } = null!;
}
