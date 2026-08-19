using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Transacoes;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class TransacaoServiceTests
{
    [Fact]
    public async Task CriarAsync_AplicaStatusPagoSomenteParaDatasAnterioresAHoje()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        database.Context.Usuarios.Add(new Usuario
        {
            Id = usuarioId,
            Nome = "Usuário teste",
            Email = $"{usuarioId:N}@teste.local",
            SenhaHash = "hash"
        });
        await database.Context.SaveChangesAsync();
        var service = new TransacaoService(database.Context);
        var hoje = TransacaoService.ObterDataLocalFinanceira(DateTimeOffset.UtcNow);

        var ontemId = await CriarReceitaAsync(service, usuarioId, hoje.AddDays(-1), "Ontem");
        var antigaId = await CriarReceitaAsync(service, usuarioId, hoje.AddYears(-5), "Antiga");
        var hojeId = await CriarReceitaAsync(service, usuarioId, hoje, "Hoje");
        var amanhaId = await CriarReceitaAsync(service, usuarioId, hoje.AddDays(1), "Amanhã");

        var status = await database.Context.Transacoes
            .AsNoTracking()
            .Where(item => item.UsuarioId == usuarioId)
            .ToDictionaryAsync(item => item.Id, item => item.IsPaga);

        Assert.True(status[ontemId]);
        Assert.True(status[antigaId]);
        Assert.False(status[hojeId]);
        Assert.False(status[amanhaId]);
    }

    [Fact]
    public async Task AtualizarAsync_PreservaStatusExistenteAoAlterarData()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        database.Context.Usuarios.Add(new Usuario
        {
            Id = usuarioId,
            Nome = "Usuário teste",
            Email = $"{usuarioId:N}@teste.local",
            SenhaHash = "hash"
        });
        await database.Context.SaveChangesAsync();
        var service = new TransacaoService(database.Context);
        var hoje = TransacaoService.ObterDataLocalFinanceira(DateTimeOffset.UtcNow);
        var transacaoId = await CriarReceitaAsync(service, usuarioId, hoje, "Pendente hoje");

        await service.AtualizarAsync(
            transacaoId,
            new CriarTransacaoRequest
            {
                Tipo = TipoTransacao.Receita,
                Descricao = "Editada para ontem",
                Valor = 100m,
                DataOcorrencia = hoje.AddDays(-1),
                FormaPagamento = "Pix"
            },
            usuarioId);

        var transacao = await database.Context.Transacoes
            .AsNoTracking()
            .SingleAsync(item => item.Id == transacaoId);
        Assert.False(transacao.IsPaga);
    }

    [Theory]
    [InlineData(2026, 8, 19, 1, 30, 2026, 8, 18)]
    [InlineData(2026, 8, 19, 3, 30, 2026, 8, 19)]
    public void ObterDataLocalFinanceira_RespeitaViradaDoDiaEmSaoPaulo(
        int anoUtc,
        int mesUtc,
        int diaUtc,
        int horaUtc,
        int minutoUtc,
        int anoEsperado,
        int mesEsperado,
        int diaEsperado)
    {
        var instanteUtc = new DateTimeOffset(
            anoUtc,
            mesUtc,
            diaUtc,
            horaUtc,
            minutoUtc,
            0,
            TimeSpan.Zero);

        var dataLocal = TransacaoService.ObterDataLocalFinanceira(instanteUtc);

        Assert.Equal(new DateOnly(anoEsperado, mesEsperado, diaEsperado), dataLocal);
    }

    private static Task<Guid> CriarReceitaAsync(
        TransacaoService service,
        Guid usuarioId,
        DateOnly data,
        string descricao)
    {
        return service.CriarAsync(
            new CriarTransacaoRequest
            {
                Tipo = TipoTransacao.Receita,
                Descricao = descricao,
                Valor = 100m,
                DataOcorrencia = data,
                FormaPagamento = "Pix"
            },
            usuarioId);
    }
}
