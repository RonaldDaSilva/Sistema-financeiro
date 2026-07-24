using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using SistemaFinanceiro.Api.Configuration;
using SistemaFinanceiro.Api.Dtos.Auth;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Auth;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class AuthServiceTests
{
    [Fact]
    public async Task LoginEmiteAccessCurtoRefreshPersistenteESessaoAbsoluta()
    {
        using var database = new SqliteTestDatabase(Guid.NewGuid());
        var clock = new FixedAuthClock(new DateTimeOffset(2026, 7, 24, 12, 0, 0, TimeSpan.Zero));
        var service = CreateService(database, clock);

        var response = await service.CadastrarAsync(new CadastrarUsuarioRequest
        {
            Nome = "Ronald",
            Email = "ronald@example.com",
            Senha = "SenhaForte123"
        }, CancellationToken.None);

        Assert.Equal(clock.UtcNow.AddMinutes(15), response.AccessTokenExpiraEm);
        Assert.Equal(clock.UtcNow.AddDays(30), response.RefreshTokenExpiraEm);
        Assert.Equal(clock.UtcNow.AddDays(60), response.SessaoExpiraEm);
        Assert.Equal(clock.UtcNow, response.UltimaAtividadeEm);
        Assert.DoesNotContain(response.RefreshToken, database.Context.RefreshTokens.Select(token => token.TokenHash));
    }

    [Fact]
    public async Task RefreshDentroDaJanelaRotacionaERevogaTokenAnterior()
    {
        using var database = new SqliteTestDatabase(Guid.NewGuid());
        var clock = new FixedAuthClock(new DateTimeOffset(2026, 7, 24, 12, 0, 0, TimeSpan.Zero));
        var service = CreateService(database, clock);
        var login = await CreateSessionAsync(service);

        clock.UtcNow = clock.UtcNow.AddDays(10);
        var refreshed = await service.RenovarSessaoAsync(
            new RefreshTokenRequest { RefreshToken = login.RefreshToken },
            CancellationToken.None);

        Assert.NotNull(refreshed);
        Assert.NotEqual(login.RefreshToken, refreshed.RefreshToken);
        Assert.Equal(clock.UtcNow.AddDays(30), refreshed.RefreshTokenExpiraEm);
        Assert.Equal(login.SessaoExpiraEm, refreshed.SessaoExpiraEm);
        Assert.Equal(1, database.Context.RefreshTokens.Count(token => token.RevogadoEm != null));
    }

    [Fact]
    public async Task RefreshAposInatividadeDeTrintaDiasFalha()
    {
        using var database = new SqliteTestDatabase(Guid.NewGuid());
        var clock = new FixedAuthClock(new DateTimeOffset(2026, 7, 24, 12, 0, 0, TimeSpan.Zero));
        var service = CreateService(database, clock);
        var login = await CreateSessionAsync(service);

        clock.UtcNow = clock.UtcNow.AddDays(31);
        var refreshed = await service.RenovarSessaoAsync(
            new RefreshTokenRequest { RefreshToken = login.RefreshToken },
            CancellationToken.None);

        Assert.Null(refreshed);
    }

    [Fact]
    public async Task SessaoNaoUltrapassaValidadeAbsolutaDeSessentaDias()
    {
        using var database = new SqliteTestDatabase(Guid.NewGuid());
        var clock = new FixedAuthClock(new DateTimeOffset(2026, 7, 24, 12, 0, 0, TimeSpan.Zero));
        var service = CreateService(database, clock);
        var login = await CreateSessionAsync(service);

        clock.UtcNow = clock.UtcNow.AddDays(29);
        var refreshed = await service.RenovarSessaoAsync(
            new RefreshTokenRequest { RefreshToken = login.RefreshToken },
            CancellationToken.None);

        Assert.NotNull(refreshed);
        Assert.Equal(login.SessaoExpiraEm, refreshed.SessaoExpiraEm);
        Assert.Equal(clock.UtcNow.AddDays(30), refreshed.RefreshTokenExpiraEm);

        clock.UtcNow = clock.UtcNow.AddDays(29);
        var refreshedNearAbsoluteLimit = await service.RenovarSessaoAsync(
            new RefreshTokenRequest { RefreshToken = refreshed.RefreshToken },
            CancellationToken.None);

        Assert.NotNull(refreshedNearAbsoluteLimit);
        Assert.Equal(login.SessaoExpiraEm, refreshedNearAbsoluteLimit.SessaoExpiraEm);
        Assert.Equal(login.SessaoExpiraEm, refreshedNearAbsoluteLimit.RefreshTokenExpiraEm);

        clock.UtcNow = clock.UtcNow.AddDays(3);
        var expired = await service.RenovarSessaoAsync(
            new RefreshTokenRequest { RefreshToken = refreshedNearAbsoluteLimit.RefreshToken },
            CancellationToken.None);

        Assert.Null(expired);
    }

    [Fact]
    public async Task ReutilizacaoDeRefreshRevogadoRevogaSessoesAtivas()
    {
        using var database = new SqliteTestDatabase(Guid.NewGuid());
        var clock = new FixedAuthClock(new DateTimeOffset(2026, 7, 24, 12, 0, 0, TimeSpan.Zero));
        var service = CreateService(database, clock);
        var login = await CreateSessionAsync(service);
        var refreshed = await service.RenovarSessaoAsync(
            new RefreshTokenRequest { RefreshToken = login.RefreshToken },
            CancellationToken.None);

        Assert.NotNull(refreshed);

        var reused = await service.RenovarSessaoAsync(
            new RefreshTokenRequest { RefreshToken = login.RefreshToken },
            CancellationToken.None);

        Assert.Null(reused);

        var activeRefreshFails = await service.RenovarSessaoAsync(
            new RefreshTokenRequest { RefreshToken = refreshed.RefreshToken },
            CancellationToken.None);

        Assert.Null(activeRefreshFails);
        Assert.All(database.Context.RefreshTokens, token => Assert.NotNull(token.RevogadoEm));
        Assert.Contains(database.Context.RefreshTokens, token => token.ReutilizadoEm != null);
    }

    [Fact]
    public async Task LogoutRevogaRefreshToken()
    {
        using var database = new SqliteTestDatabase(Guid.NewGuid());
        var clock = new FixedAuthClock(new DateTimeOffset(2026, 7, 24, 12, 0, 0, TimeSpan.Zero));
        var service = CreateService(database, clock);
        var login = await CreateSessionAsync(service);

        await service.LogoutAsync(
            new RefreshTokenRequest { RefreshToken = login.RefreshToken },
            CancellationToken.None);

        var refreshed = await service.RenovarSessaoAsync(
            new RefreshTokenRequest { RefreshToken = login.RefreshToken },
            CancellationToken.None);

        Assert.Null(refreshed);
        Assert.All(database.Context.RefreshTokens, token => Assert.NotNull(token.RevogadoEm));
    }

    private static Task<AuthResponse> CreateSessionAsync(AuthService service)
    {
        return service.CadastrarAsync(new CadastrarUsuarioRequest
        {
            Nome = "Ronald",
            Email = "ronald@example.com",
            Senha = "SenhaForte123"
        }, CancellationToken.None);
    }

    private static AuthService CreateService(SqliteTestDatabase database, FixedAuthClock clock)
    {
        return new AuthService(
            database.Context,
            new PasswordHasher<Usuario>(),
            Options.Create(new JwtOptions
            {
                Issuer = "SistemaFinanceiro.Api.Tests",
                Audience = "SistemaFinanceiro.Web.Tests",
                Secret = "teste-chave-com-mais-de-trinta-e-dois-caracteres",
                AccessTokenMinutes = 15,
                RefreshTokenIdleDays = 30,
                SessionAbsoluteDays = 60
            }),
            clock);
    }

    private sealed class FixedAuthClock : IAuthClock
    {
        public FixedAuthClock(DateTimeOffset utcNow)
        {
            UtcNow = utcNow;
        }

        public DateTimeOffset UtcNow { get; set; }
    }
}
