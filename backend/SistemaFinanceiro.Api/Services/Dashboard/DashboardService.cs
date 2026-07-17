using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Dashboard;
using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Transacoes;

namespace SistemaFinanceiro.Api.Services.Dashboard;

public sealed class DashboardService : IDashboardService
{
    private const int PageSizeResumo = 100;
    private const string VersaoRegraFechamento = "dashboard-v1";

    private readonly AppDbContext _dbContext;
    private readonly ITransacaoService _transacaoService;

    public DashboardService(AppDbContext dbContext, ITransacaoService transacaoService)
    {
        _dbContext = dbContext;
        _transacaoService = transacaoService;
    }

    public async Task<DashboardInicioDto> GetInicioAsync(
        Guid usuarioId,
        DashboardInicioRequest request,
        CancellationToken cancellationToken = default)
    {
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var (inicioPeriodo, fimPeriodo) = NormalizarPeriodo(request, hoje);
        var contextoPeriodo = ObterContextoPeriodo(inicioPeriodo, fimPeriodo, hoje);
        var temFiltroAnalitico = TemFiltroAnalitico(request);

        var itensPeriodo = await ObterItensFiltradosAsync(
            usuarioId,
            request,
            inicioPeriodo,
            fimPeriodo,
            cancellationToken);

        var saldoAtual = await ObterSaldoReferenciaAsync(
            usuarioId,
            inicioPeriodo,
            fimPeriodo,
            contextoPeriodo,
            hoje,
            cancellationToken);

        var itensFinanceiros = itensPeriodo
            .Where(item => item.OrigemTransacao == OrigemTransacao.Lancamento)
            .ToList();

        var realizados = itensFinanceiros
            .Where(item => ItemRealizado(item, hoje))
            .ToList();

        var receitasRealizadas = realizados
            .Where(item => item.Tipo == TipoTransacao.Receita)
            .Sum(item => item.Valor);

        var despesasRealizadas = realizados
            .Where(item => item.Tipo == TipoTransacao.Despesa)
            .Sum(item => item.Valor);

        var investimentosRealizados = realizados
            .Where(item => item.Tipo == TipoTransacao.Investimento)
            .Sum(item => item.Valor);

        var pendencias = itensFinanceiros
            .Where(item => !item.IsPaga)
            .ToList();

        var receitasPendentes = pendencias
            .Where(item => item.Tipo == TipoTransacao.Receita)
            .Sum(item => item.Valor);

        var despesasPendentes = pendencias
            .Where(item => item.Tipo == TipoTransacao.Despesa)
            .Sum(item => item.Valor);

        var investimentosPendentes = pendencias
            .Where(item => item.Tipo == TipoTransacao.Investimento)
            .Sum(item => item.Valor);

        var despesasEmAberto = despesasPendentes + investimentosPendentes;
        var saldoPrevistoFimDoPeriodo = saldoAtual - despesasEmAberto;

        var limiteProximosSeteDias = hoje.AddDays(7);
        var proximosLancamentos = await ObterProximosLancamentosAsync(
            usuarioId,
            request,
            hoje,
            limiteProximosSeteDias,
            cancellationToken);

        var insights = GerarInsights(
            proximosLancamentos,
            hoje,
            limiteProximosSeteDias,
            saldoPrevistoFimDoPeriodo);

        return new DashboardInicioDto
        {
            SaldoAtual = saldoAtual,
            ReceitasRealizadasNoPeriodo = receitasRealizadas,
            DespesasRealizadasNoPeriodo = despesasRealizadas,
            InvestimentosRealizadosNoPeriodo = investimentosRealizados,
            BalancoRealizadoNoPeriodo =
                receitasRealizadas - despesasRealizadas - investimentosRealizados,
            ReceitasPendentesNoPeriodo = receitasPendentes,
            DespesasPendentesNoPeriodo = despesasPendentes,
            InvestimentosPendentesNoPeriodo = investimentosPendentes,
            DespesasEmAberto = despesasEmAberto,
            SaldoPrevistoFimDoPeriodo = saldoPrevistoFimDoPeriodo,
            TemFiltroAnalitico = temFiltroAnalitico,
            ContextoPeriodo = contextoPeriodo,
            ProximosLancamentos = proximosLancamentos,
            Insights = insights
        };
    }

