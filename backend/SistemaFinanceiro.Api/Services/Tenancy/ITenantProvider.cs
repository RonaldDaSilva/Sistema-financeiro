namespace SistemaFinanceiro.Api.Services.Tenancy;

public interface ITenantProvider
{
    Guid? UsuarioId { get; }
}
