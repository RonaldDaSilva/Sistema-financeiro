using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Services.Tenancy;

namespace SistemaFinanceiro.Api.Tests.Infrastructure;

internal sealed class SqliteTestDatabase : IDisposable
{
    private readonly SqliteConnection _connection;

    public SqliteTestDatabase(Guid tenantId)
    {
        TenantId = tenantId;
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        Context = CreateContext();
        Context.Database.EnsureCreated();
    }

    public Guid TenantId { get; }
    public AppDbContext Context { get; }

    public AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .EnableSensitiveDataLogging()
            .Options;

        return new AppDbContext(options, new FixedTenantProvider(TenantId));
    }

    public void Dispose()
    {
        Context.Dispose();
        _connection.Dispose();
    }

    private sealed class FixedTenantProvider : ITenantProvider
    {
        public FixedTenantProvider(Guid tenantId)
        {
            UsuarioId = tenantId;
        }

        public Guid? UsuarioId { get; }
    }
}
