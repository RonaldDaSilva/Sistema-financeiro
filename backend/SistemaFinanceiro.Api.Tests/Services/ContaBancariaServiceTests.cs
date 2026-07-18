using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.ContasBancarias;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class ContaBancariaServiceTests
{
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