    private async Task<IReadOnlyList<ExtratoMensalItemResponse>> ObterItensFiltradosAsync(
        Guid usuarioId,
        DashboardInicioRequest filtro,
        DateOnly inicioPeriodo,
        DateOnly fimPeriodo,
        CancellationToken cancellationToken)
    {
        var todos = new List<ExtratoMensalItemResponse>();
        var pageNumber = 1;
        var totalPages = 1;

        do
        {
            var response = await _transacaoService.GetExtratoMensalPaginadoAsync(
                CriarRequestExtrato(filtro, inicioPeriodo, fimPeriodo, pageNumber),
                usuarioId,
                cancellationToken);

            todos.AddRange(response.Items);
            totalPages = Math.Max(1, response.TotalPages);
            pageNumber++;
        }
        while (pageNumber <= totalPages);

        return todos;
    }

    private async Task<IReadOnlyList<DashboardLancamentoDto>> ObterProximosLancamentosAsync(
        Guid usuarioId,
        DashboardInicioRequest filtro,
        DateOnly hoje,
        DateOnly limiteProximosSeteDias,
        CancellationToken cancellationToken)
    {
        var itens = await ObterItensFiltradosAsync(
            usuarioId,
            filtro,
            hoje.AddMonths(-1),
            limiteProximosSeteDias,
            cancellationToken);

        return itens
            .Where(item =>
                item.OrigemTransacao == OrigemTransacao.Lancamento &&
                !item.IsPaga &&
                item.Tipo != TipoTransacao.Receita)
            .OrderBy(item => item.DataOcorrencia)
            .ThenBy(item => item.Descricao)
            .Take(5)
            .Select(MapearLancamento)
            .ToList();
    }

    private async Task<decimal> ObterSaldoReferenciaAsync(
        Guid usuarioId,
        DateOnly inicioPeriodo,
        DateOnly fimPeriodo,
        string contextoPeriodo,
        DateOnly hoje,
        CancellationToken cancellationToken)
    {
        if (contextoPeriodo == "Passado" && EhMesCompleto(inicioPeriodo, fimPeriodo))
        {
            var fechamento = await ObterOuCriarFechamentoMensalAsync(
                usuarioId,
                inicioPeriodo.Year,
                inicioPeriodo.Month,
                fimPeriodo,
                cancellationToken);

            return fechamento.SaldoGlobal;
        }

        var dataReferencia = contextoPeriodo == "Passado" ? fimPeriodo : hoje;
        return await CalcularSaldoContasAsync(usuarioId, dataReferencia, contextoPeriodo, cancellationToken);
    }

    private async Task<FechamentoMensalSaldo> ObterOuCriarFechamentoMensalAsync(
        Guid usuarioId,
        int ano,
        int mes,
        DateOnly dataFechamento,
        CancellationToken cancellationToken)
    {
        var existente = await _dbContext.FechamentosMensaisSaldo
            .Include(fechamento => fechamento.Contas)
            .FirstOrDefaultAsync(
                fechamento =>
                    fechamento.UsuarioId == usuarioId &&
                    fechamento.Ano == ano &&
                    fechamento.Mes == mes,
                cancellationToken);

        if (existente is not null)
        {
            return existente;
        }

        var saldosContas = await CalcularSaldosPorContaAsync(
            usuarioId,
            dataFechamento,
            "Passado",
            cancellationToken);

        var fechamentoMensal = new FechamentoMensalSaldo
        {
            UsuarioId = usuarioId,
            Ano = ano,
            Mes = mes,
            DataFechamento = dataFechamento,
            SaldoGlobal = saldosContas.Sum(item => item.Saldo),
            VersaoRegra = VersaoRegraFechamento,
            Status = "Fechado",
            Observacao = "Fechamento gerado automaticamente na primeira consulta do mês encerrado.",
            Contas = saldosContas
                .Select(item => new FechamentoMensalConta
                {
                    ContaBancariaId = item.ContaBancariaId,
                    Saldo = item.Saldo
                })
                .ToList()
        };

        _dbContext.FechamentosMensaisSaldo.Add(fechamentoMensal);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return fechamentoMensal;
    }

    private async Task<decimal> CalcularSaldoContasAsync(
        Guid usuarioId,
        DateOnly dataReferencia,
        string contextoPeriodo,
        CancellationToken cancellationToken)
    {
        var saldos = await CalcularSaldosPorContaAsync(
            usuarioId,
            dataReferencia,
            contextoPeriodo,
            cancellationToken);

        return saldos.Sum(item => item.Saldo);
    }

