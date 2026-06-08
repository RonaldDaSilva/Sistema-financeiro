namespace SistemaFinanceiro.Api.Models.Common;

public interface IMustHaveTenant
{
    Guid UsuarioId { get; set; }
}
