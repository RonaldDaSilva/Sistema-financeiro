using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.ContasBancarias;
using SistemaFinanceiro.Api.Dtos;
using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.ContasBancarias;
using SistemaFinanceiro.Api.Services.Relatorios;
using SistemaFinanceiro.Api.Services.Transacoes;
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
    public async Task GetGraficosAsync_CompromissosFuturos_UsaExtratoConsolidadoComParcelasERecorrenciasProjetadas()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var inicioMesAtual = new DateOnly(hoje.Year, hoje.Month, 1);
        var proximoMes = inicioMesAtual.AddMonths(1);
        var categoria = CriarCategoria(usuarioId, "Geral");
        database.Context.Categorias.Add(categoria);
        await database.Context.SaveChangesAsync();

        var transacaoService = new TransacaoServiceCompromissosFake(
            new Dictionary<(int Ano, int Mes), ExtratoMensalResponse>
            {
                [(inicioMesAtual.Year, inicioMesAtual.Month)] = new()
                {
                    Itens =
                    [
                        CriarItemExtrato(TipoTransacao.Despesa, 120m, inicioMesAtual.AddDays(10), categoria, isFixa: true),
                        CriarItemExtrato(TipoTransacao.Receita, 500m, inicioMesAtual.AddDays(12), categoria, isFixa: true)
                    ]
                },
                [(proximoMes.Year, proximoMes.Month)] = new()
                {
                    Itens =
                    [
                        CriarItemExtrato(TipoTransacao.Despesa, 50m, proximoMes.AddDays(9), categoria, compraParceladaId: Guid.NewGuid()),
                        CriarItemExtrato(TipoTransacao.Despesa, 120m, proximoMes.AddDays(10), categoria, isFixa: true),
                        CriarItemExtrato(TipoTransacao.Receita, 500m, proximoMes.AddDays(12), categoria, isFixa: true)
                    ]
                }
            },
            new Dictionary<(int Ano, int Mes), IReadOnlyList<FaturaConsolidadaResponse>>
            {
                [(inicioMesAtual.Year, inicioMesAtual.Month)] =
                [
                    CriarFaturaConsolidada(Guid.NewGuid(), inicioMesAtual.AddDays(27), categoria, 100m)
                ],
                [(proximoMes.Year, proximoMes.Month)] =
                [
                    CriarFaturaConsolidada(Guid.NewGuid(), proximoMes.AddDays(27), categoria, 100m, Guid.NewGuid(), 4, 6)
                ]
            });
        var service = new RelatorioService(
            database.Context,
            new ContaBancariaServiceParaTeste(database.Context),
            transacaoService);

        var response = await service.GetGraficosAsync(
            inicioMesAtual.AddMonths(-3),
            inicioMesAtual.AddMonths(2).AddDays(-1),
            usuarioId);

        Assert.DoesNotContain(response.CompromissosFuturos, item =>
            item.Ano == inicioMesAtual.AddMonths(-1).Year &&
            item.Mes == inicioMesAtual.AddMonths(-1).Month);
        var compromissoAtual = Assert.Single(
            response.CompromissosFuturos,
            item => item.Ano == inicioMesAtual.Year && item.Mes == inicioMesAtual.Month);
        var compromissoProximo = Assert.Single(
            response.CompromissosFuturos,
            item => item.Ano == proximoMes.Year && item.Mes == proximoMes.Month);

        Assert.Equal(100m, compromissoAtual.Faturas);
        Assert.Equal(120m, compromissoAtual.DespesasFixas);
        Assert.Equal(500m, compromissoAtual.ReceitasPrevistas);
        Assert.Equal(100m, compromissoProximo.Faturas);
        Assert.Equal(50m, compromissoProximo.ParcelasForaDeFatura);
        Assert.Equal(120m, compromissoProximo.DespesasFixas);
        Assert.Equal(500m, compromissoProximo.ReceitasPrevistas);
        Assert.Equal(
            compromissoProximo.Faturas +
            compromissoProximo.ParcelasForaDeFatura +
            compromissoProximo.DespesasFixas +
            compromissoProximo.OutrasDespesas,
            compromissoProximo.ObrigacoesFuturas);
        Assert.Equal(
            compromissoProximo.ReceitasPrevistas - compromissoProximo.ObrigacoesFuturas,
            compromissoProximo.ImpactoLiquido);
    }

    [Fact]
    public async Task GetGraficosAsync_ReutilizaMotorConsolidadoUmaVezPorMesNaRequisicao()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var inicioMesAtual = new DateOnly(hoje.Year, hoje.Month, 1);
        var fimMesAtual = inicioMesAtual.AddMonths(1).AddDays(-1);
        var categoria = CriarCategoria(usuarioId, "Geral");
        database.Context.Categorias.Add(categoria);
        await database.Context.SaveChangesAsync();

        var cartaoId = Guid.NewGuid();
        var transacaoService = new TransacaoServiceCompromissosFake(
            new Dictionary<(int Ano, int Mes), ExtratoMensalResponse>
            {
                [(inicioMesAtual.Year, inicioMesAtual.Month)] = new()
                {
                    Itens =
                    [
                        CriarItemExtrato(
                            TipoTransacao.Receita,
                            500m,
                            inicioMesAtual.AddDays(2),
                            categoria,
                            isPaga: true)
                    ]
                }
            },
            new Dictionary<(int Ano, int Mes), IReadOnlyList<FaturaConsolidadaResponse>>
            {
                [(inicioMesAtual.Year, inicioMesAtual.Month)] =
                [
                    CriarFaturaConsolidada(cartaoId, inicioMesAtual.AddDays(25), categoria, 100m)
                ]
            });
        var service = new RelatorioService(
            database.Context,
            new ContaBancariaServiceParaTeste(database.Context),
            transacaoService);

        await service.GetGraficosAsync(inicioMesAtual, fimMesAtual, usuarioId);

        var chaveMesAtual = (inicioMesAtual.Year, inicioMesAtual.Month);
        Assert.Equal(1, transacaoService.ChamadasExtrato[chaveMesAtual]);
        Assert.Equal(1, transacaoService.ChamadasFatura[chaveMesAtual]);
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

    [Fact]
    public async Task GetGraficosAsync_Receitas_SeparaRealizadasPrevistasEVencidasPorStatus()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var inicio = new DateOnly(hoje.Year, hoje.Month, 1);
        var fim = inicio.AddMonths(1).AddDays(-1);
        var conta = CriarConta(usuarioId, "Conta principal");
        var categoria = CriarCategoria(usuarioId, "Geral");
        database.Context.AddRange(conta, categoria);
        database.Context.Transacoes.AddRange(
            CriarTransacao(usuarioId, TipoTransacao.Receita, 1000m, inicio.AddDays(1), categoria, conta, null, isPaga: true),
            CriarTransacao(usuarioId, TipoTransacao.Receita, 200m, hoje.AddDays(-1), categoria, conta, null, isPaga: false),
            CriarTransacao(usuarioId, TipoTransacao.Receita, 300m, hoje.AddDays(1), categoria, conta, null, isPaga: false));
        await database.Context.SaveChangesAsync();

        var service = CriarService(database.Context);

        var response = await service.GetGraficosAsync(inicio, fim, usuarioId, conta.Id);

        Assert.Equal(1000m, response.Kpis.Receitas.ValorAtual);
        Assert.Equal(1000m, response.ResumoAuditavel.ReceitasRealizadas);
        Assert.Equal(300m, response.ResumoAuditavel.ReceitasPrevistas);
        Assert.Equal(200m, response.ResumoAuditavel.ReceitasVencidas);
        Assert.Equal(300m, response.DisponivelAposCompromissos.ReceitasPrevistas);
    }

    [Fact]
    public async Task GetGraficosAsync_ReceitaFixaOriginalRecebida_NaoDuplicaComoVencida()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var conta = CriarConta(usuarioId, "Conta principal");
        var categoria = CriarCategoria(usuarioId, "Geral");
        var receitaFixa = CriarTransacao(
            usuarioId,
            TipoTransacao.Receita,
            1000m,
            new DateOnly(2026, 1, 5),
            categoria,
            conta,
            null,
            isPaga: true,
            isFixa: true);
        database.Context.AddRange(conta, categoria, receitaFixa);
        await database.Context.SaveChangesAsync();

        database.Context.TransacoesFixasPagamentos.AddRange(
            new TransacaoFixaPagamento
            {
                UsuarioId = usuarioId,
                TransacaoFixaId = receitaFixa.Id,
                DataOcorrencia = new DateOnly(2026, 2, 5),
                IsPaga = true
            },
            new TransacaoFixaPagamento
            {
                UsuarioId = usuarioId,
                TransacaoFixaId = receitaFixa.Id,
                DataOcorrencia = new DateOnly(2026, 3, 5),
                IsPaga = true
            });
        await database.Context.SaveChangesAsync();

        var service = new RelatorioService(
            database.Context,
            new ContaBancariaServiceParaTeste(database.Context),
            new TransacaoServiceCompromissosFake(
                new Dictionary<(int Ano, int Mes), ExtratoMensalResponse>
                {
                    [(2026, 1)] = new()
                    {
                        Itens =
                        [
                            CriarItemExtrato(
                                TipoTransacao.Receita,
                                1000m,
                                new DateOnly(2026, 1, 5),
                                categoria,
                                isFixa: true,
                                id: receitaFixa.Id,
                                isPaga: true,
                                origem: "Transacao",
                                isProjetada: false),
                            CriarItemExtrato(
                                TipoTransacao.Receita,
                                1000m,
                                new DateOnly(2026, 1, 5),
                                categoria,
                                isFixa: true,
                                id: receitaFixa.Id,
                                isPaga: false,
                                origem: "ReceitaFixa")
                        ]
                    },
                    [(2026, 2)] = new()
                    {
                        Itens =
                        [
                            CriarItemExtrato(
                                TipoTransacao.Receita,
                                1000m,
                                new DateOnly(2026, 2, 5),
                                categoria,
                                isFixa: true,
                                id: receitaFixa.Id,
                                isPaga: true,
                                origem: "ReceitaFixa")
                        ]
                    },
                    [(2026, 3)] = new()
                    {
                        Itens =
                        [
                            CriarItemExtrato(
                                TipoTransacao.Receita,
                                1000m,
                                new DateOnly(2026, 3, 5),
                                categoria,
                                isFixa: true,
                                id: receitaFixa.Id,
                                isPaga: true,
                                origem: "ReceitaFixa")
                        ]
                    }
                },
                new Dictionary<(int Ano, int Mes), IReadOnlyList<FaturaConsolidadaResponse>>()));

        var response = await service.GetGraficosAsync(
            new DateOnly(2026, 1, 1),
            new DateOnly(2026, 3, 31),
            usuarioId);

        Assert.Equal(3000m, response.Kpis.Receitas.ValorAtual);
        Assert.Equal(3000m, response.ResumoAuditavel.ReceitasRealizadas);
        Assert.Equal(0m, response.ResumoAuditavel.ReceitasVencidas);
        Assert.Equal(0m, response.ResumoAuditavel.ReceitasPrevistas);
    }

    [Fact]
    public async Task AlternarStatusPagamentoAsync_Receita_MarcaComoRecebidaEAtualizaSaldoSemDuplicar()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var inicio = new DateOnly(hoje.Year, hoje.Month, 1);
        var fim = inicio.AddMonths(1).AddDays(-1);
        var conta = CriarConta(usuarioId, "Conta principal");
        conta.SaldoInicial = 100m;
        var categoria = CriarCategoria(usuarioId, "Geral");
        var receita = CriarTransacao(
            usuarioId,
            TipoTransacao.Receita,
            300m,
            hoje,
            categoria,
            null,
            null,
            isPaga: false);
        database.Context.AddRange(conta, categoria, receita);
        await database.Context.SaveChangesAsync();

        var transacaoService = new TransacaoService(database.Context);
        var request = new AlterarStatusPagamentoRequest
        {
            IsPaga = true,
            ContaBancariaId = conta.Id
        };

        var primeiraLiquidacao = await transacaoService.AlternarStatusPagamentoAsync(
            receita.Id,
            usuarioId,
            request: request);
        var segundaLiquidacao = await transacaoService.AlternarStatusPagamentoAsync(
            receita.Id,
            usuarioId,
            request: request);
        var service = CriarService(database.Context);

        var response = await service.GetGraficosAsync(inicio, fim, usuarioId, conta.Id);

        Assert.True(primeiraLiquidacao);
        Assert.True(segundaLiquidacao);
        Assert.Equal(300m, response.Kpis.Receitas.ValorAtual);
        Assert.Equal(400m, response.DisponivelAposCompromissos.SaldoAtual);
        Assert.Equal(400m, response.DisponivelAposCompromissos.DisponivelAposCompromissos);
        Assert.Equal(1, await database.Context.Transacoes.CountAsync(item => item.Id == receita.Id));
    }

    [Fact]
    public async Task GetGraficosAsync_DisponivelAposCompromissos_SemObrigacoesPendentesIgualSaldoAtual()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var inicio = new DateOnly(hoje.Year, hoje.Month, 1);
        var fim = inicio.AddMonths(1).AddDays(-1);
        var conta = CriarConta(usuarioId, "Conta principal");
        conta.SaldoInicial = 500m;
        var categoria = CriarCategoria(usuarioId, "Geral");
        database.Context.AddRange(conta, categoria);
        database.Context.Transacoes.AddRange(
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 100m, inicio.AddDays(2), categoria, conta, null, isPaga: true),
            CriarTransacao(usuarioId, TipoTransacao.Receita, 200m, inicio.AddDays(3), categoria, conta, null, isPaga: true));
        await database.Context.SaveChangesAsync();

        var service = CriarService(database.Context);

        var response = await service.GetGraficosAsync(inicio, fim, usuarioId, conta.Id);

        Assert.Equal(600m, response.DisponivelAposCompromissos.SaldoAtual);
        Assert.Equal(0m, response.DisponivelAposCompromissos.ObrigacoesPendentesAteDataLimite);
        Assert.Equal(0m, response.DisponivelAposCompromissos.InvestimentosPendentesAteDataLimite);
        Assert.Equal(
            response.DisponivelAposCompromissos.SaldoAtual,
            response.DisponivelAposCompromissos.DisponivelAposCompromissos);
        Assert.Equal(
            response.Kpis.Receitas.ValorAtual -
            response.Kpis.Despesas.ValorAtual -
            response.Kpis.Investimentos.ValorAtual,
            response.Kpis.ResultadoLiquido.ValorAtual);
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
            DataPrimeiroVencimento = dataCompra,
            FormaPagamento = FormaPagamentoCompraParcelada.Carne
        };
    }

    private static ExtratoMensalItemResponse CriarItemExtrato(
        TipoTransacao tipo,
        decimal valor,
        DateOnly data,
        Categoria categoria,
        bool isFixa = false,
        Guid? compraParceladaId = null,
        Guid? id = null,
        bool isPaga = false,
        string? origem = null,
        bool? isProjetada = null)
    {
        return new ExtratoMensalItemResponse
        {
            Id = id ?? Guid.NewGuid(),
            Tipo = tipo,
            Valor = valor,
            DataOcorrencia = data,
            Descricao = $"{tipo} {valor}",
            CategoriaId = categoria.Id,
            CategoriaNome = categoria.Nome,
            CategoriaCorHexa = categoria.CorHexa,
            FormaPagamento = compraParceladaId.HasValue ? "Carnê/Crediário" : "Pix",
            IsFixa = isFixa,
            IsPaga = isPaga,
            Origem = tipo switch
            {
                _ when !string.IsNullOrWhiteSpace(origem) => origem,
                TipoTransacao.Receita => "ReceitaFixa",
                _ when isFixa => "DespesaFixa",
                _ when compraParceladaId.HasValue => "Carne",
                _ => "Transacao"
            },
            OrigemTransacao = OrigemTransacao.Lancamento,
            CompraParceladaId = compraParceladaId,
            NumeroParcela = compraParceladaId.HasValue ? 2 : null,
            QuantidadeParcelas = compraParceladaId.HasValue ? 3 : null,
            IsProjetada = isProjetada ?? (isFixa || compraParceladaId.HasValue)
        };
    }

    private static FaturaConsolidadaResponse CriarFaturaConsolidada(
        Guid cartaoId,
        DateOnly vencimento,
        Categoria categoria,
        decimal valor,
        Guid? compraParceladaId = null,
        int? numeroParcela = null,
        int? quantidadeParcelas = null)
    {
        return new FaturaConsolidadaResponse
        {
            CartaoCreditoId = cartaoId,
            NomeCartao = "Cartao teste",
            ValorTotal = valor,
            ValorTotalOriginal = valor,
            DataVencimento = vencimento,
            InicioCompetencia = new DateOnly(vencimento.Year, vencimento.Month, 1),
            FimCompetencia = new DateOnly(vencimento.Year, vencimento.Month, 1).AddMonths(1).AddDays(-1),
            Status = "Aberta",
            IsPaga = false,
            Detalhes =
            [
                new FaturaDetalheResponse
                {
                    TransacaoId = compraParceladaId.HasValue ? null : Guid.NewGuid(),
                    CompraParceladaId = compraParceladaId,
                    NumeroParcela = numeroParcela,
                    QuantidadeParcelas = quantidadeParcelas,
                    DataOcorrencia = vencimento.AddDays(-10),
                    Descricao = "Compra de cartão",
                    Valor = valor,
                    CategoriaId = categoria.Id,
                    CategoriaNome = categoria.Nome,
                    CategoriaCorHexa = categoria.CorHexa,
                    Origem = compraParceladaId.HasValue ? "CompraParcelada" : "Transacao"
                }
            ]
        };
    }

    private static RelatorioService CriarService(AppDbContext context)
    {
        return new RelatorioService(context, new ContaBancariaServiceParaTeste(context));
    }

    private sealed class TransacaoServiceCompromissosFake : ITransacaoService
    {
        private readonly IReadOnlyDictionary<(int Ano, int Mes), ExtratoMensalResponse> _extratos;
        private readonly IReadOnlyDictionary<(int Ano, int Mes), IReadOnlyList<FaturaConsolidadaResponse>> _faturas;

        public Dictionary<(int Ano, int Mes), int> ChamadasExtrato { get; } = [];
        public Dictionary<(int Ano, int Mes), int> ChamadasFatura { get; } = [];

        public TransacaoServiceCompromissosFake(
            IReadOnlyDictionary<(int Ano, int Mes), ExtratoMensalResponse> extratos,
            IReadOnlyDictionary<(int Ano, int Mes), IReadOnlyList<FaturaConsolidadaResponse>> faturas)
        {
            _extratos = extratos;
            _faturas = faturas;
        }

        public Task<ExtratoMensalResponse> GetExtratoMensalAsync(
            int mes,
            int ano,
            Guid usuarioId,
            bool? apenasDivididas = null,
            StatusFiltro? status = null,
            CancellationToken cancellationToken = default)
        {
            var chave = (ano, mes);
            ChamadasExtrato[chave] = ChamadasExtrato.GetValueOrDefault(chave) + 1;

            return Task.FromResult(
                _extratos.GetValueOrDefault((ano, mes)) ??
                new ExtratoMensalResponse
                {
                    Mes = mes,
                    Ano = ano
                });
        }

        public Task<PagedResponse<ExtratoMensalItemResponse>> GetExtratoMensalPaginadoAsync(
            ExtratoPaginadoRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<IReadOnlyList<FaturaConsolidadaResponse>> GetFaturasDoMesAsync(
            int mes,
            int ano,
            Guid usuarioId,
            CancellationToken cancellationToken = default)
        {
            var chave = (ano, mes);
            ChamadasFatura[chave] = ChamadasFatura.GetValueOrDefault(chave) + 1;

            return Task.FromResult(_faturas.GetValueOrDefault((ano, mes)) ?? []);
        }

        public Task<Guid> CriarAsync(
            CriarTransacaoRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<Guid?> AtualizarAsync(
            Guid id,
            CriarTransacaoRequest request,
            Guid usuarioId,
            bool replicarFuturas = true,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<IReadOnlyList<TransacaoResponse>> AnteciparParcelaAsync(
            AnteciparParcelaRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<bool> ExcluirAsync(
            Guid id,
            Guid usuarioId,
            DateOnly? dataOcorrencia = null,
            bool replicarFuturas = true,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<bool?> AlternarStatusPagamentoAsync(
            Guid id,
            Guid usuarioId,
            DateOnly? dataOcorrencia = null,
            AlterarStatusPagamentoRequest? request = null,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<bool?> AlternarStatusFaturaAsync(
            Guid cartaoCreditoId,
            DateOnly dataVencimento,
            Guid usuarioId,
            PagarFaturaRequest? request = null,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
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
                    transacao.IsPaga &&
                    (!transacao.CartaoCreditoId.HasValue ||
                        transacao.FormaPagamento == "Pagamento de fatura"))
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
