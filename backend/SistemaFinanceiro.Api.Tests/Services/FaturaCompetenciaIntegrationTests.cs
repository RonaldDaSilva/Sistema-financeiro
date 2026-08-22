using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.CartoesCredito;
using SistemaFinanceiro.Api.Services.ContasBancarias;
using SistemaFinanceiro.Api.Services.Relatorios;
using SistemaFinanceiro.Api.Services.Transacoes;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class FaturaCompetenciaIntegrationTests
{
    [Fact]
    public async Task FaturaPaga_Dia31ComVencimento8_NaoContaminaCompetenciasSeguintes()
    {
        using var cenario = await CriarCenarioAsync();
        var transacaoService = new TransacaoService(cenario.Database.Context);
        var cartaoService = new CartaoCreditoService(cenario.Database.Context, transacaoService);
        var relatorioService = new RelatorioService(
            cenario.Database.Context,
            new ContaBancariaService(cenario.Database.Context),
            transacaoService);

        cenario.Database.Context.Transacoes.AddRange(
            CriarDespesa(cenario, 1, "30 de julho", new DateOnly(2026, 7, 30), 10m),
            CriarDespesa(cenario, 2, "31 de julho", new DateOnly(2026, 7, 31), 20m),
            CriarDespesa(cenario, 3, "1 de agosto", new DateOnly(2026, 8, 1), 30m),
            CriarDespesa(cenario, 4, "Fixa dia 15", new DateOnly(2026, 8, 15), 40m, isFixa: true),
            CriarDespesa(cenario, 5, "30 de agosto", new DateOnly(2026, 8, 30), 50m),
            CriarDespesa(cenario, 6, "31 de agosto", new DateOnly(2026, 8, 31), 60m),
            new Transacao
            {
                UsuarioId = cenario.UsuarioId,
                CodigoExibicao = 7,
                Tipo = TipoTransacao.Despesa,
                Descricao = "Pagamento da fatura de agosto",
                Valor = 10m,
                DataOcorrencia = new DateOnly(2026, 8, 8),
                FormaPagamento = "Pagamento de fatura",
                IsPaga = true
            });
        cenario.Database.Context.ComprasParceladas.Add(new CompraParcelada
        {
            UsuarioId = cenario.UsuarioId,
            CartaoCredito = cenario.Cartao,
            Categoria = cenario.Categoria,
            Descricao = "Compra parcelada",
            ValorTotal = 300m,
            QuantidadeParcelas = 3,
            DataCompra = new DateOnly(2026, 8, 15),
            FormaPagamento = FormaPagamentoCompraParcelada.CartaoCredito
        });
        cenario.Database.Context.FaturasCartaoPagamentos.Add(new FaturaCartaoPagamento
        {
            UsuarioId = cenario.UsuarioId,
            CartaoCredito = cenario.Cartao,
            DataVencimento = new DateOnly(2026, 8, 8),
            IsPaga = true
        });
        await cenario.Database.Context.SaveChangesAsync();

        var agosto = Assert.Single(await transacaoService.GetFaturasDoMesAsync(8, 2026, cenario.UsuarioId));
        var setembro = Assert.Single(await transacaoService.GetFaturasDoMesAsync(9, 2026, cenario.UsuarioId));
        var outubro = Assert.Single(await transacaoService.GetFaturasDoMesAsync(10, 2026, cenario.UsuarioId));
        var novembro = Assert.Single(await transacaoService.GetFaturasDoMesAsync(11, 2026, cenario.UsuarioId));

        Assert.Equal(new DateOnly(2026, 8, 8), agosto.DataVencimento);
        Assert.True(agosto.IsPaga);
        Assert.Equal(10m, agosto.ValorTotal);
        Assert.Equal("30 de julho", Assert.Single(agosto.Detalhes).Descricao);

        Assert.Equal(new DateOnly(2026, 7, 31), setembro.InicioCompetencia);
        Assert.Equal(new DateOnly(2026, 8, 30), setembro.FimCompetencia);
        Assert.Equal(new DateOnly(2026, 9, 8), setembro.DataVencimento);
        Assert.False(setembro.IsPaga);
        Assert.Equal("Aberta", setembro.Status);
        Assert.Equal(240m, setembro.ValorTotal);
        Assert.Collection(
            setembro.Detalhes.OrderBy(item => item.DataOcorrencia).ThenBy(item => item.Descricao),
            item => Assert.Equal("31 de julho", item.Descricao),
            item => Assert.Equal("1 de agosto", item.Descricao),
            item => Assert.Equal("Compra parcelada", item.Descricao),
            item => Assert.Equal("Fixa dia 15", item.Descricao),
            item => Assert.Equal("30 de agosto", item.Descricao));

        Assert.Equal(new DateOnly(2026, 10, 8), outubro.DataVencimento);
        Assert.Equal(200m, outubro.ValorTotal);
        Assert.Equal(1, outubro.Detalhes.Count(item => item.Descricao == "Fixa dia 15"));
        Assert.Equal(1, outubro.Detalhes.Count(item => item.Descricao == "Compra parcelada"));
        Assert.Equal(1, outubro.Detalhes.Count(item => item.Descricao == "31 de agosto"));

        Assert.Equal(new DateOnly(2026, 11, 8), novembro.DataVencimento);
        Assert.Equal(140m, novembro.ValorTotal);
        Assert.Equal(100m, Assert.Single(
            novembro.Detalhes,
            item => item.Descricao == "Compra parcelada").Valor);

        var cartao = Assert.Single(await cartaoService.ListarAsync(cenario.UsuarioId));
        Assert.Equal(580m, cartao.ValorUtilizado);
        Assert.Equal(1420m, cartao.LimiteDisponivel);

        var resumoAgosto = await relatorioService.GetResumoMensalAsync(8, 2026, cenario.UsuarioId);
        var resumoSetembro = await relatorioService.GetResumoMensalAsync(9, 2026, cenario.UsuarioId);
        Assert.Equal(10m, resumoAgosto.DespesasPrevistas);
        Assert.Equal(240m, resumoSetembro.DespesasPrevistas);
        Assert.Equal(240m, Assert.Single(resumoSetembro.DespesasPorCategoria).Valor);
        Assert.Equal(-240m, resumoSetembro.SobraPrevista);

        var pagamentoPreservado = await cenario.Database.Context.FaturasCartaoPagamentos
            .AsNoTracking()
            .SingleAsync();
        Assert.Equal(new DateOnly(2026, 8, 8), pagamentoPreservado.DataVencimento);
        Assert.True(pagamentoPreservado.IsPaga);
    }

    private static async Task<Cenario> CriarCenarioAsync()
    {
        var usuarioId = Guid.NewGuid();
        var database = new SqliteTestDatabase(usuarioId);
        var usuario = new Usuario
        {
            Id = usuarioId,
            Nome = "Usuário teste",
            Email = $"{usuarioId:N}@teste.local",
            SenhaHash = "hash"
        };
        var cartao = new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = "Cartão 31/8",
            Banco = "Banco teste",
            MelhorDiaCompra = 31,
            DiaVencimento = 8,
            LimiteTotal = 2000m
        };
        var categoria = new Categoria
        {
            UsuarioId = usuarioId,
            Nome = "Compras",
            CorHexa = "#2563EB"
        };
        database.Context.AddRange(usuario, cartao, categoria);
        await database.Context.SaveChangesAsync();
        return new Cenario(database, usuarioId, cartao, categoria);
    }

    private static Transacao CriarDespesa(
        Cenario cenario,
        int codigoExibicao,
        string descricao,
        DateOnly data,
        decimal valor,
        bool isFixa = false) => new()
    {
        UsuarioId = cenario.UsuarioId,
        CodigoExibicao = codigoExibicao,
        CartaoCredito = cenario.Cartao,
        Categoria = cenario.Categoria,
        Tipo = TipoTransacao.Despesa,
        Descricao = descricao,
        Valor = valor,
        DataOcorrencia = data,
        FormaPagamento = "Cartão de crédito",
        IsFixa = isFixa
    };

    private sealed record Cenario(
        SqliteTestDatabase Database,
        Guid UsuarioId,
        CartaoCredito Cartao,
        Categoria Categoria) : IDisposable
    {
        public void Dispose() => Database.Dispose();
    }
}
