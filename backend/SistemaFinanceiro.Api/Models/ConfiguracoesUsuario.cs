using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class ConfiguracoesUsuario : IMustHaveTenant
{
    public Guid UsuarioId { get; set; }
    public bool ReceberNotificacoes { get; set; } = true;
    public bool AvisarVencimento { get; set; } = true;
    public bool AvisarMelhorDia { get; set; } = true;
    public int DiasAntecedenciaVencimento { get; set; } = 2;

    public Usuario Usuario { get; set; } = null!;
}
