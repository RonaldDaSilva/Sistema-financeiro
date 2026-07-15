using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Relatorios;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class RelatorioServiceTests
{
    private static int _codigoExibicao;

    [Fact]
    public async Task GetGraficosAsync_FiltrosCombinados_RetornaSomenteTransacoesCompativeis()
    {
        var usuarioId = Guid.NewGuid();
        var outroUsuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);
        await SeedUsuarioAsync(database.Context, outroUsuarioId);

        var conta = CriarConta(usuarioId, "Conta principal");
        var cartao = CriarCartao(usuarioId);
        var categoriaCasa = CriarCategoria(usuarioId, "Casa");
        var categoriaCarro = CriarCategoria(usuarioId, "Carro");
        var compraParcelada = CriarCompraParcelada(usuarioId, categoriaCasa, cartao);

        database.Context.AddRange(conta, cartao, categoriaCasa, categoriaCarro, compraParcelada);
        database.Context.Transacoes.AddRange(
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 50m, new DateOnly(2026, 6, 10), categoriaCasa, conta, cartao, isPaga: false, isFixa: true, compraParcelada.Id),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 70m, new DateOnly(2026, 6, 11), categoriaCarro, conta, cartao, isPaga: false, isFixa: true, compraParcelada.Id),
            CriarTransacao(usuarioId, TipoTransacao.Receita, 300m, new DateOnly(2026, 6, 12), categoriaCasa, conta, null, isPaga: true),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 999m, new DateOnly(2026, 7, 1), categoriaCasa, conta, cartao, isPaga: false, isFixa: true, compraParcelada.Id));
        await database.Context.SaveChangesAsync();

        var service = new RelatorioService(database.Context);

        var response = await service.GetGraficosAsync(
            new DateOnly(2026, 6, 1),
            new DateOnly(2026, 6, 30),
            usuarioId,
            conta.Id,
            cartao.Id,
            [categoriaCasa.Id, categoriaCarro.Id],
            TipoTransacao.Despesa,
            "pendente",
            somenteRecorrentes: true,
            somenteParceladas: true);

        Assert.Equal(120m, response.Kpis.Despesas.ValorAtual);
        Assert.Equal(0m, response.Kpis.Receitas.ValorAtual);
        Assert.Equal(2, response.DespesasPorCategoria.Count);
        Assert.Equal(120m, response.ProjecaoDiaria.Sum(item => item.Saidas));
        Assert.Equal(-120m, response.ProjecaoDiaria.Last().SaldoAcumulado);
    }

    [Fact]
    public async Task GetGraficosAsync_PeriodoVazio_RetornaSeriesZeradas()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var service = new RelatorioService(database.Context);

        var response = await service.GetGraficosAsync(
            new DateOnly(2026, 4, 1),
            new DateOnly(2026, 4, 30),
            usuarioId);

        Assert.Equal(0m, response.Kpis.Receitas.ValorAtual);
        Assert.Equal(0m, response.Kpis.Despesas.ValorAtual);
        Assert.Equal(30, response.ProjecaoDiaria.Count);
        Assert.All(response.ProjecaoDiaria, item =>
        {
            Assert.Equal(0m, item.Entradas);
            Assert.Equal(0m, item.Saidas);
            Assert.Equal(0m, item.SaldoAcumulado);
        });
    }

    [Fact]
    public async Task GetGraficosAsync_SaldoProjetadoNegativo_MantemConsistenciaEntreKpiESerie()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var categoria = CriarCategoria(usuarioId, "Geral");
        database.Context.Categorias.Add(categoria);
        database.Context.Transacoes.AddRange(
            CriarTransacao(usuarioId, TipoTransacao.Receita, 100m, new DateOnly(2024, 2, 28), categoria, null, null, isPaga: true),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 150m, new DateOnly(2024, 2, 29), categoria, null, null, isPaga: false));
        await database.Context.SaveChangesAsync();

        var service = new RelatorioService(database.Context);

        var response = await service.GetGraficosAsync(
            new DateOnly(2024, 2, 1),
            new DateOnly(2024, 2, 29),
            usuarioId);

        Assert.Equal(-50m, response.Kpis.ResultadoLiquido.ValorAtual);
        Assert.Equal(response.Kpis.ResultadoLiquido.ValorAtual, response.ProjecaoDiaria.Last().SaldoAcumulado);
        Assert.Contains(response.ProjecaoDiaria, item => item.SaldoAcumulado < 0);
    }

    [Fact]
    public async Task GetGraficosAsync_IsolaDadosDeOutroUsuario()
    {
        var usuarioId = Guid.NewGuid();
        var outroUsuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);
        await SeedUsuarioAsync(database.Context, outroUsuarioId);

        var categoria = CriarCategoria(usuarioId, "Geral");
        database.Context.Categorias.Add(categoria);
        database.Context.Transacoes.AddRange(
            CriarTransacao(usuarioId, TipoTransacao.Receita, 10m, new DateOnly(2026, 12, 31), categoria, null, null, isPaga: true),
            CriarTransacao(outroUsuarioId, TipoTransacao.Receita, 999m, new DateOnly(2026, 12, 31), categoria, null, null, isPaga: true));
        await database.Context.SaveChangesAsync();

        var service = new RelatorioService(database.Context);

        var response = await service.GetGraficosAsync(
            new DateOnly(2026, 12, 1),
            new DateOnly(2026, 12, 31),
            usuarioId);

        Assert.Equal(10m, response.Kpis.Receitas.ValorAtual);
        Assert.Equal(10m, response.ProjecaoDiaria.Sum(item => item.Entradas));
    }

    private static async Task SeedUsuarioAsync(AppDbContext context, Guid usuarioId)
    {
        context.Usuarios.Add(new Usuario
        {
            Id = usuarioId,
            Nome = "Usuario Teste",
            Email = $"{usuarioId:N}@teste.local",
            SenhaHash = "hash"
        });

        await context.SaveChangesAsync();
    }

    private static ContaBancaria CriarConta(Guid usuarioId, string nome)
    {
        return new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = nome,
            CodigoBanco = "001",
            SaldoInicial = 0m
        };
    }

    private static CartaoCredito CriarCartao(Guid usuarioId)
    {
        return new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = "Cartao teste",
            Banco = "Banco teste",
            DiaVencimento = 10,
            MelhorDiaCompra = 5,
            LimiteTotal = 1000m
        };
    }

    private static Categoria CriarCategoria(Guid usuarioId, string nome)
    {
        return new Categoria
        {
            UsuarioId = usuarioId,
            Nome = nome,
            CorHexa = "#0f172a"
        };
    }

    private static CompraParcelada CriarCompraParcelada(
        Guid usuarioId,
        Categoria categoria,
        CartaoCredito cartao)
    {
        return new CompraParcelada
        {
            UsuarioId = usuarioId,
            Categoria = categoria,
            CartaoCredito = cartao,
            Descricao = "Compra parcelada teste",
            QuantidadeParcelas = 2,
            ValorTotal = 100m,
            DataCompra = new DateOnly(2026, 6, 1),
            FormaPagamento = FormaPagamentoCompraParcelada.CartaoCredito
        };
    }

    private static Transacao CriarTransacao(
        Guid usuarioId,
        TipoTransacao tipo,
        decimal valor,
        DateOnly data,
        Categoria categoria,
        ContaBancaria? conta,
        CartaoCredito? cartao,
        bool isPaga,
        bool isFixa = false,
        Guid? compraParceladaId = null)
    {
        return new Transacao
        {
            UsuarioId = usuarioId,
            CodigoExibicao = Interlocked.Increment(ref _codigoExibicao),
            Tipo = tipo,
            Valor = valor,
            DataOcorrencia = data,
            Descricao = $"{tipo} {valor}",
            Categoria = categoria,
            ContaBancaria = conta,
            CartaoCredito = cartao,
            FormaPagamento = cartao is null ? "Pix" : "Cartão de crédito",
            IsPaga = isPaga,
            IsFixa = isFixa,
            CompraParceladaId = compraParceladaId
        };
    }
}
