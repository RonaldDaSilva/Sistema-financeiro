using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Models.Common;
using SistemaFinanceiro.Api.Services.Tenancy;

namespace SistemaFinanceiro.Api.Data;

public sealed class AppDbContext : DbContext
{
    private readonly ITenantProvider _tenantProvider;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantProvider tenantProvider)
        : base(options)
    {
        _tenantProvider = tenantProvider;
    }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Categoria> Categorias => Set<Categoria>();
    public DbSet<CartaoCredito> CartoesCredito => Set<CartaoCredito>();
    public DbSet<CompraParcelada> ComprasParceladas => Set<CompraParcelada>();
    public DbSet<Transacao> Transacoes => Set<Transacao>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Notificacao> Notificacoes => Set<Notificacao>();
    public DbSet<ConfiguracoesUsuario> ConfiguracoesUsuarios => Set<ConfiguracoesUsuario>();

    public Guid? TenantId => _tenantProvider.UsuarioId;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        ConfigureUsuario(modelBuilder);
        ConfigureCategoria(modelBuilder);
        ConfigureCartaoCredito(modelBuilder);
        ConfigureCompraParcelada(modelBuilder);
        ConfigureTransacao(modelBuilder);
        ConfigureRefreshToken(modelBuilder);
        ConfigureNotificacao(modelBuilder);
        ConfigureConfiguracoesUsuario(modelBuilder);
        ConfigureTenantFilters(modelBuilder);
    }

    private static void ConfigureUsuario(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.ToTable("usuarios");

            entity.HasKey(usuario => usuario.Id);

            entity.Property(usuario => usuario.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(usuario => usuario.Nome)
                .HasColumnName("nome")
                .HasMaxLength(160)
                .IsRequired();

            entity.Property(usuario => usuario.Email)
                .HasColumnName("email")
                .HasMaxLength(254)
                .IsRequired();

            entity.HasIndex(usuario => usuario.Email)
                .IsUnique();

            entity.Property(usuario => usuario.SenhaHash)
                .HasColumnName("senha_hash")
                .HasMaxLength(512)
                .IsRequired();

            entity.Property(usuario => usuario.Telefone)
                .HasColumnName("telefone")
                .HasMaxLength(30);

            entity.Property(usuario => usuario.Cpf)
                .HasColumnName("cpf")
                .HasMaxLength(11);

            entity.HasIndex(usuario => usuario.Cpf)
                .IsUnique();

            entity.Property(usuario => usuario.CriadoEm)
                .HasColumnName("criado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();
        });
    }

    private static void ConfigureCategoria(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Categoria>(entity =>
        {
            entity.ToTable("categorias");

            entity.HasKey(categoria => categoria.Id);

            entity.Property(categoria => categoria.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(categoria => categoria.UsuarioId)
                .HasColumnName("id_usuario");

            entity.Property(categoria => categoria.Nome)
                .HasColumnName("nome")
                .HasMaxLength(120)
                .IsRequired();

            entity.Property(categoria => categoria.CorHexa)
                .HasColumnName("cor_hexa")
                .HasMaxLength(7)
                .IsRequired();

            entity.HasOne(categoria => categoria.Usuario)
                .WithMany(usuario => usuario.Categorias)
                .HasForeignKey(categoria => categoria.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(categoria => new { categoria.UsuarioId, categoria.Nome })
                .IsUnique();

            entity.HasData(
                new Categoria
                {
                    Id = Guid.Parse("0d2cc7a6-e150-433d-bc47-97b401078f86"),
                    UsuarioId = null,
                    Nome = "🏠 Casa",
                    CorHexa = "#2563EB"
                },
                new Categoria
                {
                    Id = Guid.Parse("6b7df4e6-6937-4c07-9e6f-7d19efa15177"),
                    UsuarioId = null,
                    Nome = "🚗 Carro",
                    CorHexa = "#DC2626"
                },
                new Categoria
                {
                    Id = Guid.Parse("86299a6c-6d3a-49d2-b862-9340673d0425"),
                    UsuarioId = null,
                    Nome = "📚 Educação",
                    CorHexa = "#7C3AED"
                },
                new Categoria
                {
                    Id = Guid.Parse("f3e02a07-08e6-47a0-824d-3acc930c537e"),
                    UsuarioId = null,
                    Nome = "🎮 Lazer",
                    CorHexa = "#DB2777"
                },
                new Categoria
                {
                    Id = Guid.Parse("06fa9f77-5ac4-42d7-aa5a-4f98a38fe692"),
                    UsuarioId = null,
                    Nome = "📈 Investimento",
                    CorHexa = "#059669"
                },
                new Categoria
                {
                    Id = Guid.Parse("c8763c27-954e-439c-9b22-7ff05356c12b"),
                    UsuarioId = null,
                    Nome = "🍽️ Alimentação",
                    CorHexa = "#EA580C"
                });
        });
    }

    private static void ConfigureCartaoCredito(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CartaoCredito>(entity =>
        {
            entity.ToTable("cartoes_credito");

            entity.HasKey(cartao => cartao.Id);

            entity.Property(cartao => cartao.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(cartao => cartao.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(cartao => cartao.ApelidoCartao)
                .HasColumnName("apelido_cartao")
                .HasMaxLength(80)
                .IsRequired();

            entity.Property(cartao => cartao.Banco)
                .HasColumnName("banco")
                .HasMaxLength(120)
                .IsRequired();

            entity.Property(cartao => cartao.DiaVencimento)
                .HasColumnName("dia_vencimento")
                .IsRequired();

            entity.Property(cartao => cartao.MelhorDiaCompra)
                .HasColumnName("melhor_dia_compra")
                .IsRequired();

            entity.Property(cartao => cartao.LimiteTotal)
                .HasColumnName("limite_total")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.HasOne(cartao => cartao.Usuario)
                .WithMany(usuario => usuario.CartoesCredito)
                .HasForeignKey(cartao => cartao.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(cartao => new { cartao.UsuarioId, cartao.ApelidoCartao });
        });
    }

    private static void ConfigureCompraParcelada(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CompraParcelada>(entity =>
        {
            entity.ToTable("compras_parceladas");

            entity.HasKey(compra => compra.Id);

            entity.Property(compra => compra.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(compra => compra.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(compra => compra.CartaoCreditoId)
                .HasColumnName("id_cartao_credito");

            entity.Property(compra => compra.CategoriaId)
                .HasColumnName("id_categoria")
                .IsRequired();

            entity.Property(compra => compra.Descricao)
                .HasColumnName("descricao")
                .HasMaxLength(180)
                .IsRequired();

            entity.Property(compra => compra.QuantidadeParcelas)
                .HasColumnName("quantidade_parcelas")
                .IsRequired();

            entity.Property(compra => compra.ValorTotal)
                .HasColumnName("valor_total")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(compra => compra.DataCompra)
                .HasColumnName("data_compra")
                .IsRequired();

            entity.Property(compra => compra.DataPrimeiroVencimento)
                .HasColumnName("data_primeiro_vencimento");

            entity.Property(compra => compra.FormaPagamento)
                .HasColumnName("forma_pagamento")
                .HasConversion<string>()
                .HasMaxLength(30)
                .HasDefaultValue(FormaPagamentoCompraParcelada.CartaoCredito)
                .IsRequired();

            entity.HasOne(compra => compra.Usuario)
                .WithMany(usuario => usuario.ComprasParceladas)
                .HasForeignKey(compra => compra.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(compra => compra.CartaoCredito)
                .WithMany(cartao => cartao.ComprasParceladas)
                .HasForeignKey(compra => compra.CartaoCreditoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(compra => compra.Categoria)
                .WithMany(categoria => categoria.ComprasParceladas)
                .HasForeignKey(compra => compra.CategoriaId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureTransacao(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Transacao>(entity =>
        {
            entity.ToTable("transacoes");

            entity.HasKey(transacao => transacao.Id);

            entity.Property(transacao => transacao.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(transacao => transacao.CodigoExibicao)
                .HasColumnName("codigo_exibicao")
                .IsRequired();

            entity.Property(transacao => transacao.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(transacao => transacao.Tipo)
                .HasColumnName("tipo")
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(transacao => transacao.Descricao)
                .HasColumnName("descricao")
                .HasMaxLength(180)
                .IsRequired();

            entity.Property(transacao => transacao.Valor)
                .HasColumnName("valor")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(transacao => transacao.DataOcorrencia)
                .HasColumnName("data_ocorrencia")
                .IsRequired();

            entity.Property(transacao => transacao.CategoriaId)
                .HasColumnName("id_categoria");

            entity.Property(transacao => transacao.FormaPagamento)
                .HasColumnName("forma_pagamento")
                .HasMaxLength(60)
                .IsRequired();

            entity.Property(transacao => transacao.CartaoCreditoId)
                .HasColumnName("id_cartao_credito");

            entity.Property(transacao => transacao.IsFixa)
                .HasColumnName("is_fixa")
                .IsRequired();

            entity.Property(transacao => transacao.CompraParceladaId)
                .HasColumnName("id_compra_parcelada");

            entity.Property(transacao => transacao.NumeroParcelaQuitada)
                .HasColumnName("numero_parcela_quitada");

            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.CodigoExibicao })
                .IsUnique();

            entity.HasOne(transacao => transacao.Usuario)
                .WithMany(usuario => usuario.Transacoes)
                .HasForeignKey(transacao => transacao.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(transacao => transacao.Categoria)
                .WithMany(categoria => categoria.Transacoes)
                .HasForeignKey(transacao => transacao.CategoriaId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(transacao => transacao.CartaoCredito)
                .WithMany(cartao => cartao.Transacoes)
                .HasForeignKey(transacao => transacao.CartaoCreditoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(transacao => transacao.CompraParcelada)
                .WithMany(compra => compra.TransacoesQuitacao)
                .HasForeignKey(transacao => transacao.CompraParceladaId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureRefreshToken(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");

            entity.HasKey(refreshToken => refreshToken.Id);

            entity.Property(refreshToken => refreshToken.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(refreshToken => refreshToken.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(refreshToken => refreshToken.TokenHash)
                .HasColumnName("token_hash")
                .HasMaxLength(64)
                .IsRequired();

            entity.HasIndex(refreshToken => refreshToken.TokenHash)
                .IsUnique();

            entity.Property(refreshToken => refreshToken.ExpiraEm)
                .HasColumnName("expira_em")
                .IsRequired();

            entity.Property(refreshToken => refreshToken.CriadoEm)
                .HasColumnName("criado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.Property(refreshToken => refreshToken.RevogadoEm)
                .HasColumnName("revogado_em");

            entity.Ignore(refreshToken => refreshToken.EstaAtivo);

            entity.HasOne(refreshToken => refreshToken.Usuario)
                .WithMany(usuario => usuario.RefreshTokens)
                .HasForeignKey(refreshToken => refreshToken.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureNotificacao(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Notificacao>(entity =>
        {
            entity.ToTable("notificacoes");

            entity.HasKey(notificacao => notificacao.Id);

            entity.Property(notificacao => notificacao.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(notificacao => notificacao.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(notificacao => notificacao.Titulo)
                .HasColumnName("titulo")
                .HasMaxLength(160)
                .IsRequired();

            entity.Property(notificacao => notificacao.Mensagem)
                .HasColumnName("mensagem")
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(notificacao => notificacao.Lida)
                .HasColumnName("lida")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(notificacao => notificacao.DataCriacao)
                .HasColumnName("data_criacao")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.Property(notificacao => notificacao.TipoNotificacao)
                .HasColumnName("tipo_notificacao")
                .HasConversion<string>()
                .HasMaxLength(30)
                .IsRequired();

            entity.HasOne(notificacao => notificacao.Usuario)
                .WithMany(usuario => usuario.Notificacoes)
                .HasForeignKey(notificacao => notificacao.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(notificacao => new
            {
                notificacao.UsuarioId,
                notificacao.TipoNotificacao,
                notificacao.Titulo,
                notificacao.DataCriacao
            });
        });
    }

    private static void ConfigureConfiguracoesUsuario(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ConfiguracoesUsuario>(entity =>
        {
            entity.ToTable("configuracoes_usuario");

            entity.HasKey(configuracao => configuracao.UsuarioId);

            entity.Property(configuracao => configuracao.UsuarioId)
                .HasColumnName("id_usuario")
                .ValueGeneratedNever();

            entity.Property(configuracao => configuracao.ReceberNotificacoes)
                .HasColumnName("receber_notificacoes")
                .HasDefaultValue(true)
                .IsRequired();

            entity.Property(configuracao => configuracao.AvisarVencimento)
                .HasColumnName("avisar_vencimento")
                .HasDefaultValue(true)
                .IsRequired();

            entity.Property(configuracao => configuracao.AvisarMelhorDia)
                .HasColumnName("avisar_melhor_dia")
                .HasDefaultValue(true)
                .IsRequired();

            entity.Property(configuracao => configuracao.DiasAntecedenciaVencimento)
                .HasColumnName("dias_antecedencia_vencimento")
                .HasDefaultValue(2)
                .IsRequired();

            entity.HasOne(configuracao => configuracao.Usuario)
                .WithOne(usuario => usuario.Configuracoes)
                .HasForeignKey<ConfiguracoesUsuario>(configuracao => configuracao.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private void ConfigureTenantFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (!typeof(IMustHaveTenant).IsAssignableFrom(entityType.ClrType))
            {
                continue;
            }

            var parameter = Expression.Parameter(entityType.ClrType, "entity");
            var contextTenant = Expression.Property(Expression.Constant(this), nameof(TenantId));
            var tenantHasValue = Expression.Property(contextTenant, nameof(Nullable<Guid>.HasValue));
            var tenantValue = Expression.Property(contextTenant, nameof(Nullable<Guid>.Value));
            var tenantProperty = Expression.Property(parameter, nameof(IMustHaveTenant.UsuarioId));
            var sameTenant = Expression.Equal(tenantProperty, tenantValue);
            var filter = Expression.AndAlso(tenantHasValue, sameTenant);
            var lambda = Expression.Lambda(filter, parameter);

            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(lambda);
        }

        modelBuilder.Entity<Categoria>()
            .HasQueryFilter(categoria => categoria.UsuarioId == null || categoria.UsuarioId == TenantId);
    }
}
