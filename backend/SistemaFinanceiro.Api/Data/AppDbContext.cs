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
    public DbSet<ContaBancaria> ContasBancarias => Set<ContaBancaria>();
    public DbSet<CompraParcelada> ComprasParceladas => Set<CompraParcelada>();
    public DbSet<Transacao> Transacoes => Set<Transacao>();
    public DbSet<TransacaoFixaExcecao> TransacoesFixasExcecoes => Set<TransacaoFixaExcecao>();
    public DbSet<TransacaoFixaPagamento> TransacoesFixasPagamentos => Set<TransacaoFixaPagamento>();
    public DbSet<FaturaCartaoPagamento> FaturasCartaoPagamentos => Set<FaturaCartaoPagamento>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Notificacao> Notificacoes => Set<Notificacao>();
    public DbSet<ConfiguracoesUsuario> ConfiguracoesUsuarios => Set<ConfiguracoesUsuario>();
    public DbSet<FechamentoMensalSaldo> FechamentosMensaisSaldo => Set<FechamentoMensalSaldo>();
    public DbSet<FechamentoMensalConta> FechamentosMensaisConta => Set<FechamentoMensalConta>();
    public DbSet<DivisaoTransacao> DivisoesTransacoes => Set<DivisaoTransacao>();
    public DbSet<DivisaoTransacaoParticipante> DivisoesTransacoesParticipantes => Set<DivisaoTransacaoParticipante>();
    public DbSet<DivisaoTransacaoVersao> DivisoesTransacoesVersoes => Set<DivisaoTransacaoVersao>();
    public DbSet<DivisaoTransacaoVersaoParticipante> DivisoesTransacoesVersoesParticipantes =>
        Set<DivisaoTransacaoVersaoParticipante>();
    public DbSet<ReembolsoDivisao> ReembolsosDivisao => Set<ReembolsoDivisao>();
    public DbSet<ContatoDivisao> ContatosDivisao => Set<ContatoDivisao>();
    public DbSet<ContatoEmprestimo> ContatosEmprestimos => Set<ContatoEmprestimo>();
    public DbSet<Emprestimo> Emprestimos => Set<Emprestimo>();
    public DbSet<ParcelaEmprestimo> ParcelasEmprestimos => Set<ParcelaEmprestimo>();
    public DbSet<PagamentoEmprestimo> PagamentosEmprestimos => Set<PagamentoEmprestimo>();
    public DbSet<AlteracaoRecorrenciaEmprestimo> AlteracoesRecorrenciasEmprestimos => Set<AlteracaoRecorrenciaEmprestimo>();

    public Guid? TenantId => _tenantProvider.UsuarioId;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        ConfigureUsuario(modelBuilder);
        ConfigureCategoria(modelBuilder);
        ConfigureCartaoCredito(modelBuilder);
        ConfigureContaBancaria(modelBuilder);
        ConfigureCompraParcelada(modelBuilder);
        ConfigureTransacao(modelBuilder);
        ConfigureTransacaoFixaExcecao(modelBuilder);
        ConfigureTransacaoFixaPagamento(modelBuilder);
        ConfigureFaturaCartaoPagamento(modelBuilder);
        ConfigureRefreshToken(modelBuilder);
        ConfigureNotificacao(modelBuilder);
        ConfigureConfiguracoesUsuario(modelBuilder);
        ConfigureFechamentoMensalSaldo(modelBuilder);
        ConfigureFechamentoMensalConta(modelBuilder);
        ConfigureDivisaoTransacao(modelBuilder);
        ConfigureDivisaoTransacaoParticipante(modelBuilder);
        ConfigureDivisaoTransacaoVersao(modelBuilder);
        ConfigureDivisaoTransacaoVersaoParticipante(modelBuilder);
        ConfigureReembolsoDivisao(modelBuilder);
        ConfigureContatoDivisao(modelBuilder);
        ConfigureContatoEmprestimo(modelBuilder);
        ConfigureEmprestimo(modelBuilder);
        ConfigurePagamentoEmprestimo(modelBuilder);
        ConfigureParcelaEmprestimo(modelBuilder);
        ConfigureAlteracaoRecorrenciaEmprestimo(modelBuilder);
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

            entity.Property(cartao => cartao.ContaBancariaId)
                .HasColumnName("id_conta_bancaria");

            entity.Property(cartao => cartao.IsArquivado)
                .HasColumnName("is_arquivado")
                .HasDefaultValue(false)
                .IsRequired();

            entity.HasOne(cartao => cartao.Usuario)
                .WithMany(usuario => usuario.CartoesCredito)
                .HasForeignKey(cartao => cartao.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(cartao => cartao.ContaBancaria)
                .WithMany()
                .HasForeignKey(cartao => cartao.ContaBancariaId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(cartao => cartao.ContaBancariaId);
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

            entity.Property(compra => compra.IsDividida)
                .HasColumnName("is_dividida")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(compra => compra.ValorTotalOriginal)
                .HasColumnName("valor_total_original")
                .HasPrecision(18, 2);

            entity.Property(compra => compra.PercentualDivisao)
                .HasColumnName("percentual_divisao")
                .HasPrecision(5, 2);

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

    private static void ConfigureContaBancaria(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ContaBancaria>(entity =>
        {
            entity.ToTable("contas_bancarias");

            entity.HasKey(conta => conta.Id);

            entity.Property(conta => conta.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(conta => conta.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(conta => conta.NomeCustomizado)
                .HasColumnName("nome_customizado")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(conta => conta.CodigoBanco)
                .HasColumnName("codigo_banco")
                .HasMaxLength(3)
                .IsFixedLength()
                .IsRequired();

            entity.Property(conta => conta.SaldoInicial)
                .HasColumnName("saldo_inicial")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(conta => conta.IsFavorita)
                .HasColumnName("is_favorita")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(conta => conta.IsArquivada)
                .HasColumnName("is_arquivada")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(conta => conta.DataCriacao)
                .HasColumnName("data_criacao")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.HasOne(conta => conta.Usuario)
                .WithMany(usuario => usuario.ContasBancarias)
                .HasForeignKey(conta => conta.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(conta => conta.UsuarioId);
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

            entity.Property(transacao => transacao.ContaBancariaId)
                .HasColumnName("id_conta_bancaria");

            entity.Property(transacao => transacao.IsFixa)
                .HasColumnName("is_fixa")
                .IsRequired();

            entity.Property(transacao => transacao.IsPaga)
                .HasColumnName("is_paga")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(transacao => transacao.IsDividida)
                .HasColumnName("is_dividida")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(transacao => transacao.ValorTotalOriginal)
                .HasColumnName("valor_total_original")
                .HasPrecision(18, 2);

            entity.Property(transacao => transacao.PercentualDivisao)
                .HasColumnName("percentual_divisao")
                .HasPrecision(5, 2);

            entity.Property(transacao => transacao.OrigemTransacao)
                .HasColumnName("origem_transacao")
                .HasConversion<string>()
                .HasMaxLength(40)
                .HasDefaultValue(OrigemTransacao.Lancamento)
                .IsRequired();

            entity.Property(transacao => transacao.TransferenciaId)
                .HasColumnName("id_transferencia");

            entity.Property(transacao => transacao.SaldoAnteriorAjuste)
                .HasColumnName("saldo_anterior_ajuste")
                .HasPrecision(18, 2);

            entity.Property(transacao => transacao.SaldoInformadoAjuste)
                .HasColumnName("saldo_informado_ajuste")
                .HasPrecision(18, 2);

            entity.Property(transacao => transacao.Observacao)
                .HasColumnName("observacao")
                .HasMaxLength(500);

            entity.Property(transacao => transacao.CompraParceladaId)
                .HasColumnName("id_compra_parcelada");

            entity.Property(transacao => transacao.NumeroParcelaQuitada)
                .HasColumnName("numero_parcela_quitada");

            entity.Property(transacao => transacao.ReembolsoDivisaoId)
                .HasColumnName("id_reembolso_divisao");

            entity.Property(transacao => transacao.EmprestimoId)
                .HasColumnName("id_emprestimo");

            entity.Property(transacao => transacao.ParcelaEmprestimoId)
                .HasColumnName("id_parcela_emprestimo");

            entity.Property(transacao => transacao.PagamentoEmprestimoId)
                .HasColumnName("id_pagamento_emprestimo");

            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.CodigoExibicao })
                .IsUnique();
            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.DataOcorrencia });
            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.IsPaga, transacao.DataOcorrencia });
            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.Tipo, transacao.DataOcorrencia });
            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.CategoriaId, transacao.DataOcorrencia });
            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.CartaoCreditoId, transacao.DataOcorrencia });
            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.ContaBancariaId, transacao.DataOcorrencia });
            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.CompraParceladaId, transacao.NumeroParcelaQuitada });
            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.OrigemTransacao, transacao.DataOcorrencia });
            entity.HasIndex(transacao => new { transacao.UsuarioId, transacao.TransferenciaId });
            entity.HasIndex(transacao => transacao.ReembolsoDivisaoId);
            entity.HasIndex(transacao => transacao.EmprestimoId);
            entity.HasIndex(transacao => transacao.ParcelaEmprestimoId)
                .IsUnique()
                .HasFilter("id_parcela_emprestimo IS NOT NULL");
            entity.HasIndex(transacao => transacao.PagamentoEmprestimoId)
                .IsUnique()
                .HasFilter("id_pagamento_emprestimo IS NOT NULL");

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

            entity.HasOne(transacao => transacao.ContaBancaria)
                .WithMany(conta => conta.Transacoes)
                .HasForeignKey(transacao => transacao.ContaBancariaId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(transacao => transacao.CompraParcelada)
                .WithMany(compra => compra.TransacoesQuitacao)
                .HasForeignKey(transacao => transacao.CompraParceladaId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(transacao => transacao.ReembolsoDivisao)
                .WithMany(reembolso => reembolso.TransacoesReembolso)
                .HasForeignKey(transacao => transacao.ReembolsoDivisaoId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(transacao => transacao.Emprestimo)
                .WithMany(emprestimo => emprestimo.LancamentosFinanceiros)
                .HasForeignKey(transacao => transacao.EmprestimoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(transacao => transacao.ParcelaEmprestimo)
                .WithOne(parcela => parcela.LancamentoFinanceiro)
                .HasForeignKey<Transacao>(transacao => transacao.ParcelaEmprestimoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(transacao => transacao.PagamentoEmprestimo)
                .WithOne(pagamento => pagamento.LancamentoFinanceiro)
                .HasForeignKey<Transacao>(transacao => transacao.PagamentoEmprestimoId)
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

            entity.Property(refreshToken => refreshToken.SessaoExpiraEm)
                .HasColumnName("sessao_expira_em")
                .IsRequired();

            entity.Property(refreshToken => refreshToken.UltimaAtividadeEm)
                .HasColumnName("ultima_atividade_em")
                .IsRequired();

            entity.Property(refreshToken => refreshToken.CriadoEm)
                .HasColumnName("criado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.Property(refreshToken => refreshToken.RevogadoEm)
                .HasColumnName("revogado_em");

            entity.Property(refreshToken => refreshToken.ReutilizadoEm)
                .HasColumnName("reutilizado_em");

            entity.Ignore(refreshToken => refreshToken.EstaAtivo);

            entity.HasOne(refreshToken => refreshToken.Usuario)
                .WithMany(usuario => usuario.RefreshTokens)
                .HasForeignKey(refreshToken => refreshToken.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureTransacaoFixaExcecao(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TransacaoFixaExcecao>(entity =>
        {
            entity.ToTable("transacoes_fixas_excecoes");

            entity.HasKey(excecao => excecao.Id);

            entity.Property(excecao => excecao.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(excecao => excecao.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(excecao => excecao.TransacaoFixaId)
                .HasColumnName("id_transacao_fixa")
                .IsRequired();

            entity.Property(excecao => excecao.DataOcorrencia)
                .HasColumnName("data_ocorrencia")
                .IsRequired();

            entity.HasOne(excecao => excecao.Usuario)
                .WithMany()
                .HasForeignKey(excecao => excecao.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(excecao => excecao.TransacaoFixa)
                .WithMany()
                .HasForeignKey(excecao => excecao.TransacaoFixaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(excecao => new
            {
                excecao.UsuarioId,
                excecao.TransacaoFixaId,
                excecao.DataOcorrencia
            }).IsUnique();
        });
    }

    private static void ConfigureTransacaoFixaPagamento(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TransacaoFixaPagamento>(entity =>
        {
            entity.ToTable("transacoes_fixas_pagamentos");

            entity.HasKey(pagamento => pagamento.Id);

            entity.Property(pagamento => pagamento.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(pagamento => pagamento.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(pagamento => pagamento.TransacaoFixaId)
                .HasColumnName("id_transacao_fixa")
                .IsRequired();

            entity.Property(pagamento => pagamento.DataOcorrencia)
                .HasColumnName("data_ocorrencia")
                .IsRequired();

            entity.Property(pagamento => pagamento.IsPaga)
                .HasColumnName("is_paga")
                .HasDefaultValue(false)
                .IsRequired();

            entity.HasOne(pagamento => pagamento.Usuario)
                .WithMany()
                .HasForeignKey(pagamento => pagamento.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(pagamento => pagamento.TransacaoFixa)
                .WithMany()
                .HasForeignKey(pagamento => pagamento.TransacaoFixaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(pagamento => new
            {
                pagamento.UsuarioId,
                pagamento.TransacaoFixaId,
                pagamento.DataOcorrencia
            }).IsUnique();
        });
    }

    private static void ConfigureFaturaCartaoPagamento(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<FaturaCartaoPagamento>(entity =>
        {
            entity.ToTable("faturas_cartao_pagamentos");

            entity.HasKey(fatura => fatura.Id);

            entity.Property(fatura => fatura.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(fatura => fatura.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(fatura => fatura.CartaoCreditoId)
                .HasColumnName("id_cartao_credito")
                .IsRequired();

            entity.Property(fatura => fatura.DataVencimento)
                .HasColumnName("data_vencimento")
                .IsRequired();

            entity.Property(fatura => fatura.IsPaga)
                .HasColumnName("is_paga")
                .HasDefaultValue(false)
                .IsRequired();

            entity.HasOne(fatura => fatura.Usuario)
                .WithMany(usuario => usuario.FaturasCartaoPagamentos)
                .HasForeignKey(fatura => fatura.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(fatura => fatura.CartaoCredito)
                .WithMany(cartao => cartao.FaturasPagamentos)
                .HasForeignKey(fatura => fatura.CartaoCreditoId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(fatura => new
            {
                fatura.UsuarioId,
                fatura.CartaoCreditoId,
                fatura.DataVencimento
            }).IsUnique();
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

            entity.Property(notificacao => notificacao.Entidade)
                .HasColumnName("entidade")
                .HasMaxLength(60);

            entity.Property(notificacao => notificacao.EntidadeId)
                .HasColumnName("entidade_id");

            entity.Property(notificacao => notificacao.ParticipanteDivisaoId)
                .HasColumnName("id_participante_divisao");

            entity.Property(notificacao => notificacao.Rota)
                .HasColumnName("rota")
                .HasMaxLength(240);

            entity.Property(notificacao => notificacao.AcaoPendente)
                .HasColumnName("acao_pendente")
                .HasMaxLength(60);

            entity.Property(notificacao => notificacao.Versao)
                .HasColumnName("versao");

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
            entity.HasIndex(notificacao => new
            {
                notificacao.UsuarioId,
                notificacao.Entidade,
                notificacao.EntidadeId,
                notificacao.TipoNotificacao,
                notificacao.Versao,
                notificacao.ParticipanteDivisaoId
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

            entity.Property(configuracao => configuracao.PercentualPadraoDivisao)
                .HasColumnName("percentual_padrao_divisao")
                .HasPrecision(5, 2)
                .HasDefaultValue(50m)
                .IsRequired();

            entity.HasOne(configuracao => configuracao.Usuario)
                .WithOne(usuario => usuario.Configuracoes)
                .HasForeignKey<ConfiguracoesUsuario>(configuracao => configuracao.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureFechamentoMensalSaldo(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<FechamentoMensalSaldo>(entity =>
        {
            entity.ToTable("fechamentos_mensais_saldo");

            entity.HasKey(fechamento => fechamento.Id);

            entity.Property(fechamento => fechamento.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(fechamento => fechamento.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(fechamento => fechamento.Ano)
                .HasColumnName("ano")
                .IsRequired();

            entity.Property(fechamento => fechamento.Mes)
                .HasColumnName("mes")
                .IsRequired();

            entity.Property(fechamento => fechamento.DataFechamento)
                .HasColumnName("data_fechamento")
                .IsRequired();

            entity.Property(fechamento => fechamento.SaldoGlobal)
                .HasColumnName("saldo_global")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(fechamento => fechamento.DataCriacao)
                .HasColumnName("data_criacao")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.Property(fechamento => fechamento.DataAtualizacao)
                .HasColumnName("data_atualizacao")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.Property(fechamento => fechamento.VersaoRegra)
                .HasColumnName("versao_regra")
                .HasMaxLength(40)
                .IsRequired();

            entity.Property(fechamento => fechamento.Status)
                .HasColumnName("status")
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(fechamento => fechamento.Observacao)
                .HasColumnName("observacao")
                .HasMaxLength(500);

            entity.HasOne(fechamento => fechamento.Usuario)
                .WithMany()
                .HasForeignKey(fechamento => fechamento.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(fechamento => new { fechamento.UsuarioId, fechamento.Ano, fechamento.Mes })
                .IsUnique();
        });
    }

    private static void ConfigureFechamentoMensalConta(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<FechamentoMensalConta>(entity =>
        {
            entity.ToTable("fechamentos_mensais_conta");

            entity.HasKey(fechamento => fechamento.Id);

            entity.Property(fechamento => fechamento.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(fechamento => fechamento.FechamentoMensalSaldoId)
                .HasColumnName("id_fechamento_mensal_saldo")
                .IsRequired();

            entity.Property(fechamento => fechamento.ContaBancariaId)
                .HasColumnName("id_conta_bancaria")
                .IsRequired();

            entity.Property(fechamento => fechamento.Saldo)
                .HasColumnName("saldo")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.HasOne(fechamento => fechamento.FechamentoMensalSaldo)
                .WithMany(fechamento => fechamento.Contas)
                .HasForeignKey(fechamento => fechamento.FechamentoMensalSaldoId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(fechamento => fechamento.ContaBancaria)
                .WithMany()
                .HasForeignKey(fechamento => fechamento.ContaBancariaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(fechamento => new { fechamento.FechamentoMensalSaldoId, fechamento.ContaBancariaId })
                .IsUnique();
        });
    }

    private static void ConfigureDivisaoTransacao(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DivisaoTransacao>(entity =>
        {
            entity.ToTable("divisoes_transacoes");

            entity.HasKey(divisao => divisao.Id);

            entity.Property(divisao => divisao.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(divisao => divisao.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(divisao => divisao.UsuarioCriadorId)
                .HasColumnName("id_usuario_criador")
                .IsRequired();

            entity.Property(divisao => divisao.TransacaoOrigemId)
                .HasColumnName("id_transacao_origem");

            entity.Property(divisao => divisao.CompraParceladaId)
                .HasColumnName("id_compra_parcelada");

            entity.Property(divisao => divisao.SerieId)
                .HasColumnName("id_serie");

            entity.Property(divisao => divisao.ValorTotal)
                .HasColumnName("valor_total")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(divisao => divisao.Status)
                .HasColumnName("status")
                .HasConversion<string>()
                .HasMaxLength(40)
                .IsRequired();

            entity.Property(divisao => divisao.VersaoAtual)
                .HasColumnName("versao_atual")
                .HasDefaultValue(1)
                .IsRequired();

            entity.Property(divisao => divisao.QuantidadeReenvios)
                .HasColumnName("quantidade_reenvios")
                .HasDefaultValue(0)
                .IsRequired();

            entity.Property(divisao => divisao.CriadoEm)
                .HasColumnName("criado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.Property(divisao => divisao.AtualizadoEm)
                .HasColumnName("atualizado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.Property(divisao => divisao.EncerradoEm)
                .HasColumnName("encerrado_em");

            entity.HasOne(divisao => divisao.UsuarioCriador)
                .WithMany()
                .HasForeignKey(divisao => divisao.UsuarioCriadorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(divisao => divisao.TransacaoOrigem)
                .WithMany()
                .HasForeignKey(divisao => divisao.TransacaoOrigemId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(divisao => divisao.CompraParcelada)
                .WithMany()
                .HasForeignKey(divisao => divisao.CompraParceladaId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(divisao => divisao.UsuarioId);
            entity.HasIndex(divisao => divisao.UsuarioCriadorId);
            entity.HasIndex(divisao => divisao.TransacaoOrigemId);
            entity.HasIndex(divisao => divisao.CompraParceladaId);
            entity.HasIndex(divisao => divisao.SerieId);
        });
    }

    private static void ConfigureDivisaoTransacaoParticipante(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DivisaoTransacaoParticipante>(entity =>
        {
            entity.ToTable("divisoes_transacoes_participantes");

            entity.HasKey(participante => participante.Id);

            entity.Property(participante => participante.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(participante => participante.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(participante => participante.DivisaoTransacaoId)
                .HasColumnName("id_divisao_transacao")
                .IsRequired();

            entity.Property(participante => participante.ParticipanteUsuarioId)
                .HasColumnName("id_usuario_participante");

            entity.Property(participante => participante.TipoParticipante)
                .HasColumnName("tipo_participante")
                .HasConversion<string>()
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(participante => participante.Percentual)
                .HasColumnName("percentual")
                .HasPrecision(5, 2)
                .IsRequired();

            entity.Property(participante => participante.Valor)
                .HasColumnName("valor")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(participante => participante.ModoDefinicao)
                .HasColumnName("modo_definicao")
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValue(ModoDefinicaoParticipacaoDivisao.Percentual)
                .IsRequired();

            entity.Property(participante => participante.Status)
                .HasColumnName("status")
                .HasConversion<string>()
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(participante => participante.ExpiraEm)
                .HasColumnName("expira_em");

            entity.Property(participante => participante.TransacaoGeradaId)
                .HasColumnName("id_transacao_gerada");

            entity.Property(participante => participante.CompraParceladaGeradaId)
                .HasColumnName("id_compra_parcelada_gerada");

            entity.Property(participante => participante.RespondidoEm)
                .HasColumnName("respondido_em");

            entity.Property(participante => participante.VersaoAceita)
                .HasColumnName("versao_aceita");

            entity.Property(participante => participante.VersaoConvite)
                .HasColumnName("versao_convite")
                .HasDefaultValue(1)
                .IsRequired();

            entity.Property(participante => participante.MotivoResposta)
                .HasColumnName("motivo_resposta")
                .HasMaxLength(500);

            entity.Property(participante => participante.Ativo)
                .HasColumnName("ativo")
                .HasDefaultValue(true)
                .IsRequired();

            entity.HasOne(participante => participante.DivisaoTransacao)
                .WithMany(divisao => divisao.Participantes)
                .HasForeignKey(participante => participante.DivisaoTransacaoId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(participante => participante.ParticipanteUsuario)
                .WithMany()
                .HasForeignKey(participante => participante.ParticipanteUsuarioId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(participante => participante.TransacaoGerada)
                .WithMany()
                .HasForeignKey(participante => participante.TransacaoGeradaId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(participante => participante.CompraParceladaGerada)
                .WithMany()
                .HasForeignKey(participante => participante.CompraParceladaGeradaId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(participante => participante.UsuarioId);
            entity.HasIndex(participante => participante.DivisaoTransacaoId);
            entity.HasIndex(participante => participante.ParticipanteUsuarioId);
            entity.HasIndex(participante => participante.TransacaoGeradaId);
            entity.HasIndex(participante => participante.CompraParceladaGeradaId);
            entity.HasIndex(participante => new { participante.DivisaoTransacaoId, participante.TipoParticipante })
                .IsUnique()
                .HasFilter("tipo_participante = 'Criador' AND ativo = true");
            entity.HasIndex(participante => new { participante.DivisaoTransacaoId, participante.ParticipanteUsuarioId })
                .IsUnique()
                .HasFilter("id_usuario_participante IS NOT NULL AND ativo = true");
        });
    }

    private static void ConfigureContatoDivisao(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ContatoDivisao>(entity =>
        {
            entity.ToTable("contatos_divisao");

            entity.HasKey(contato => contato.Id);

            entity.Property(contato => contato.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(contato => contato.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(contato => contato.UsuarioContatoId)
                .HasColumnName("id_usuario_contato")
                .IsRequired();

            entity.Property(contato => contato.Apelido)
                .HasColumnName("apelido")
                .HasMaxLength(120);

            entity.Property(contato => contato.UltimoUsoEm)
                .HasColumnName("ultimo_uso_em");

            entity.Property(contato => contato.CriadoEm)
                .HasColumnName("criado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.Property(contato => contato.Ativo)
                .HasColumnName("ativo")
                .HasDefaultValue(true)
                .IsRequired();

            entity.HasOne(contato => contato.UsuarioProprietario)
                .WithMany()
                .HasForeignKey(contato => contato.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(contato => contato.UsuarioContato)
                .WithMany()
                .HasForeignKey(contato => contato.UsuarioContatoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(contato => contato.UsuarioId);
            entity.HasIndex(contato => contato.UsuarioContatoId);
            entity.HasIndex(contato => new { contato.UsuarioId, contato.UsuarioContatoId })
                .IsUnique();
        });
    }

    private static void ConfigureDivisaoTransacaoVersao(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DivisaoTransacaoVersao>(entity =>
        {
            entity.ToTable("divisoes_transacoes_versoes");

            entity.HasKey(versao => versao.Id);

            entity.Property(versao => versao.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(versao => versao.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(versao => versao.DivisaoTransacaoId)
                .HasColumnName("id_divisao_transacao")
                .IsRequired();

            entity.Property(versao => versao.Versao)
                .HasColumnName("versao")
                .IsRequired();

            entity.Property(versao => versao.Status)
                .HasColumnName("status")
                .HasConversion<string>()
                .HasMaxLength(40)
                .IsRequired();

            entity.Property(versao => versao.Escopo)
                .HasColumnName("escopo")
                .HasMaxLength(40)
                .IsRequired();

            entity.Property(versao => versao.UsuarioSolicitanteId)
                .HasColumnName("id_usuario_solicitante")
                .IsRequired();

            entity.Property(versao => versao.UsuarioRespondenteId)
                .HasColumnName("id_usuario_respondente");

            entity.Property(versao => versao.ValorTotalAnterior)
                .HasColumnName("valor_total_anterior")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(versao => versao.ValorTotalProposto)
                .HasColumnName("valor_total_proposto")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(versao => versao.PercentualCriadorAnterior)
                .HasColumnName("percentual_criador_anterior")
                .HasPrecision(5, 2)
                .IsRequired();

            entity.Property(versao => versao.PercentualCriadorProposto)
                .HasColumnName("percentual_criador_proposto")
                .HasPrecision(5, 2)
                .IsRequired();

            entity.Property(versao => versao.ValorCriadorAnterior)
                .HasColumnName("valor_criador_anterior")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(versao => versao.ValorCriadorProposto)
                .HasColumnName("valor_criador_proposto")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(versao => versao.PercentualParticipanteAnterior)
                .HasColumnName("percentual_participante_anterior")
                .HasPrecision(5, 2)
                .IsRequired();

            entity.Property(versao => versao.PercentualParticipanteProposto)
                .HasColumnName("percentual_participante_proposto")
                .HasPrecision(5, 2)
                .IsRequired();

            entity.Property(versao => versao.ValorParticipanteAnterior)
                .HasColumnName("valor_participante_anterior")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(versao => versao.ValorParticipanteProposto)
                .HasColumnName("valor_participante_proposto")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(versao => versao.VencimentoAnterior)
                .HasColumnName("vencimento_anterior");

            entity.Property(versao => versao.VencimentoProposto)
                .HasColumnName("vencimento_proposto");

            entity.Property(versao => versao.QuantidadeParcelasAnterior)
                .HasColumnName("quantidade_parcelas_anterior");

            entity.Property(versao => versao.QuantidadeParcelasProposta)
                .HasColumnName("quantidade_parcelas_proposta");

            entity.Property(versao => versao.RecorrenciaAnterior)
                .HasColumnName("recorrencia_anterior")
                .HasMaxLength(40);

            entity.Property(versao => versao.RecorrenciaProposta)
                .HasColumnName("recorrencia_proposta")
                .HasMaxLength(40);

            entity.Property(versao => versao.FrequenciaAnterior)
                .HasColumnName("frequencia_anterior")
                .HasMaxLength(40);

            entity.Property(versao => versao.FrequenciaProposta)
                .HasColumnName("frequencia_proposta")
                .HasMaxLength(40);

            entity.Property(versao => versao.ResponsabilidadeAnterior)
                .HasColumnName("responsabilidade_anterior")
                .HasMaxLength(80);

            entity.Property(versao => versao.ResponsabilidadeProposta)
                .HasColumnName("responsabilidade_proposta")
                .HasMaxLength(80);

            entity.Property(versao => versao.CriadoEm)
                .HasColumnName("criado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.Property(versao => versao.RespondidoEm)
                .HasColumnName("respondido_em");

            entity.Property(versao => versao.MotivoResposta)
                .HasColumnName("motivo_resposta")
                .HasMaxLength(500);

            entity.HasOne(versao => versao.DivisaoTransacao)
                .WithMany(divisao => divisao.Versoes)
                .HasForeignKey(versao => versao.DivisaoTransacaoId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(versao => versao.UsuarioId);
            entity.HasIndex(versao => versao.DivisaoTransacaoId);
            entity.HasIndex(versao => new { versao.DivisaoTransacaoId, versao.Versao })
                .IsUnique();
        });
    }

    private static void ConfigureReembolsoDivisao(ModelBuilder modelBuilder)
    {
        ConfigureReembolsoDivisaoEntity(modelBuilder);
    }

    private static void ConfigureDivisaoTransacaoVersaoParticipante(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DivisaoTransacaoVersaoParticipante>(entity =>
        {
            entity.ToTable("divisoes_transacoes_versoes_participantes");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(item => item.UsuarioId).HasColumnName("id_usuario").IsRequired();
            entity.Property(item => item.DivisaoTransacaoVersaoId)
                .HasColumnName("id_divisao_transacao_versao").IsRequired();
            entity.Property(item => item.DivisaoTransacaoParticipanteId)
                .HasColumnName("id_divisao_transacao_participante").IsRequired();
            entity.Property(item => item.PercentualAnterior)
                .HasColumnName("percentual_anterior").HasPrecision(5, 2).IsRequired();
            entity.Property(item => item.PercentualProposto)
                .HasColumnName("percentual_proposto").HasPrecision(5, 2).IsRequired();
            entity.Property(item => item.ValorAnterior)
                .HasColumnName("valor_anterior").HasPrecision(18, 2).IsRequired();
            entity.Property(item => item.ValorProposto)
                .HasColumnName("valor_proposto").HasPrecision(18, 2).IsRequired();
            entity.Property(item => item.Status)
                .HasColumnName("status").HasConversion<string>().HasMaxLength(30).IsRequired();
            entity.Property(item => item.RespondidoEm).HasColumnName("respondido_em");
            entity.Property(item => item.MotivoResposta)
                .HasColumnName("motivo_resposta").HasMaxLength(500);

            entity.HasOne(item => item.DivisaoTransacaoVersao)
                .WithMany(versao => versao.Participantes)
                .HasForeignKey(item => item.DivisaoTransacaoVersaoId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(item => item.DivisaoTransacaoParticipante)
                .WithMany(participante => participante.Alteracoes)
                .HasForeignKey(item => item.DivisaoTransacaoParticipanteId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(item => item.UsuarioId);
            entity.HasIndex(item => item.DivisaoTransacaoParticipanteId);
            entity.HasIndex(item => new
            {
                item.DivisaoTransacaoVersaoId,
                item.DivisaoTransacaoParticipanteId
            }).IsUnique();
        });
    }

    private static void ConfigureReembolsoDivisaoEntity(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ReembolsoDivisao>(entity =>
        {
            entity.ToTable("reembolsos_divisao");

            entity.HasKey(reembolso => reembolso.Id);

            entity.Property(reembolso => reembolso.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(reembolso => reembolso.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();

            entity.Property(reembolso => reembolso.DivisaoTransacaoId)
                .HasColumnName("id_divisao_transacao")
                .IsRequired();

            entity.Property(reembolso => reembolso.ParticipanteId)
                .HasColumnName("id_participante");

            entity.Property(reembolso => reembolso.ParticipanteUsuarioId)
                .HasColumnName("id_usuario_participante");

            entity.Property(reembolso => reembolso.ParticipanteExternoNome)
                .HasColumnName("participante_externo_nome")
                .HasMaxLength(160);

            entity.Property(reembolso => reembolso.ValorDevido)
                .HasColumnName("valor_devido")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(reembolso => reembolso.ValorRecebido)
                .HasColumnName("valor_recebido")
                .HasPrecision(18, 2)
                .IsRequired();

            entity.Property(reembolso => reembolso.Status)
                .HasColumnName("status")
                .HasConversion<string>()
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(reembolso => reembolso.CriadoEm)
                .HasColumnName("criado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.Property(reembolso => reembolso.AtualizadoEm)
                .HasColumnName("atualizado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.HasOne(reembolso => reembolso.DivisaoTransacao)
                .WithMany()
                .HasForeignKey(reembolso => reembolso.DivisaoTransacaoId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(reembolso => reembolso.Participante)
                .WithMany()
                .HasForeignKey(reembolso => reembolso.ParticipanteId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(reembolso => reembolso.ParticipanteUsuario)
                .WithMany()
                .HasForeignKey(reembolso => reembolso.ParticipanteUsuarioId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(reembolso => reembolso.UsuarioId);
            entity.HasIndex(reembolso => reembolso.DivisaoTransacaoId);
            entity.HasIndex(reembolso => reembolso.ParticipanteId);
            entity.HasIndex(reembolso => reembolso.ParticipanteUsuarioId);
        });
    }

    private static void ConfigureContatoEmprestimo(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ContatoEmprestimo>(entity =>
        {
            entity.ToTable("contatos_emprestimos");
            entity.HasKey(contato => contato.Id);

            entity.Property(contato => contato.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();
            entity.Property(contato => contato.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();
            entity.Property(contato => contato.Nome)
                .HasColumnName("nome")
                .HasMaxLength(160)
                .IsRequired();
            entity.Property(contato => contato.Observacao)
                .HasColumnName("observacao")
                .HasMaxLength(500);
            entity.Property(contato => contato.Ativo)
                .HasColumnName("ativo")
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(contato => contato.CriadoEm)
                .HasColumnName("criado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();
            entity.Property(contato => contato.AtualizadoEm)
                .HasColumnName("atualizado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.HasOne(contato => contato.Usuario)
                .WithMany()
                .HasForeignKey(contato => contato.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(contato => contato.UsuarioId);
        });
    }

    private static void ConfigureEmprestimo(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Emprestimo>(entity =>
        {
            entity.ToTable("emprestimos");
            entity.HasKey(emprestimo => emprestimo.Id);

            entity.Property(emprestimo => emprestimo.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();
            entity.Property(emprestimo => emprestimo.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();
            entity.Property(emprestimo => emprestimo.ContatoId)
                .HasColumnName("id_contato")
                .IsRequired();
            entity.Property(emprestimo => emprestimo.Descricao)
                .HasColumnName("descricao")
                .HasMaxLength(180)
                .IsRequired();
            entity.Property(emprestimo => emprestimo.ValorTotal)
                .HasColumnName("valor_total")
                .HasPrecision(18, 2)
                .IsRequired();
            entity.Property(emprestimo => emprestimo.Data)
                .HasColumnName("data")
                .IsRequired();
            entity.Property(emprestimo => emprestimo.Tipo)
                .HasColumnName("tipo")
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(emprestimo => emprestimo.DataFimRecorrencia)
                .HasColumnName("data_fim_recorrencia");
            entity.Property(emprestimo => emprestimo.RecorrenciaAtiva)
                .HasColumnName("recorrencia_ativa")
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(emprestimo => emprestimo.OrigemFinanceira)
                .HasColumnName("origem_financeira")
                .HasConversion<string>()
                .HasMaxLength(30)
                .IsRequired();
            entity.Property(emprestimo => emprestimo.CartaoCreditoId)
                .HasColumnName("id_cartao_credito");
            entity.Property(emprestimo => emprestimo.ContaBancariaId)
                .HasColumnName("id_conta_bancaria");
            entity.Property(emprestimo => emprestimo.QuantidadeParcelas)
                .HasColumnName("quantidade_parcelas")
                .IsRequired();
            entity.Property(emprestimo => emprestimo.Observacao)
                .HasColumnName("observacao")
                .HasMaxLength(500);
            entity.Property(emprestimo => emprestimo.Status)
                .HasColumnName("status")
                .HasConversion<string>()
                .HasMaxLength(30)
                .IsRequired();
            entity.Property(emprestimo => emprestimo.IsArquivado)
                .HasColumnName("is_arquivado")
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(emprestimo => emprestimo.CriadoEm)
                .HasColumnName("criado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();
            entity.Property(emprestimo => emprestimo.AtualizadoEm)
                .HasColumnName("atualizado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.HasOne(emprestimo => emprestimo.Usuario)
                .WithMany()
                .HasForeignKey(emprestimo => emprestimo.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(emprestimo => emprestimo.Contato)
                .WithMany(contato => contato.Emprestimos)
                .HasForeignKey(emprestimo => emprestimo.ContatoId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(emprestimo => emprestimo.CartaoCredito)
                .WithMany()
                .HasForeignKey(emprestimo => emprestimo.CartaoCreditoId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(emprestimo => emprestimo.ContaBancaria)
                .WithMany()
                .HasForeignKey(emprestimo => emprestimo.ContaBancariaId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(emprestimo => emprestimo.UsuarioId);
            entity.HasIndex(emprestimo => emprestimo.ContatoId);
            entity.HasIndex(emprestimo => emprestimo.Status);
            entity.HasIndex(emprestimo => new { emprestimo.UsuarioId, emprestimo.IsArquivado });
            entity.HasIndex(emprestimo => emprestimo.CartaoCreditoId);
            entity.HasIndex(emprestimo => emprestimo.ContaBancariaId);
            entity.HasIndex(emprestimo => new { emprestimo.UsuarioId, emprestimo.Tipo, emprestimo.RecorrenciaAtiva });
        });
    }

    private static void ConfigurePagamentoEmprestimo(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PagamentoEmprestimo>(entity =>
        {
            entity.ToTable("pagamentos_emprestimos");
            entity.HasKey(pagamento => pagamento.Id);

            entity.Property(pagamento => pagamento.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();
            entity.Property(pagamento => pagamento.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();
            entity.Property(pagamento => pagamento.EmprestimoId)
                .HasColumnName("id_emprestimo")
                .IsRequired();
            entity.Property(pagamento => pagamento.Data)
                .HasColumnName("data")
                .IsRequired();
            entity.Property(pagamento => pagamento.ContaBancariaId)
                .HasColumnName("id_conta_bancaria");
            entity.Property(pagamento => pagamento.ValorTotal)
                .HasColumnName("valor_total")
                .HasPrecision(18, 2)
                .IsRequired();
            entity.Property(pagamento => pagamento.Observacao)
                .HasColumnName("observacao")
                .HasMaxLength(500);
            entity.Property(pagamento => pagamento.CriadoEm)
                .HasColumnName("criado_em")
                .HasDefaultValueSql("now()")
                .IsRequired();

            entity.HasOne(pagamento => pagamento.Emprestimo)
                .WithMany(emprestimo => emprestimo.Pagamentos)
                .HasForeignKey(pagamento => pagamento.EmprestimoId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(pagamento => pagamento.Usuario)
                .WithMany()
                .HasForeignKey(pagamento => pagamento.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(pagamento => pagamento.ContaBancaria)
                .WithMany()
                .HasForeignKey(pagamento => pagamento.ContaBancariaId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(pagamento => pagamento.UsuarioId);
            entity.HasIndex(pagamento => pagamento.EmprestimoId);
            entity.HasIndex(pagamento => pagamento.ContaBancariaId);
        });
    }

    private static void ConfigureParcelaEmprestimo(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ParcelaEmprestimo>(entity =>
        {
            entity.ToTable("parcelas_emprestimos");
            entity.HasKey(parcela => parcela.Id);

            entity.Property(parcela => parcela.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();
            entity.Property(parcela => parcela.UsuarioId)
                .HasColumnName("id_usuario")
                .IsRequired();
            entity.Property(parcela => parcela.EmprestimoId)
                .HasColumnName("id_emprestimo")
                .IsRequired();
            entity.Property(parcela => parcela.PagamentoEmprestimoId)
                .HasColumnName("id_pagamento_emprestimo");
            entity.Property(parcela => parcela.NumeroParcela)
                .HasColumnName("numero_parcela")
                .IsRequired();
            entity.Property(parcela => parcela.Competencia)
                .HasColumnName("competencia")
                .IsRequired();
            entity.Property(parcela => parcela.DataVencimento)
                .HasColumnName("data_vencimento")
                .IsRequired();
            entity.Property(parcela => parcela.Valor)
                .HasColumnName("valor")
                .HasPrecision(18, 2)
                .IsRequired();
            entity.Property(parcela => parcela.Status)
                .HasColumnName("status")
                .HasConversion<string>()
                .HasMaxLength(30)
                .IsRequired();
            entity.Property(parcela => parcela.DataPagamento)
                .HasColumnName("data_pagamento");

            entity.HasOne(parcela => parcela.Emprestimo)
                .WithMany(emprestimo => emprestimo.Parcelas)
                .HasForeignKey(parcela => parcela.EmprestimoId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(parcela => parcela.Usuario)
                .WithMany()
                .HasForeignKey(parcela => parcela.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(parcela => parcela.PagamentoEmprestimo)
                .WithMany(pagamento => pagamento.Parcelas)
                .HasForeignKey(parcela => parcela.PagamentoEmprestimoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(parcela => parcela.UsuarioId);
            entity.HasIndex(parcela => parcela.EmprestimoId);
            entity.HasIndex(parcela => new { parcela.EmprestimoId, parcela.Competencia }).IsUnique();
            entity.HasIndex(parcela => parcela.PagamentoEmprestimoId);
            entity.HasIndex(parcela => parcela.Status);
            entity.HasIndex(parcela => new { parcela.EmprestimoId, parcela.NumeroParcela })
                .IsUnique();
        });
    }

    private static void ConfigureAlteracaoRecorrenciaEmprestimo(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AlteracaoRecorrenciaEmprestimo>(entity =>
        {
            entity.ToTable("alteracoes_recorrencias_emprestimos");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(item => item.UsuarioId).HasColumnName("id_usuario").IsRequired();
            entity.Property(item => item.EmprestimoId).HasColumnName("id_emprestimo").IsRequired();
            entity.Property(item => item.Competencia).HasColumnName("competencia").IsRequired();
            entity.Property(item => item.Valor).HasColumnName("valor").HasPrecision(18, 2).IsRequired();
            entity.Property(item => item.Escopo).HasColumnName("escopo").HasConversion<string>().HasMaxLength(40).IsRequired();
            entity.Property(item => item.CriadoEm).HasColumnName("criado_em").HasDefaultValueSql("now()").IsRequired();
            entity.HasOne(item => item.Emprestimo).WithMany(item => item.AlteracoesRecorrencia)
                .HasForeignKey(item => item.EmprestimoId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(item => item.Usuario).WithMany().HasForeignKey(item => item.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(item => item.UsuarioId);
            entity.HasIndex(item => new { item.EmprestimoId, item.Competencia, item.Escopo }).IsUnique();
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
