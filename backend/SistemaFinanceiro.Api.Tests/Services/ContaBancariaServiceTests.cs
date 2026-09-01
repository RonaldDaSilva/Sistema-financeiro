using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.ContasBancarias;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.ContasBancarias;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class ContaBancariaServiceTests
{
    [Fact]
    public async Task TransferirAsync_ContasDiferentes_CriaMovimentosVinculadosEAjustaSaldos()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);
        var origem = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Origem",
            CodigoBanco = "001",
            SaldoInicial = 1000m
        };
        var destino = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Destino",
            CodigoBanco = "033",
            SaldoInicial = 200m
        };
        database.Context.ContasBancarias.AddRange(origem, destino);
        await database.Context.SaveChangesAsync();
        var service = new ContaBancariaService(database.Context);

        var transferenciaId = await service.TransferirAsync(new TransferenciaContaRequest
        {
            ContaOrigemId = origem.Id,
            ContaDestinoId = destino.Id,
            Valor = 150m,
            Data = new DateOnly(2026, 8, 31),
            Descricao = "Reserva"
        }, usuarioId);

        var movimentos = database.Context.Transacoes
            .Where(item => item.TransferenciaId == transferenciaId)
            .OrderBy(item => item.Tipo)
            .ToList();
        Assert.Equal(2, movimentos.Count);
        Assert.All(movimentos, item => Assert.True(item.IsPaga));
        Assert.Contains(movimentos, item =>
            item.Tipo == TipoTransacao.Despesa && item.ContaBancariaId == origem.Id);
        Assert.Contains(movimentos, item =>
            item.Tipo == TipoTransacao.Receita && item.ContaBancariaId == destino.Id);

        var saldos = await service.ObterDistribuicaoAsync(usuarioId);
        Assert.Equal(850m, saldos.Single(item => item.Id == origem.Id).SaldoAtual);
        Assert.Equal(350m, saldos.Single(item => item.Id == destino.Id).SaldoAtual);
    }

    [Fact]
    public async Task TransferirAsync_MesmaConta_RejeitaSemCriarMovimentos()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);
        var conta = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Conta única",
            CodigoBanco = "001",
            SaldoInicial = 1000m
        };
        database.Context.ContasBancarias.Add(conta);
        await database.Context.SaveChangesAsync();
        var service = new ContaBancariaService(database.Context);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.TransferirAsync(new TransferenciaContaRequest
            {
                ContaOrigemId = conta.Id,
                ContaDestinoId = conta.Id,
                Valor = 100m
            }, usuarioId));

        Assert.Equal("A conta de origem deve ser diferente da conta de destino.", exception.Message);
        Assert.Empty(database.Context.Transacoes);
    }

    [Fact]
    public async Task TransferirAsync_SaldoInsuficiente_ExigeConfirmacaoExplicita()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);
        var origem = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Origem",
            CodigoBanco = "001",
            SaldoInicial = 50m
        };
        var destino = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Destino",
            CodigoBanco = "033",
            SaldoInicial = 0m
        };
        database.Context.ContasBancarias.AddRange(origem, destino);
        await database.Context.SaveChangesAsync();
        var service = new ContaBancariaService(database.Context);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.TransferirAsync(new TransferenciaContaRequest
            {
                ContaOrigemId = origem.Id,
                ContaDestinoId = destino.Id,
                Valor = 100m
            }, usuarioId));

        Assert.Equal("SALDO_INSUFICIENTE", exception.Message);
        Assert.Empty(database.Context.Transacoes);
    }

    [Fact]
    public async Task ObterDistribuicaoAsync_CompraNoCartaoNaoDebitaContaEPagamentoFaturaDebita()
    {
        var usuarioId = Guid.NewGuid();
        var outroUsuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);
        await SeedUsuarioAsync(database.Context, outroUsuarioId);

        var conta = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Conta principal",
            CodigoBanco = "001",
            SaldoInicial = 1000m
        };
        var cartao = new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = "Cartao teste",
            Banco = "Banco teste",
            LimiteTotal = 2000m,
            DiaVencimento = 10,
            MelhorDiaCompra = 5
        };
        var contaOutroUsuario = new ContaBancaria
        {
            UsuarioId = outroUsuarioId,
            NomeCustomizado = "Conta outro usuario",
            CodigoBanco = "033",
            SaldoInicial = 5000m
        };

        database.Context.AddRange(conta, cartao, contaOutroUsuario);
        database.Context.Transacoes.AddRange(
            CriarTransacao(usuarioId, TipoTransacao.Receita, 500m, conta, null, "Pix"),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 100m, conta, null, "Pix"),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 300m, conta, cartao, "Cartão de crédito"),
            CriarTransacao(usuarioId, TipoTransacao.Despesa, 300m, conta, cartao, "Pagamento de fatura"),
            CriarTransacao(outroUsuarioId, TipoTransacao.Despesa, 999m, contaOutroUsuario, null, "Pix"));
        await database.Context.SaveChangesAsync();

        var service = new ContaBancariaService(database.Context);

        var distribuicao = await service.ObterDistribuicaoAsync(usuarioId);

        var contaPrincipal = Assert.Single(distribuicao);
        Assert.Equal(1100m, contaPrincipal.SaldoAtual);
    }

    [Fact]
    public async Task ObterDistribuicaoAsync_DespesaDivididaManualPagaNaConta_DebitaMinhaParte()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var conta = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Conta principal",
            CodigoBanco = "001",
            SaldoInicial = 1000m
        };

        database.Context.ContasBancarias.Add(conta);
        database.Context.Transacoes.Add(new Transacao
        {
            UsuarioId = usuarioId,
            CodigoExibicao = 1,
            Tipo = TipoTransacao.Despesa,
            Valor = 120m,
            ValorTotalOriginal = 200m,
            PercentualDivisao = 60m,
            IsDividida = true,
            DataOcorrencia = new DateOnly(2026, 7, 18),
            Descricao = "Jantar dividido",
            FormaPagamento = "Pix",
            ContaBancaria = conta,
            IsPaga = true
        });
        await database.Context.SaveChangesAsync();

        var service = new ContaBancariaService(database.Context);

        var distribuicao = await service.ObterDistribuicaoAsync(usuarioId);

        var contaPrincipal = Assert.Single(distribuicao);
        Assert.Equal(880m, contaPrincipal.SaldoAtual);
    }

    [Fact]
    public async Task ObterDistribuicaoAsync_DespesaDivididaVinculadaPagaNaConta_DebitaValorTotal()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var conta = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Conta principal",
            CodigoBanco = "001",
            SaldoInicial = 1000m
        };
        var transacao = new Transacao
        {
            UsuarioId = usuarioId,
            CodigoExibicao = 1,
            Tipo = TipoTransacao.Despesa,
            Valor = 120m,
            ValorTotalOriginal = 200m,
            PercentualDivisao = 60m,
            IsDividida = true,
            DataOcorrencia = new DateOnly(2026, 7, 18),
            Descricao = "Jantar dividido",
            FormaPagamento = "Pix",
            ContaBancaria = conta,
            IsPaga = true
        };

        database.Context.ContasBancarias.Add(conta);
        database.Context.Transacoes.Add(transacao);
        database.Context.DivisoesTransacoes.Add(new DivisaoTransacao
        {
            UsuarioId = usuarioId,
            UsuarioCriadorId = usuarioId,
            TransacaoOrigem = transacao,
            ValorTotal = 200m,
            Status = DivisaoTransacaoStatus.Aceita,
            VersaoAtual = 1
        });
        await database.Context.SaveChangesAsync();

        var service = new ContaBancariaService(database.Context);

        var distribuicao = await service.ObterDistribuicaoAsync(usuarioId);

        var contaPrincipal = Assert.Single(distribuicao);
        Assert.Equal(800m, contaPrincipal.SaldoAtual);
    }

    [Fact]
    public async Task ObterDistribuicaoAsync_ReceitaFixaProjetadaRecebidaCreditaConta()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var conta = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Conta principal",
            CodigoBanco = "001",
            SaldoInicial = 1000m
        };
        var receitaFixa = new Transacao
        {
            UsuarioId = usuarioId,
            CodigoExibicao = 1,
            Tipo = TipoTransacao.Receita,
            Valor = 700m,
            DataOcorrencia = DateOnly.FromDateTime(DateTime.Today).AddMonths(-1),
            Descricao = "Salario",
            FormaPagamento = "Pix",
            ContaBancaria = conta,
            IsFixa = true,
            IsPaga = false
        };
        database.Context.AddRange(conta, receitaFixa);
        database.Context.TransacoesFixasPagamentos.Add(new TransacaoFixaPagamento
        {
            UsuarioId = usuarioId,
            TransacaoFixa = receitaFixa,
            DataOcorrencia = DateOnly.FromDateTime(DateTime.Today).AddDays(10),
            IsPaga = true
        });
        await database.Context.SaveChangesAsync();

        var service = new ContaBancariaService(database.Context);

        var distribuicao = await service.ObterDistribuicaoAsync(usuarioId);

        var contaPrincipal = Assert.Single(distribuicao);
        Assert.Equal(1700m, contaPrincipal.SaldoAtual);
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

    private static Transacao CriarTransacao(
        Guid usuarioId,
        TipoTransacao tipo,
        decimal valor,
        ContaBancaria conta,
        CartaoCredito? cartao,
        string formaPagamento)
    {
        return new Transacao
        {
            UsuarioId = usuarioId,
            CodigoExibicao = Random.Shared.Next(1, int.MaxValue),
            Tipo = tipo,
            Valor = valor,
            DataOcorrencia = new DateOnly(2026, 7, 18),
            Descricao = $"{tipo} {formaPagamento}",
            FormaPagamento = formaPagamento,
            ContaBancaria = conta,
            CartaoCredito = cartao,
            IsPaga = true
        };
    }
}
