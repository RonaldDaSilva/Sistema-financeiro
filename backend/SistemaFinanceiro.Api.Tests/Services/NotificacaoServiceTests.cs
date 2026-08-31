using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Dtos.Notificacoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Notificacoes;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class NotificacaoServiceTests
{
    [Fact]
    public async Task ListarAsync_AplicaPaginacaoEFiltrosSemMisturarUsuarios()
    {
        var usuarioId = Guid.NewGuid();
        var outroUsuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await CriarUsuariosAsync(database, usuarioId, outroUsuarioId);
        database.Context.Notificacoes.AddRange(
            CriarNotificacao(usuarioId, TipoNotificacao.DivisaoRecebida, false, "ResponderDivisao", 3),
            CriarNotificacao(usuarioId, TipoNotificacao.DivisaoAceita, true, null, 2),
            CriarNotificacao(usuarioId, TipoNotificacao.Vencimento, false, null, 1),
            CriarNotificacao(outroUsuarioId, TipoNotificacao.DivisaoRecebida, false, "ResponderDivisao", 4));
        await database.Context.SaveChangesAsync();
        var service = new NotificacaoService(database.Context);

        var pendentes = await service.ListarAsync(usuarioId, new ListarNotificacoesRequest
        {
            Filtro = "Pendentes",
            Categoria = "Divisoes",
            Pagina = 1,
            TamanhoPagina = 1
        });

        var item = Assert.Single(pendentes.Itens);
        Assert.Equal(1, pendentes.TotalItens);
        Assert.Equal("Pendente", item.StatusAcao);
        Assert.Equal(usuarioId, database.Context.Notificacoes.IgnoreQueryFilters()
            .Single(notificacao => notificacao.Id == item.Id).UsuarioId);

        var concluidas = await service.ListarAsync(usuarioId, new ListarNotificacoesRequest
        {
            Filtro = "Concluidas"
        });
        Assert.Single(concluidas.Itens);
        Assert.Equal("Concluida", concluidas.Itens[0].StatusAcao);
        Assert.Equal(TipoNotificacao.DivisaoAceita, concluidas.Itens[0].TipoNotificacao);
    }

    [Fact]
    public async Task MarcarComoLidaAsync_AlteraSomenteNotificacaoDoUsuario()
    {
        var usuarioId = Guid.NewGuid();
        var outroUsuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await CriarUsuariosAsync(database, usuarioId, outroUsuarioId);
        var propria = CriarNotificacao(usuarioId, TipoNotificacao.DivisaoRecebida, false, "ResponderDivisao", 2);
        var alheia = CriarNotificacao(outroUsuarioId, TipoNotificacao.DivisaoRecebida, false, "ResponderDivisao", 1);
        database.Context.Notificacoes.AddRange(propria, alheia);
        await database.Context.SaveChangesAsync();
        var service = new NotificacaoService(database.Context);

        Assert.True(await service.MarcarComoLidaAsync(usuarioId, propria.Id));
        Assert.False(await service.MarcarComoLidaAsync(usuarioId, alheia.Id));

        database.Context.ChangeTracker.Clear();
        var registros = await database.Context.Notificacoes.IgnoreQueryFilters().ToListAsync();
        Assert.True(registros.Single(item => item.Id == propria.Id).Lida);
        Assert.False(registros.Single(item => item.Id == alheia.Id).Lida);
    }

    [Fact]
    public async Task GetNaoLidasAsync_LimitaDropdownAsDezMaisRecentes()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await CriarUsuariosAsync(database, usuarioId);
        database.Context.Notificacoes.AddRange(Enumerable.Range(1, 12).Select(indice =>
            CriarNotificacao(usuarioId, TipoNotificacao.Vencimento, false, null, indice)));
        await database.Context.SaveChangesAsync();
        var service = new NotificacaoService(database.Context);

        var recentes = await service.GetNaoLidasAsync(usuarioId);

        Assert.Equal(10, recentes.Count);
        Assert.Equal(10, recentes.Select(item => item.Id).Distinct().Count());
    }

    private static async Task CriarUsuariosAsync(
        SqliteTestDatabase database,
        params Guid[] ids)
    {
        database.Context.Usuarios.AddRange(ids.Select((id, indice) => new Usuario
        {
            Id = id,
            Nome = $"Usuário {indice + 1}",
            Email = $"usuario{indice + 1}@teste.local",
            SenhaHash = "hash"
        }));
        await database.Context.SaveChangesAsync();
    }

    private static Notificacao CriarNotificacao(
        Guid usuarioId,
        TipoNotificacao tipo,
        bool lida,
        string? acaoPendente,
        int ordem)
    {
        return new Notificacao
        {
            UsuarioId = usuarioId,
            TipoNotificacao = tipo,
            Titulo = $"Notificação {ordem}",
            Mensagem = "Mensagem",
            Lida = lida,
            AcaoPendente = acaoPendente,
            Entidade = tipo >= TipoNotificacao.DivisaoRecebida ? "DivisaoTransacao" : null,
            DataCriacao = new DateTimeOffset(2026, 8, ordem, 12, 0, 0, TimeSpan.Zero)
        };
    }
}
