using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.CartoesCredito;
using SistemaFinanceiro.Api.Services.Transacoes;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class CartaoCreditoServiceTests
{
    private static readonly Guid CategoriaCasaId = Guid.Parse("0d2cc7a6-e150-433d-bc47-97b401078f86");

    [Fact]
    public async Task ListarAsync_CartaoSemCompras_RetornaSemFaturaComDatasNulas()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        database.Context.CartoesCredito.Add(new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = "Cartao limpo",
            Banco = "Banco teste",
            DiaVencimento = 31,
            MelhorDiaCompra = 29,
            LimiteTotal = 1000m
        });
        await database.Context.SaveChangesAsync();

        var service = CriarService(database.Context);

        var cartao = Assert.Single(await service.ListarAsync(usuarioId));

        Assert.Equal("SemFatura", cartao.StatusFaturaAtual);
        Assert.Null(cartao.DataFechamentoAtual);
        Assert.Null(cartao.DataVencimentoAtual);
        Assert.Null(cartao.DiasParaFechamento);
        Assert.Null(cartao.DiasParaVencimento);
        Assert.Equal(0m, cartao.ValorUtilizado);
        Assert.Equal(cartao.LimiteTotal, cartao.LimiteDisponivel);
        Assert.Equal(cartao.ValorUtilizado, cartao.LimiteTotal - cartao.LimiteDisponivel);
    }

    [Fact]
    public async Task ListarAsync_CompraParceladaIniciadaNoPassado_IncluiParcelasFuturasNoCompromisso()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var dataCompra = new DateOnly(hoje.Year, hoje.Month, 5).AddMonths(-6);
        var cartao = new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = "Cartao parcelado",
            Banco = "Banco teste",
            DiaVencimento = 31,
            MelhorDiaCompra = 10,
            LimiteTotal = 2000m
        };

        database.Context.CartoesCredito.Add(cartao);
        database.Context.ComprasParceladas.Add(new CompraParcelada
        {
            UsuarioId = usuarioId,
            CartaoCredito = cartao,
            CategoriaId = CategoriaCasaId,
            Descricao = "Compra de janeiro em 12x",
            QuantidadeParcelas = 12,
            ValorTotal = 1200m,
            DataCompra = dataCompra,
            FormaPagamento = FormaPagamentoCompraParcelada.CartaoCredito
        });
        await database.Context.SaveChangesAsync();

        var service = CriarService(database.Context);

        var response = Assert.Single(await service.ListarAsync(usuarioId));

        Assert.True(response.QuantidadeParcelasFuturas > 0);
        Assert.True(response.ValorParcelasFuturas > 0m);
        Assert.Equal(response.QuantidadeParcelasFuturas, response.ComprasParceladasFuturas);
        Assert.Equal(response.ValorUtilizado, response.LimiteTotal - response.LimiteDisponivel);
    }

    [Fact]
    public async Task ListarAsync_CompraDivididaNoCartao_UsaValorOriginalNoLimite()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var cartao = new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = "Cartao dividido",
            Banco = "Banco teste",
            DiaVencimento = 31,
            MelhorDiaCompra = 10,
            LimiteTotal = 1500m
        };

        database.Context.CartoesCredito.Add(cartao);
        database.Context.ComprasParceladas.Add(new CompraParcelada
        {
            UsuarioId = usuarioId,
            CartaoCredito = cartao,
            CategoriaId = CategoriaCasaId,
            Descricao = "Compra dividida",
            QuantidadeParcelas = 2,
            ValorTotal = 500m,
            ValorTotalOriginal = 1000m,
            PercentualDivisao = 50m,
            IsDividida = true,
            DataCompra = new DateOnly(hoje.Year, hoje.Month, 5),
            FormaPagamento = FormaPagamentoCompraParcelada.CartaoCredito
        });
        await database.Context.SaveChangesAsync();

        var service = CriarService(database.Context);

        var response = Assert.Single(await service.ListarAsync(usuarioId));

        Assert.True(response.ValorUtilizado >= response.FaturaAtual);
        Assert.Equal(response.ValorUtilizado, response.LimiteTotal - response.LimiteDisponivel);
    }

    private static CartaoCreditoService CriarService(AppDbContext context)
    {
        var transacaoService = new TransacaoService(context);
        return new CartaoCreditoService(context, transacaoService);
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
}
