using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos;
using SistemaFinanceiro.Api.Dtos.Dashboard;
using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Dashboard;
using SistemaFinanceiro.Api.Services.Transacoes;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class DashboardServiceTests
{
    private static int _codigoExibicao;

    [Fact]
    public async Task GetInicioAsync_SaldoAtualIgnoraReceitaFuturaEDespesaNaoPaga()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var conta = CriarConta(usuarioId, 1000m);
        database.Context.ContasBancarias.Add(conta);
        var transacoes = new[]
        {
            CriarTransacao(usuarioId, conta.Id, TipoTransacao.Despesa, 100m, hoje, isPaga: true),
            CriarTransacao(usuarioId, conta.Id, TipoTransacao.Receita, 500m, hoje.AddDays(5), isPaga: false),
            CriarTransacao(usuarioId, conta.Id, TipoTransacao.Despesa, 200m, hoje.AddDays(6), isPaga: false)
        };
        database.Context.Transacoes.AddRange(transacoes);
        await database.Context.SaveChangesAsync();

        var service = CriarService(database.Context, transacoes.Select(MapearItem).ToList());

        var response = await service.GetInicioAsync(
            usuarioId,
            new DashboardInicioRequest
            {
                DataInicial = new DateOnly(hoje.Year, hoje.Month, 1),
                DataFinal = new DateOnly(hoje.Year, hoje.Month, 1).AddMonths(1).AddDays(-1)
            });

        Assert.Equal(900m, response.SaldoAtual);
        Assert.Equal(500m, response.ReceitasPendentesNoPeriodo);
        Assert.Equal(200m, response.DespesasEmAberto);
        Assert.Equal(700m, response.SaldoPrevistoFimDoPeriodo);
    }

    [Fact]
    public async Task GetInicioAsync_MesPassadoCriaEReutilizaFechamentoMensal()
    {
        var usuarioId = Guid.NewGuid();
        using var database = new SqliteTestDatabase(usuarioId);
        await SeedUsuarioAsync(database.Context, usuarioId);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var mesPassado = new DateOnly(hoje.Year, hoje.Month, 1).AddMonths(-1);
        var fimMesPassado = mesPassado.AddMonths(1).AddDays(-1);
        var conta = CriarConta(usuarioId, 1000m);
        database.Context.ContasBancarias.Add(conta);
        database.Context.Transacoes.Add(
            CriarTransacao(usuarioId, conta.Id, TipoTransacao.Despesa, 100m, mesPassado.AddDays(4), isPaga: true));
        await database.Context.SaveChangesAsync();

        var service = CriarService(
            database.Context,
            database.Context.Transacoes.Local.Select(MapearItem).ToList());
        var request = new DashboardInicioRequest
        {
            DataInicial = mesPassado,
            DataFinal = fimMesPassado
        };

        var primeiroResumo = await service.GetInicioAsync(usuarioId, request);

        database.Context.Transacoes.Add(
            CriarTransacao(usuarioId, conta.Id, TipoTransacao.Despesa, 50m, mesPassado.AddDays(5), isPaga: true));
        await database.Context.SaveChangesAsync();

        var segundoResumo = await service.GetInicioAsync(usuarioId, request);

        Assert.Equal("Passado", primeiroResumo.ContextoPeriodo);
        Assert.Equal(900m, primeiroResumo.SaldoAtual);
        Assert.Equal(900m, segundoResumo.SaldoAtual);
        Assert.Single(database.Context.FechamentosMensaisSaldo);
    }

    private static DashboardService CriarService(
        AppDbContext context,
        IReadOnlyList<ExtratoMensalItemResponse> itens)
    {
        return new DashboardService(context, new StubTransacaoService(itens));
    }

    private static ContaBancaria CriarConta(Guid usuarioId, decimal saldoInicial)
    {
        return new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Conta principal",
            CodigoBanco = "001",
            SaldoInicial = saldoInicial
        };
    }

    private static Transacao CriarTransacao(
        Guid usuarioId,
        Guid contaId,
        TipoTransacao tipo,
        decimal valor,
        DateOnly data,
        bool isPaga)
    {
        return new Transacao
        {
            UsuarioId = usuarioId,
            CodigoExibicao = Interlocked.Increment(ref _codigoExibicao),
            Tipo = tipo,
            Descricao = $"{tipo} {valor}",
            Valor = valor,
            DataOcorrencia = data,
            FormaPagamento = "Pix",
            ContaBancariaId = contaId,
            IsPaga = isPaga,
            OrigemTransacao = OrigemTransacao.Lancamento
        };
    }

    private static async Task SeedUsuarioAsync(AppDbContext context, Guid usuarioId)
    {
        context.Usuarios.Add(new Usuario
        {
            Id = usuarioId,
            Nome = "Usuário Teste",
            Email = $"{usuarioId:N}@teste.local",
            SenhaHash = "hash"
        });

        await context.SaveChangesAsync();
    }

    private static ExtratoMensalItemResponse MapearItem(Transacao transacao)
    {
        return new ExtratoMensalItemResponse
        {
            Id = transacao.Id,
            CodigoExibicao = transacao.CodigoExibicao,
            Tipo = transacao.Tipo,
            Descricao = transacao.Descricao,
            Valor = transacao.Valor,
            DataOcorrencia = transacao.DataOcorrencia,
            FormaPagamento = transacao.FormaPagamento,
            ContaBancariaId = transacao.ContaBancariaId,
            IsPaga = transacao.IsPaga,
            Origem = "Transacao",
            OrigemTransacao = transacao.OrigemTransacao,
            CategoriaNome = "Sem categoria",
            CategoriaCorHexa = "#64748B"
        };
    }

    private sealed class StubTransacaoService : ITransacaoService
    {
        private readonly IReadOnlyList<ExtratoMensalItemResponse> _itens;

        public StubTransacaoService(IReadOnlyList<ExtratoMensalItemResponse> itens)
        {
            _itens = itens;
        }

        public Task<PagedResponse<ExtratoMensalItemResponse>> GetExtratoMensalPaginadoAsync(
            ExtratoPaginadoRequest request,
            Guid usuarioId,
            CancellationToken cancellationToken = default)
        {
            var itens = _itens
                .Where(item =>
                    (!request.DataInicial.HasValue || item.DataOcorrencia >= request.DataInicial.Value) &&
                    (!request.DataFinal.HasValue || item.DataOcorrencia <= request.DataFinal.Value) &&
                    (!request.Tipo.HasValue || item.Tipo == request.Tipo.Value))
                .OrderBy(item => item.DataOcorrencia)
                .ToList();
            var pageSize = Math.Clamp(request.PageSize, 1, 100);
            var pageNumber = Math.Max(1, request.PageNumber);

            return Task.FromResult(new PagedResponse<ExtratoMensalItemResponse>
            {
                Items = itens.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList(),
                TotalCount = itens.Count,
                CurrentPage = pageNumber,
                PageSize = pageSize,
                TotalPages = itens.Count == 0 ? 0 : (int)Math.Ceiling(itens.Count / (decimal)pageSize)
            });
        }

        public Task<ExtratoMensalResponse> GetExtratoMensalAsync(int mes, int ano, Guid usuarioId, bool? apenasDivididas = null, StatusFiltro? status = null, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<IReadOnlyList<FaturaConsolidadaResponse>> GetFaturasDoMesAsync(int mes, int ano, Guid usuarioId, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<Guid> CriarAsync(CriarTransacaoRequest request, Guid usuarioId, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<Guid?> AtualizarAsync(Guid id, CriarTransacaoRequest request, Guid usuarioId, bool replicarFuturas = true, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<IReadOnlyList<TransacaoResponse>> AnteciparParcelaAsync(AnteciparParcelaRequest request, Guid usuarioId, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<bool> ExcluirAsync(Guid id, Guid usuarioId, DateOnly? dataOcorrencia = null, bool replicarFuturas = true, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<bool?> AlternarStatusPagamentoAsync(Guid id, Guid usuarioId, DateOnly? dataOcorrencia = null, AlterarStatusPagamentoRequest? request = null, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<bool?> AlternarStatusFaturaAsync(Guid cartaoCreditoId, DateOnly dataVencimento, Guid usuarioId, PagarFaturaRequest? request = null, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }
}
