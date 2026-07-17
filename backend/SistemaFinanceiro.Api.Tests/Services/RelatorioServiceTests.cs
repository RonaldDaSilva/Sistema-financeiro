using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.ContasBancarias;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.ContasBancarias;
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

        var service = CriarService(database.Context);

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
        Assert.Equal(0m, response.ProjecaoDiaria.Sum(item => item.Saidas));
        Assert.Equal(0m, response.ProjecaoDiaria.Last().SaldoAcumulado);
    }

    [Fact]
    public async Task GetGraficosAsync_PeriodoVazio_RetornaSeriesZeradas()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var service = CriarService(database.Context);

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

        var service = CriarService(database.Context);

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

        var service = CriarService(database.Context);

        var response = await service.GetGraficosAsync(
            new DateOnly(2026, 12, 1),
            new DateOnly(2026, 12, 31),
            usuarioId);

        Assert.Equal(10m, response.Kpis.Receitas.ValorAtual);
        Assert.Equal(10m, response.ProjecaoDiaria.Sum(item => item.Entradas));
    }

    [Fact]
    public async Task GetGraficosAsync_DisponivelAposCompromissos_NaoSomaReceitasPrevistasNoPrincipal()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var conta = CriarConta(usuarioId, "Conta principal");
        conta.SaldoInicial = 1000m;
        var categoria = CriarCategoria(usuarioId, "Geral");
        database.Context.AddRange(conta, categoria);
        database.Context.Transacoes.AddRange(
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 100m, new DateOnly(2026, 7, 1), categoria, conta, null, isPaga: true),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 200m, new DateOnly(2026, 7, 20), categoria, conta, null, isPaga: false),
            CriarTransacao(usuarioId, TipoTransacao.Investimento, 50m, new DateOnly(2026, 7, 21), categoria, conta, null, isPaga: false),
            CriarTransacao(usuarioId, TipoTransacao.Receita, 300m, new DateOnly(2026, 7, 25), categoria, conta, null, isPaga: false));
        await database.Context.SaveChangesAsync();

        var service = CriarService(database.Context);

        var response = await service.GetGraficosAsync(
            new DateOnly(2026, 7, 1),
            new DateOnly(2026, 7, 31),
            usuarioId,
            conta.Id);

        Assert.Equal(900m, response.DisponivelAposCompromissos.SaldoAtual);
        Assert.Equal(200m, response.DisponivelAposCompromissos.ObrigacoesPendentesAteDataLimite);
        Assert.Equal(50m, response.DisponivelAposCompromissos.InvestimentosPendentesAteDataLimite);
        Assert.Equal(650m, response.DisponivelAposCompromissos.DisponivelAposCompromissos);
        Assert.Equal(300m, response.DisponivelAposCompromissos.ReceitasPrevistas);
        Assert.Equal(950m, response.DisponivelAposCompromissos.DisponivelConsiderandoReceitasPrevistas);
    }

    [Fact]
    public async Task GetGraficosAsync_CompromissosFuturos_IniciaNoMesAtualECalculaInvariantes()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var inicioMesAtual = new DateOnly(hoje.Year, hoje.Month, 1);
        var mesAnterior = inicioMesAtual.AddMonths(-1);
        var proximoMes = inicioMesAtual.AddMonths(1);
        var conta = CriarConta(usuarioId, "Conta principal");
        var cartao = CriarCartao(usuarioId);
        var categoria = CriarCategoria(usuarioId, "Geral");
        var compraCarne = CriarCompraParceladaSemCartao(usuarioId, categoria, inicioMesAtual);
        database.Context.AddRange(conta, cartao, categoria, compraCarne);
        database.Context.Transacoes.AddRange(
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 777m, mesAnterior.AddDays(4), categoria, conta, null, isPaga: false),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 100m, inicioMesAtual.AddDays(5), categoria, conta, cartao, isPaga: false),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 50m, inicioMesAtual.AddDays(6), categoria, conta, null, isPaga: false, compraParceladaId: compraCarne.Id),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 200m, inicioMesAtual.AddDays(7), categoria, conta, null, isPaga: false, isFixa: true),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 25m, inicioMesAtual.AddDays(8), categoria, conta, null, isPaga: false),
            CriarTransacao(usuarioId, TipoTransacao.Receita, 400m, inicioMesAtual.AddDays(9), categoria, conta, null, isPaga: false),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 999m, proximoMes.AddDays(1), categoria, conta, null, isPaga: true));
        await database.Context.SaveChangesAsync();

        var service = CriarService(database.Context);

        var response = await service.GetGraficosAsync(
            mesAnterior,
            inicioMesAtual.AddMonths(5).AddDays(-1),
            usuarioId);

        Assert.DoesNotContain(response.CompromissosFuturos, item =>
            item.Ano == mesAnterior.Year && item.Mes == mesAnterior.Month);

        var compromissoAtual = Assert.Single(
            response.CompromissosFuturos,
            item => item.Ano == inicioMesAtual.Year && item.Mes == inicioMesAtual.Month);
        Assert.Equal(100m, compromissoAtual.Faturas);
        Assert.Equal(50m, compromissoAtual.ParcelasForaDeFatura);
        Assert.Equal(200m, compromissoAtual.DespesasFixas);
        Assert.Equal(25m, compromissoAtual.OutrasDespesas);
        Assert.Equal(400m, compromissoAtual.ReceitasPrevistas);
        Assert.Equal(
            compromissoAtual.Faturas +
            compromissoAtual.ParcelasForaDeFatura +
            compromissoAtual.DespesasFixas +
            compromissoAtual.OutrasDespesas,
            compromissoAtual.ObrigacoesFuturas);
        Assert.Equal(
            compromissoAtual.ReceitasPrevistas - compromissoAtual.ObrigacoesFuturas,
            compromissoAtual.ImpactoLiquido);
        Assert.Equal(compromissoAtual.ObrigacoesFuturas, compromissoAtual.Total);
    }

    [Fact]
    public async Task GetGraficosAsync_CartaoEmRelatorios_ConsumoEFluxoNaoDuplicamPagamentoFatura()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var conta = CriarConta(usuarioId, "Conta principal");
        var cartao = CriarCartao(usuarioId);
        var categoria = CriarCategoria(usuarioId, "Alimentacao");
        database.Context.AddRange(conta, cartao, categoria);
        database.Context.Transacoes.AddRange(
            CriarTransacao(
                usuarioId,
                TipoTransacao.Despesa,
                100m,
                new DateOnly(2026, 7, 5),
                categoria,
                conta,
                cartao,
                isPaga: true,
                formaPagamento: "Cartão de crédito"),
            CriarTransacao(
                usuarioId,
                TipoTransacao.Despesa,
                100m,
                new DateOnly(2026, 7, 20),
                categoria,
                conta,
                cartao,
                isPaga: true,
                formaPagamento: "Pagamento de fatura"));
        await database.Context.SaveChangesAsync();

        var service = CriarService(database.Context);

        var response = await service.GetGraficosAsync(
            new DateOnly(2026, 7, 1),
            new DateOnly(2026, 7, 31),
            usuarioId);

        Assert.Equal(100m, response.Kpis.Despesas.ValorAtual);
        Assert.Equal(100m, response.DespesasPorCategoria.Single().Valor);
        Assert.Equal(100m, response.EvolucaoMensal.Single().Despesas);
        Assert.Equal(100m, response.PrevistoVersusRealizado
            .Single(item => item.Nome == "Despesas (competência)")
            .Realizado);
        Assert.Equal(100m, response.ProjecaoDiaria.Sum(item => item.Saidas));
        Assert.Equal(0m, response.ProjecaoDiaria
            .Where(item => item.Data < new DateOnly(2026, 7, 20))
            .Sum(item => item.Saidas));
        Assert.Equal(100m, response.ProjecaoDiaria
            .Single(item => item.Data == new DateOnly(2026, 7, 20))
            .Saidas);
        Assert.Equal(100m, response.SerieFluxo.Single().Despesas);
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

    private static CompraParcelada CriarCompraParceladaSemCartao(
        Guid usuarioId,
        Categoria categoria,
        DateOnly dataCompra)
    {
        return new CompraParcelada
        {
            UsuarioId = usuarioId,
            Categoria = categoria,
            Descricao = "Carne parcelado teste",
            QuantidadeParcelas = 3,
            ValorTotal = 150m,
            DataCompra = dataCompra,
            FormaPagamento = FormaPagamentoCompraParcelada.Carne
        };
    }

    private static RelatorioService CriarService(AppDbContext context)
    {
        return new RelatorioService(context, new ContaBancariaServiceParaTeste(context));
    }

    private sealed class ContaBancariaServiceParaTeste : IContaBancariaService
    {
        private readonly AppDbContext _context;

        public ContaBancariaServiceParaTeste(AppDbContext context)
        {
            _context = context;
        }

        public Task<IReadOnlyList<ContaBancariaResponse>> ListarAsync(
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<ContaBancariaResponse?> ObterPorIdAsync(
            Guid id,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<ContaBancariaResponse> CriarAsync(
            ContaBancariaRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<ContaBancariaResponse?> AtualizarAsync(
            Guid id,
            ContaBancariaRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<ContaBancariaResponse?> FavoritarAsync(
            Guid id,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<ContaBancariaResponse?> ArquivarAsync(
            Guid id,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<ContaBancariaResponse?> AjustarSaldoAsync(
            Guid id,
            AjustarSaldoContaRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<Guid> TransferirAsync(
            TransferenciaContaRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<bool> ExcluirAsync(
            Guid id,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public async Task<IReadOnlyList<ContaDistribuicaoResponse>> ObterDistribuicaoAsync(
            Guid usuarioId,
            CancellationToken cancellationToken = default)
        {
            var contas = await _context.ContasBancarias
                .AsNoTracking()
                .Where(conta => conta.UsuarioId == usuarioId && !conta.IsArquivada)
                .Select(conta => new
                {
                    conta.Id,
                    conta.CodigoBanco,
                    conta.NomeCustomizado,
                    conta.SaldoInicial
                })
                .ToListAsync(cancellationToken);
            var movimentos = await _context.Transacoes
                .AsNoTracking()
                .Where(transacao =>
                    transacao.UsuarioId == usuarioId &&
                    transacao.ContaBancariaId.HasValue &&
                    transacao.IsPaga)
                .Select(transacao => new
                {
                    ContaBancariaId = transacao.ContaBancariaId!.Value,
                    transacao.Tipo,
                    transacao.Valor
                })
                .ToListAsync(cancellationToken);

            return contas
                .Select(conta => new ContaDistribuicaoResponse
                {
                    Id = conta.Id,
                    CodigoBanco = conta.CodigoBanco,
                    NomeCustomizado = conta.NomeCustomizado,
                    SaldoAtual = conta.SaldoInicial + movimentos
                        .Where(movimento => movimento.ContaBancariaId == conta.Id)
                        .Sum(movimento =>
                            movimento.Tipo == TipoTransacao.Receita
                                ? movimento.Valor
                                : movimento.Tipo == TipoTransacao.Despesa ||
                                  movimento.Tipo == TipoTransacao.Investimento
                                    ? -movimento.Valor
                                    : 0m)
                })
                .ToList();
        }
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
        Guid? compraParceladaId = null,
        string? formaPagamento = null)
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
            FormaPagamento = formaPagamento ?? (cartao is null ? "Pix" : "Cartão de crédito"),
            IsPaga = isPaga,
            IsFixa = isFixa,
            CompraParceladaId = compraParceladaId
        };
    }
}
