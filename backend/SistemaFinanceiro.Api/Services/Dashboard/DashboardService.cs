using SistemaFinanceiro.Api.Dtos.Dashboard;
using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Transacoes;

namespace SistemaFinanceiro.Api.Services.Dashboard;

public sealed class DashboardService : IDashboardService
{
    private readonly ITransacaoService _transacaoService;

    public DashboardService(ITransacaoService transacaoService)
    {
        _transacaoService = transacaoService;
    }

    public async Task<DashboardInicioDto> GetInicioAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var inicioMes = new DateOnly(hoje.Year, hoje.Month, 1);
        var fimMes = inicioMes.AddMonths(1).AddDays(-1);
        var limiteProximosSeteDias = hoje.AddDays(7);

        var extratoMesAtual = await _transacaoService.GetExtratoMensalAsync(
            hoje.Month,
            hoje.Year,
            usuarioId,
            cancellationToken: cancellationToken);

        var itensOperacionais = extratoMesAtual.Itens
            .Where(item =>
                item.DataOcorrencia < hoje ||
                item.DataOcorrencia <= limiteProximosSeteDias)
            .ToList();

        if (limiteProximosSeteDias > fimMes)
        {
            var proximoMes = inicioMes.AddMonths(1);
            var extratoProximoMes = await _transacaoService.GetExtratoMensalAsync(
                proximoMes.Month,
                proximoMes.Year,
                usuarioId,
                cancellationToken: cancellationToken);

            itensOperacionais.AddRange(extratoProximoMes.Itens
                .Where(item =>
                    item.DataOcorrencia >= proximoMes &&
                    item.DataOcorrencia <= limiteProximosSeteDias));
        }

        var itensMes = extratoMesAtual.Itens
            .Where(item =>
                item.OrigemTransacao == OrigemTransacao.Lancamento &&
                item.DataOcorrencia >= inicioMes &&
                item.DataOcorrencia <= fimMes)
            .ToList();

        var receitasRealizadasMes = itensMes
            .Where(item =>
                item.Tipo == TipoTransacao.Receita &&
                item.DataOcorrencia <= hoje)
            .Sum(item => item.Valor);

        var despesasRealizadasMes = itensMes
            .Where(item =>
                item.Tipo == TipoTransacao.Despesa &&
                item.IsPaga)
            .Sum(item => item.Valor);

        var investimentosRealizadosMes = itensMes
            .Where(item =>
                item.Tipo == TipoTransacao.Investimento &&
                item.IsPaga)
            .Sum(item => item.Valor);

        var balancoRealizadoMes =
            receitasRealizadasMes - despesasRealizadasMes - investimentosRealizadosMes;

        var pendencias = itensOperacionais
            .Where(item =>
                item.OrigemTransacao == OrigemTransacao.Lancamento &&
                !item.IsPaga &&
                (item.Tipo != TipoTransacao.Receita || item.DataOcorrencia > hoje))
            .ToList();

        var receitasPendentesMes = pendencias
            .Where(item =>
                item.Tipo == TipoTransacao.Receita &&
                item.DataOcorrencia >= inicioMes &&
                item.DataOcorrencia <= fimMes)
            .Sum(item => item.Valor);

        var despesasPendentesMes = pendencias
            .Where(item =>
                item.Tipo == TipoTransacao.Despesa &&
                item.DataOcorrencia >= inicioMes &&
                item.DataOcorrencia <= fimMes)
            .Sum(item => item.Valor);

        var investimentosPendentesMes = pendencias
            .Where(item =>
                item.Tipo == TipoTransacao.Investimento &&
                item.DataOcorrencia >= inicioMes &&
                item.DataOcorrencia <= fimMes)
            .Sum(item => item.Valor);

        var saldoAtual = extratoMesAtual.SaldoAtualGlobal;
        var saldoPrevistoFimDoMes =
            saldoAtual + receitasPendentesMes - despesasPendentesMes - investimentosPendentesMes;
        var livreParaGastar = saldoAtual + receitasPendentesMes - despesasPendentesMes;

        var proximosLancamentos = pendencias
            .OrderBy(item => item.DataOcorrencia)
            .ThenBy(item => item.Descricao)
            .Take(5)
            .Select(MapearLancamento)
            .ToList();

        var insights = GerarInsights(
            pendencias,
            hoje,
            limiteProximosSeteDias,
            livreParaGastar);

        return new DashboardInicioDto
        {
            SaldoAtual = saldoAtual,
            ReceitasRealizadasNoMes = receitasRealizadasMes,
            DespesasRealizadasNoMes = despesasRealizadasMes,
            InvestimentosRealizadosNoMes = investimentosRealizadosMes,
            BalancoRealizadoNoMes = balancoRealizadoMes,
            ReceitasPendentesNoMes = receitasPendentesMes,
            DespesasPendentesNoMes = despesasPendentesMes,
            SaldoPrevistoFimDoMes = saldoPrevistoFimDoMes,
            LivreParaGastar = livreParaGastar,
            DespesasAPagar = despesasPendentesMes,
            ProximosLancamentos = proximosLancamentos,
            Insights = insights
        };
    }

    private static IReadOnlyList<string> GerarInsights(
        IReadOnlyList<ExtratoMensalItemResponse> pendencias,
        DateOnly hoje,
        DateOnly limiteProximosSeteDias,
        decimal livreParaGastar)
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

        if (livreParaGastar < 0)
        {
            insights.Add(
                "Aviso crítico: Suas despesas previstas superam sua receita e saldo atual.");
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

}
