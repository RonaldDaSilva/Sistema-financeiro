using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos;
using SistemaFinanceiro.Api.Dtos.CartoesCredito;
using SistemaFinanceiro.Api.Dtos.Transacoes;
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
        AssertDecomposicao(response);
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

        var periodoAtual = CalcularPeriodoFatura(cartao, hoje.Month, hoje.Year);
        database.Context.CartoesCredito.Add(cartao);
        database.Context.Transacoes.Add(new Transacao
        {
            UsuarioId = usuarioId,
            CartaoCredito = cartao,
            CategoriaId = CategoriaCasaId,
            Descricao = "Compra dividida",
            Tipo = TipoTransacao.Despesa,
            Valor = 120m,
            ValorTotalOriginal = 200m,
            PercentualDivisao = 60m,
            IsDividida = true,
            DataOcorrencia = periodoAtual.InicioCompetencia,
            FormaPagamento = "Cartão de crédito"
        });
        await database.Context.SaveChangesAsync();

        var service = CriarService(database.Context);

        var response = Assert.Single(await service.ListarAsync(usuarioId));

        Assert.Equal(200m, response.FaturaAtual);
        Assert.Equal(200m, response.ValorFaturaAtual);
        Assert.Equal(200m, response.ValorUtilizado);
        Assert.Equal(1300m, response.LimiteDisponivel);
        AssertDecomposicao(response);
    }

    [Fact]
    public async Task ListarAsync_CompraAVistaNaFaturaAtual_ComprometeFaturaAtual()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var cartao = CriarCartao(usuarioId, limite: 1000m);
        var periodoAtual = CalcularPeriodoFatura(cartao, hoje.Month, hoje.Year);

        database.Context.CartoesCredito.Add(cartao);
        database.Context.Transacoes.Add(CriarDespesaCartao(
            usuarioId,
            cartao,
            periodoAtual.InicioCompetencia,
            123.45m,
            "Compra atual"));
        await database.Context.SaveChangesAsync();

        var response = Assert.Single(await CriarService(database.Context).ListarAsync(usuarioId));

        Assert.Equal(123.45m, response.ValorFaturaAtual);
        Assert.Equal(0m, response.ValorFaturasFechadasNaoPagas);
        Assert.Equal(0m, response.ValorProximasFaturas);
        Assert.Equal(0m, response.ValorParcelasFuturas);
        AssertDecomposicao(response);
    }

    [Fact]
    public async Task ListarAsync_CompraAposFechamento_EntraEmProximaFatura()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var cartao = CriarCartao(usuarioId, limite: 1000m);
        var periodoAtual = CalcularPeriodoFatura(cartao, hoje.Month, hoje.Year);

        database.Context.CartoesCredito.Add(cartao);
        database.Context.Transacoes.Add(CriarDespesaCartao(
            usuarioId,
            cartao,
            periodoAtual.FimCompetencia.AddDays(1),
            200m,
            "Compra futura"));
        await database.Context.SaveChangesAsync();

        var response = Assert.Single(await CriarService(database.Context).ListarAsync(usuarioId));

        Assert.Equal(0m, response.ValorFaturaAtual);
        Assert.Equal(200m, response.ValorProximasFaturas);
        Assert.Equal(0m, response.ValorParcelasFuturas);
        AssertDecomposicao(response);
    }

    [Fact]
    public async Task ListarAsync_CompraParceladaDistribuida_SeparaParcelasFuturasDasProximasFaturas()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var cartao = CriarCartao(usuarioId, limite: 3000m);
        var periodoAtual = CalcularPeriodoFatura(cartao, hoje.Month, hoje.Year);

        database.Context.CartoesCredito.Add(cartao);
        database.Context.Transacoes.Add(CriarDespesaCartao(
            usuarioId,
            cartao,
            periodoAtual.FimCompetencia.AddDays(1),
            150m,
            "Compra avulsa futura"));
        database.Context.ComprasParceladas.Add(new CompraParcelada
        {
            UsuarioId = usuarioId,
            CartaoCredito = cartao,
            CategoriaId = CategoriaCasaId,
            Descricao = "Parcelamento atravessando competencias",
            QuantidadeParcelas = 4,
            ValorTotal = 400m,
            DataCompra = periodoAtual.FimCompetencia.AddDays(1),
            FormaPagamento = FormaPagamentoCompraParcelada.CartaoCredito
        });
        await database.Context.SaveChangesAsync();

        var response = Assert.Single(await CriarService(database.Context).ListarAsync(usuarioId));

        Assert.True(response.ValorProximasFaturas > 0m);
        Assert.True(response.ValorParcelasFuturas > 0m);
        Assert.True(response.QuantidadeParcelasFuturas > 0);
        AssertDecomposicao(response);
    }

    [Fact]
    public async Task ListarAsync_FaturaFechadaNaoPaga_EhComponenteExclusivo()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var cartao = CriarCartao(usuarioId, limite: 1000m);
        var periodoAnterior = CalcularPeriodoFatura(cartao, hoje.AddMonths(-1).Month, hoje.AddMonths(-1).Year);

        database.Context.CartoesCredito.Add(cartao);
        database.Context.Transacoes.Add(CriarDespesaCartao(
            usuarioId,
            cartao,
            periodoAnterior.InicioCompetencia,
            90m,
            "Fatura vencida"));
        database.Context.FaturasCartaoPagamentos.Add(new FaturaCartaoPagamento
        {
            UsuarioId = usuarioId,
            CartaoCredito = cartao,
            DataVencimento = periodoAnterior.DataVencimento,
            IsPaga = false
        });
        await database.Context.SaveChangesAsync();

        var response = Assert.Single(await CriarService(database.Context).ListarAsync(usuarioId));

        Assert.Equal(90m, response.ValorFaturasFechadasNaoPagas);
        Assert.Equal(0m, response.ValorFaturaAtual);
        AssertDecomposicao(response);
    }

    [Fact]
    public async Task ListarAsync_FaturaPaga_NaoComprometeLimite()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var cartao = CriarCartao(usuarioId, limite: 1000m);
        var periodoAtual = CalcularPeriodoFatura(cartao, hoje.Month, hoje.Year);

        database.Context.CartoesCredito.Add(cartao);
        database.Context.Transacoes.Add(CriarDespesaCartao(
            usuarioId,
            cartao,
            periodoAtual.InicioCompetencia,
            300m,
            "Fatura paga"));
        database.Context.FaturasCartaoPagamentos.Add(new FaturaCartaoPagamento
        {
            UsuarioId = usuarioId,
            CartaoCredito = cartao,
            DataVencimento = periodoAtual.DataVencimento,
            IsPaga = true
        });
        await database.Context.SaveChangesAsync();

        var response = Assert.Single(await CriarService(database.Context).ListarAsync(usuarioId));

        Assert.Equal(0m, response.ValorUtilizado);
        Assert.Equal(response.LimiteTotal, response.LimiteDisponivel);
        AssertDecomposicao(response);
    }

    [Fact]
    public async Task ListarOpcoesAsync_RetornaSomenteAtivosDoUsuarioSemAcionarFaturas()
    {
        var usuarioId = Guid.NewGuid();
        var outroUsuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);
        await SeedUsuarioAsync(database.Context, outroUsuarioId);

        database.Context.CartoesCredito.AddRange(
            new CartaoCredito
            {
                UsuarioId = usuarioId,
                ApelidoCartao = "Zeta",
                Banco = "Banco Z",
                DiaVencimento = 10,
                MelhorDiaCompra = 5,
                LimiteTotal = 1000m
            },
            new CartaoCredito
            {
                UsuarioId = usuarioId,
                ApelidoCartao = "Alpha",
                Banco = "Banco A",
                DiaVencimento = 10,
                MelhorDiaCompra = 5,
                LimiteTotal = 1000m
            },
            new CartaoCredito
            {
                UsuarioId = usuarioId,
                ApelidoCartao = "Arquivado",
                Banco = "Banco B",
                DiaVencimento = 10,
                MelhorDiaCompra = 5,
                LimiteTotal = 1000m,
                IsArquivado = true
            },
            new CartaoCredito
            {
                UsuarioId = outroUsuarioId,
                ApelidoCartao = "Outro tenant",
                Banco = "Banco C",
                DiaVencimento = 10,
                MelhorDiaCompra = 5,
                LimiteTotal = 1000m
            });
        await database.Context.SaveChangesAsync();

        var transacaoService = new TransacaoServiceQueFalhaAoCalcularFatura();
        var service = new CartaoCreditoService(database.Context, transacaoService);

        var opcoes = await service.ListarOpcoesAsync(usuarioId);

        Assert.Collection(
            opcoes,
            item =>
            {
                Assert.Equal("Alpha", item.ApelidoCartao);
                Assert.Equal("Banco A", item.Banco);
            },
            item =>
            {
                Assert.Equal("Zeta", item.ApelidoCartao);
                Assert.Equal("Banco Z", item.Banco);
            });
        Assert.Equal(0, transacaoService.ChamadasGetFaturasDoMes);
    }

    private static CartaoCreditoService CriarService(AppDbContext context)
    {
        var transacaoService = new TransacaoService(context);
        return new CartaoCreditoService(context, transacaoService);
    }

    private static CartaoCredito CriarCartao(Guid usuarioId, decimal limite)
    {
        return new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = "Cartao teste",
            Banco = "Banco teste",
            DiaVencimento = 31,
            MelhorDiaCompra = 10,
            LimiteTotal = limite
        };
    }

    private static Transacao CriarDespesaCartao(
        Guid usuarioId,
        CartaoCredito cartao,
        DateOnly data,
        decimal valor,
        string descricao)
    {
        return new Transacao
        {
            UsuarioId = usuarioId,
            CartaoCredito = cartao,
            CategoriaId = CategoriaCasaId,
            Tipo = TipoTransacao.Despesa,
            Descricao = descricao,
            Valor = valor,
            DataOcorrencia = data,
            FormaPagamento = "Cartão de crédito"
        };
    }

    private static void AssertDecomposicao(CartaoCreditoResponse response)
    {
        var somaDecomposicao =
            response.ValorFaturaAtual +
            response.ValorFaturasFechadasNaoPagas +
            response.ValorProximasFaturas +
            response.ValorParcelasFuturas +
            response.ValorOutrosCompromissos;

        Assert.Equal(somaDecomposicao, response.ValorUtilizado);
        Assert.Equal(response.ValorUtilizado, response.LimiteTotal - response.LimiteDisponivel);
    }

    private static FaturaPeriodo CalcularPeriodoFatura(CartaoCredito cartao, int mes, int ano)
    {
        var mesAtual = new DateOnly(ano, mes, 1);
        var mesAnterior = mesAtual.AddMonths(-1);
        var inicioCompetencia = CriarDataNoMes(mesAnterior, cartao.MelhorDiaCompra);
        var fechamentoAtual = CriarDataNoMes(mesAtual, cartao.MelhorDiaCompra);
        return new FaturaPeriodo(
            inicioCompetencia,
            fechamentoAtual.AddDays(-1),
            CriarDataNoMes(mesAtual, cartao.DiaVencimento));
    }

    private static DateOnly CriarDataNoMes(DateOnly mes, int dia)
    {
        return new DateOnly(mes.Year, mes.Month, Math.Min(dia, DateTime.DaysInMonth(mes.Year, mes.Month)));
    }

    private readonly record struct FaturaPeriodo(
        DateOnly InicioCompetencia,
        DateOnly FimCompetencia,
        DateOnly DataVencimento);

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

    private sealed class TransacaoServiceQueFalhaAoCalcularFatura : ITransacaoService
    {
        public int ChamadasGetFaturasDoMes { get; private set; }

        public Task<IReadOnlyList<FaturaConsolidadaResponse>> GetFaturasDoMesAsync(
            int mes,
            int ano,
            Guid usuarioId,
            CancellationToken cancellationToken = default)
        {
            ChamadasGetFaturasDoMes++;
            throw new InvalidOperationException("O endpoint de opções não deve acionar o motor de faturas.");
        }

        public Task<ExtratoMensalResponse> GetExtratoMensalAsync(
            int mes,
            int ano,
            Guid usuarioId,
            bool? apenasDivididas = null,
            StatusFiltro? status = null,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<PagedResponse<ExtratoMensalItemResponse>> GetExtratoMensalPaginadoAsync(
            ExtratoPaginadoRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Guid> CriarAsync(
            CriarTransacaoRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Guid?> AtualizarAsync(
            Guid id,
            CriarTransacaoRequest request,
            Guid usuarioId,
            bool replicarFuturas = true,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<TransacaoResponse>> AnteciparParcelaAsync(
            AnteciparParcelaRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<bool> ExcluirAsync(
            Guid id,
            Guid usuarioId,
            DateOnly? dataOcorrencia = null,
            bool replicarFuturas = true,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<bool?> AlternarStatusPagamentoAsync(
            Guid id,
            Guid usuarioId,
            DateOnly? dataOcorrencia = null,
            AlterarStatusPagamentoRequest? request = null,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<bool?> AlternarStatusFaturaAsync(
            Guid cartaoCreditoId,
            DateOnly dataVencimento,
            Guid usuarioId,
            PagarFaturaRequest? request = null,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