    private async Task<IReadOnlyList<SaldoContaCalculado>> CalcularSaldosPorContaAsync(
        Guid usuarioId,
        DateOnly dataReferencia,
        string contextoPeriodo,
        CancellationToken cancellationToken)
    {
        var contas = await _dbContext.ContasBancarias
            .AsNoTracking()
            .Where(conta => conta.UsuarioId == usuarioId)
            .Select(conta => new SaldoContaCalculado(conta.Id, conta.SaldoInicial))
            .ToListAsync(cancellationToken);

        var query = _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.ContaBancariaId.HasValue &&
                transacao.IsPaga);

        if (contextoPeriodo == "Passado")
        {
            query = query.Where(transacao => transacao.DataOcorrencia <= dataReferencia);
        }

        var movimentos = await query
            .Select(transacao => new
            {
                ContaBancariaId = transacao.ContaBancariaId!.Value,
                transacao.Tipo,
                transacao.Valor
            })
            .ToListAsync(cancellationToken);

        var saldosMovimentos = movimentos
            .GroupBy(transacao => transacao.ContaBancariaId)
            .Select(grupo => new
            {
                ContaBancariaId = grupo.Key,
                Saldo = grupo.Sum(transacao =>
                    transacao.Tipo == TipoTransacao.Receita
                        ? transacao.Valor
                        : -transacao.Valor)
            })
            .ToList();

