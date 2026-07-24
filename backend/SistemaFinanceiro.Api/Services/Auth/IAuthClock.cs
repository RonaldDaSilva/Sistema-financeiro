namespace SistemaFinanceiro.Api.Services.Auth;

public interface IAuthClock
{
    DateTimeOffset UtcNow { get; }
}

public sealed class SystemAuthClock : IAuthClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
