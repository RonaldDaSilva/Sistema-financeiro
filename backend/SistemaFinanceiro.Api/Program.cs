using System.Text;
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
using SistemaFinanceiro.Api.Services.Exportacao;
using SistemaFinanceiro.Api.Services.Notificacoes;
using SistemaFinanceiro.Api.Services.Tenancy;
using SistemaFinanceiro.Api.Services.Transacoes;
using SistemaFinanceiro.Api.Services.Usuarios;

var builder = WebApplication.CreateBuilder(args);

QuestPDF.Settings.License = LicenseType.Community;

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>();

if (allowedOrigins is null || allowedOrigins.Length == 0)
{
    allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
}

if (!string.IsNullOrWhiteSpace(jwtOptions.Secret))
{
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
}
else
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme);
}

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

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<ITenantProvider, HttpContextTenantProvider>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICategoriaService, CategoriaService>();
builder.Services.AddScoped<ICartaoCreditoService, CartaoCreditoService>();
builder.Services.AddScoped<ICompraParceladaService, CompraParceladaService>();
builder.Services.AddScoped<ITransacaoService, TransacaoService>();
builder.Services.AddScoped<IExportacaoService, ExportacaoService>();
builder.Services.AddScoped<IUsuarioService, UsuarioService>();
builder.Services.AddScoped<INotificacaoService, NotificacaoService>();
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
