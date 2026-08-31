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

    [Theory]
    [InlineData("asc", "Pendente 01", "Pendente 05", "Pendente 10", "Paga 02", "Paga 08", "Paga 12")]
    [InlineData("desc", "Pendente 10", "Pendente 05", "Pendente 01", "Paga 12", "Paga 08", "Paga 02")]
    public async Task GetExtratoMensalPaginadoAsync_AgrupaPorStatusAntesDeOrdenarPorData(
        string direcao,
        params string[] ordemEsperada)
    {
        var (database, usuarioId, service) = await CriarCenarioOrdenacaoAsync();
        using (database)
        {
            var resultado = await service.GetExtratoMensalPaginadoAsync(
                CriarRequestOrdenacao(direcao, pageSize: 10),
                usuarioId);

            Assert.Equal(ordemEsperada, resultado.Items.Select(item => item.Descricao));
            Assert.Equal([false, false, false, true, true, true],
                resultado.Items.Select(item => item.IsPaga));
        }
    }

    [Fact]
    public async Task GetExtratoMensalPaginadoAsync_AplicaStatusAntesDaPaginacao()
    {
        var (database, usuarioId, service) = await CriarCenarioOrdenacaoAsync();
        using (database)
        {
            var primeiraPagina = await service.GetExtratoMensalPaginadoAsync(
                CriarRequestOrdenacao("asc", pageSize: 5),
                usuarioId);
            var segundaPagina = await service.GetExtratoMensalPaginadoAsync(
                CriarRequestOrdenacao("asc", pageNumber: 2, pageSize: 5),
                usuarioId);

            Assert.Equal(3, primeiraPagina.Items.Count(item => !item.IsPaga));
            Assert.True(primeiraPagina.Items.Take(3).All(item => !item.IsPaga));
            Assert.All(segundaPagina.Items, item => Assert.True(item.IsPaga));
        }
    }

    [Theory]
    [InlineData(StatusFiltro.Pagas, true)]
    [InlineData(StatusFiltro.Pendentes, false)]
    public async Task GetExtratoMensalPaginadoAsync_PreservaOrdenacaoEmFiltroDeStatus(
        StatusFiltro status,
        bool isPagaEsperada)
    {
        var (database, usuarioId, service) = await CriarCenarioOrdenacaoAsync();
        using (database)
        {
            var request = CriarRequestOrdenacao("asc", pageSize: 10);
            request.Statuses = [status];

            var resultado = await service.GetExtratoMensalPaginadoAsync(request, usuarioId);

            Assert.Equal(2, resultado.Items.Count);
            Assert.All(resultado.Items, item => Assert.Equal(isPagaEsperada, item.IsPaga));
            Assert.True(resultado.Items.Select(item => item.DataOcorrencia).SequenceEqual(
                resultado.Items.Select(item => item.DataOcorrencia).OrderBy(data => data)));
        }
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

    private static async Task<(SqliteTestDatabase Database, Guid UsuarioId, TransacaoService Service)>
        CriarCenarioOrdenacaoAsync()
    {
        var usuarioId = Guid.NewGuid();
        var database = new SqliteTestDatabase(usuarioId);
        database.Context.Usuarios.Add(new Usuario
        {
            Id = usuarioId,
            Nome = "Usuário ordenação",
            Email = $"{usuarioId:N}@ordenacao.local",
            SenhaHash = "hash"
        });
        database.Context.Transacoes.AddRange(
            CriarTransacao(usuarioId, "Pendente 01", 1, false, TipoTransacao.Receita),
            CriarTransacao(usuarioId, "Paga 02", 2, true),
            CriarTransacao(usuarioId, "Pendente 05", 5, false),
            CriarTransacao(usuarioId, "Paga 08", 8, true),
            CriarTransacao(usuarioId, "Pendente 10", 10, false),
            CriarTransacao(usuarioId, "Paga 12", 12, true, TipoTransacao.Receita));
        await database.Context.SaveChangesAsync();
        return (database, usuarioId, new TransacaoService(database.Context));
    }

    private static Transacao CriarTransacao(
        Guid usuarioId,
        string descricao,
        int dia,
        bool isPaga,
        TipoTransacao tipo = TipoTransacao.Despesa)
    {
        return new Transacao
        {
            UsuarioId = usuarioId,
            Tipo = tipo,
            Descricao = descricao,
            Valor = dia * 10m,
            DataOcorrencia = new DateOnly(2026, 9, dia),
            FormaPagamento = "Pix",
            CodigoExibicao = dia,
            IsPaga = isPaga
        };
    }

    private static ExtratoPaginadoRequest CriarRequestOrdenacao(
        string direcao,
        int pageNumber = 1,
        int pageSize = 10)
    {
        return new ExtratoPaginadoRequest
        {
            Mes = 9,
            Ano = 2026,
            DataInicial = new DateOnly(2026, 9, 1),
            DataFinal = new DateOnly(2026, 9, 30),
            OrdenarPor = "data",
            Direcao = direcao,
            PageNumber = pageNumber,
            PageSize = pageSize
        };
    }
}
