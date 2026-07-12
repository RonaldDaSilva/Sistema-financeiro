using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QuestPDF.Infrastructure;
using SistemaFinanceiro.Api.Configuration;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Auth;
using SistemaFinanceiro.Api.Services.CartoesCredito;
using SistemaFinanceiro.Api.Services.Categorias;
using SistemaFinanceiro.Api.Services.ComprasParceladas;
using SistemaFinanceiro.Api.Services.ContasBancarias;
using SistemaFinanceiro.Api.Services.Dashboard;
using SistemaFinanceiro.Api.Services.Exportacao;
using SistemaFinanceiro.Api.Services.Notificacoes;
using SistemaFinanceiro.Api.Services.Relatorios;
using SistemaFinanceiro.Api.Services.Tenancy;
using SistemaFinanceiro.Api.Services.Transacoes;
using SistemaFinanceiro.Api.Services.Usuarios;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

QuestPDF.Settings.License = LicenseType.Community;

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
ValidarConfiguracaoJwt(jwtOptions);

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>();

if (allowedOrigins is null || allowedOrigins.Length == 0)
{
    allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Secret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});
builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();

if (builder.Environment.IsDevelopment())
{
    var keysDirectory = Path.Combine(builder.Environment.ContentRootPath, ".keys");
    Directory.CreateDirectory(keysDirectory);
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(keysDirectory));
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<ITenantProvider, HttpContextTenantProvider>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICategoriaService, CategoriaService>();
builder.Services.AddScoped<ICartaoCreditoService, CartaoCreditoService>();
builder.Services.AddScoped<ICompraParceladaService, CompraParceladaService>();
builder.Services.AddScoped<IContaBancariaService, ContaBancariaService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<ITransacaoService, TransacaoService>();
builder.Services.AddScoped<IExportacaoService, ExportacaoService>();
builder.Services.AddScoped<IUsuarioService, UsuarioService>();
builder.Services.AddScoped<INotificacaoService, NotificacaoService>();
builder.Services.AddScoped<IRelatorioService, RelatorioService>();
builder.Services.AddScoped<PasswordHasher<Usuario>>();
builder.Services.AddHostedService<NotificacaoBackgroundService>();

var app = builder.Build();

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapControllers();

app.MapGet("/", () => Results.Ok("API Financeira rodando perfeitamente!"));
app.Run();

static void ValidarConfiguracaoJwt(JwtOptions jwtOptions)
{
    var configuracoesAusentes = new List<string>();

    if (string.IsNullOrWhiteSpace(jwtOptions.Issuer))
    {
        configuracoesAusentes.Add("Jwt__Issuer");
    }

    if (string.IsNullOrWhiteSpace(jwtOptions.Audience))
    {
        configuracoesAusentes.Add("Jwt__Audience");
    }

    if (string.IsNullOrWhiteSpace(jwtOptions.Secret))
    {
        configuracoesAusentes.Add("Jwt__Secret");
    }

    if (configuracoesAusentes.Count > 0)
    {
        throw new InvalidOperationException(
            $"Configuração JWT incompleta. Defina as variáveis: {string.Join(", ", configuracoesAusentes)}.");
    }

    if (Encoding.UTF8.GetByteCount(jwtOptions.Secret) < 32)
    {
        throw new InvalidOperationException("Jwt__Secret deve ter pelo menos 32 bytes.");
    }

    if (jwtOptions.AccessTokenMinutes <= 0 || jwtOptions.RefreshTokenIdleHours <= 0)
    {
        throw new InvalidOperationException(
            "Jwt__AccessTokenMinutes e Jwt__RefreshTokenIdleHours devem ser maiores que zero.");
    }
}