        return contas
            .GroupJoin(
                saldosMovimentos,
                conta => conta.ContaBancariaId,
                movimento => movimento.ContaBancariaId,
                (conta, movimentosConta) => conta with
                {
                    Saldo = conta.Saldo + movimentosConta.Sum(movimento => movimento.Saldo)
                })
            .ToList();
    }

    private static ExtratoPaginadoRequest CriarRequestExtrato(
        DashboardInicioRequest filtro,
        DateOnly inicioPeriodo,
        DateOnly fimPeriodo,
        int pageNumber)
    {
        return new ExtratoPaginadoRequest
        {
            Mes = inicioPeriodo.Month,
            Ano = inicioPeriodo.Year,
            DataInicial = inicioPeriodo,
            DataFinal = fimPeriodo,
            Tipo = filtro.Tipo,
            CategoriaId = filtro.CategoriaId,
            CategoriaIds = filtro.CategoriaIds,
            Status = filtro.Status,
            Statuses = filtro.Statuses,
            OrdenarPor = "data",
            Direcao = "asc",
            PageNumber = pageNumber,
            PageSize = PageSizeResumo
        };
    }

    private static (DateOnly Inicio, DateOnly Fim) NormalizarPeriodo(
        DashboardInicioRequest request,
        DateOnly hoje)
    {
        var inicioMesAtual = new DateOnly(hoje.Year, hoje.Month, 1);
        var fimMesAtual = inicioMesAtual.AddMonths(1).AddDays(-1);
        var inicio = request.DataInicial ?? inicioMesAtual;
        var fim = request.DataFinal ?? fimMesAtual;

        return fim < inicio
            ? (fim, inicio)
            : (inicio, fim);
    }

    private static string ObterContextoPeriodo(
        DateOnly inicioPeriodo,
        DateOnly fimPeriodo,
        DateOnly hoje)
    {
        if (fimPeriodo < hoje)
        {
            return "Passado";
        }

        if (inicioPeriodo > hoje)
        {
            return "Futuro";
        }

        return "Atual";
    }

    private static bool EhMesCompleto(DateOnly inicio, DateOnly fim)
    {
        return inicio.Day == 1 &&
            inicio.Year == fim.Year &&
            inicio.Month == fim.Month &&
            fim == inicio.AddMonths(1).AddDays(-1);
    }

    private static bool TemFiltroAnalitico(DashboardInicioRequest request)
    {
        return request.Tipo.HasValue ||
            request.CategoriaId.HasValue ||
            request.CategoriaIds.Count > 0 ||
            request.Status.HasValue ||
            request.Statuses.Count > 0;
    }

    private static bool ItemRealizado(ExtratoMensalItemResponse item, DateOnly hoje)
    {
        return item.Tipo == TipoTransacao.Receita
            ? item.IsPaga || item.DataOcorrencia <= hoje
            : item.IsPaga;
    }

    private static IReadOnlyList<string> GerarInsights(
        IReadOnlyList<DashboardLancamentoDto> pendencias,
        DateOnly hoje,
        DateOnly limiteProximosSeteDias,
        decimal saldoPrevisto)
    {
        var insights = new List<string>();

        var despesasAtrasadas = pendencias
            .Where(item =>
                item.Tipo == TipoTransacao.Despesa &&
                item.DataOcorrencia < hoje)
            .ToList();

        if (despesasAtrasadas.Count > 0)
        {
            insights.Add(
                $"Atenção: Você possui {despesasAtrasadas.Count} lançamentos atrasados somando {FormatarMoeda(despesasAtrasadas.Sum(item => item.Valor))}.");
        }

        var despesasProximosSeteDias = pendencias
            .Where(item =>
                item.Tipo == TipoTransacao.Despesa &&
                item.DataOcorrencia >= hoje &&
                item.DataOcorrencia <= limiteProximosSeteDias)
            .Sum(item => item.Valor);

        if (despesasProximosSeteDias > 0)
        {
            insights.Add(
                $"Você tem {FormatarMoeda(despesasProximosSeteDias)} em contas vencendo nos próximos 7 dias.");
        }

        if (saldoPrevisto < 0)
        {
            insights.Add(
                "Aviso crítico: suas despesas em aberto superam o saldo disponível nas contas.");
        }

        return insights;
    }

    private static DashboardLancamentoDto MapearLancamento(ExtratoMensalItemResponse item)
    {
        var inicio = new DateOnly(item.DataOcorrencia.Year, item.DataOcorrencia.Month, 1);
        var fim = inicio.AddMonths(1).AddDays(-1);
        var filtrosDestino = new Dictionary<string, string>
        {
            ["inicio"] = inicio.ToString("yyyy-MM-dd"),
            ["fim"] = fim.ToString("yyyy-MM-dd"),
            ["highlight"] = ConstruirChaveDestaque(item)
        };

        if (item.Tipo == TipoTransacao.Receita)
        {
            filtrosDestino["tipo"] = "receita";
        }
        else if (item.Tipo == TipoTransacao.Despesa)
        {
            filtrosDestino["tipo"] = "despesa";
        }
        else if (item.Tipo == TipoTransacao.Investimento)
        {
            filtrosDestino["tipo"] = "investimento";
        }

        if (item.CategoriaId.HasValue)
        {
            filtrosDestino["categoria"] = item.CategoriaId.Value.ToString();
        }

        return new DashboardLancamentoDto
        {
            Id = item.Id,
            Tipo = item.Tipo,
            Descricao = item.Descricao,
            Valor = item.Valor,
            DataOcorrencia = item.DataOcorrencia,
            Competencia = $"{item.DataOcorrencia.Year:D4}-{item.DataOcorrencia.Month:D2}",
            StatusVisual = item.StatusVisual,
            CategoriaNome = string.IsNullOrWhiteSpace(item.CategoriaNome)
                ? "Sem categoria"
                : item.CategoriaNome,
            FormaPagamento = item.FormaPagamento,
            Grupo = item.DataOcorrencia < DateOnly.FromDateTime(DateTime.Today)
                ? "Vencido"
                : item.DataOcorrencia == DateOnly.FromDateTime(DateTime.Today)
                    ? "Hoje"
                    : "Proximo",
            TipoOrigem = item.Origem,
            OrigemId = item.Origem switch
            {
                "FaturaCartao" => item.CartaoCreditoId,
                "CompraParcelada" or "Carne" => item.CompraParceladaId,
                _ => item.Id
            },
            CartaoCreditoId = item.CartaoCreditoId,
            ContaBancariaId = item.ContaBancariaId,
            CompraParceladaId = item.CompraParceladaId,
            NumeroParcela = item.NumeroParcela,
            IsProjetada = item.IsProjetada,
            PodeLiquidar =
                !item.IsPaga &&
                (item.Id.HasValue ||
                 item.Origem == "FaturaCartao" ||
                 item.IsFixa ||
                 (item.CompraParceladaId.HasValue && item.NumeroParcela.HasValue)),
            RotaDestino = "/",
            FiltrosDestino = filtrosDestino
        };
    }

    private static string ConstruirChaveDestaque(ExtratoMensalItemResponse item)
    {
        var id = item.Id ??
            item.CompraParceladaId ??
            item.CartaoCreditoId;

        return string.Join("|", new[]
        {
            id?.ToString() ?? item.Descricao,
            item.DataOcorrencia.ToString("yyyy-MM-dd"),
            item.NumeroParcela?.ToString() ?? string.Empty,
            item.Origem
        });
    }

    private static string FormatarMoeda(decimal valor)
    {
        return valor.ToString("C", new System.Globalization.CultureInfo("pt-BR"));
    }

    private sealed record SaldoContaCalculado(Guid ContaBancariaId, decimal Saldo);
}
