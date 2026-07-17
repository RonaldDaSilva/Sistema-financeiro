using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Relatorios;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.ContasBancarias;

namespace SistemaFinanceiro.Api.Services.Relatorios;

public sealed class RelatorioService : IRelatorioService
{
    private const string FormaPagamentoFaturaCartao = "Pagamento de fatura";

    private readonly AppDbContext _dbContext;
    private readonly IContaBancariaService _contaBancariaService;

    public RelatorioService(AppDbContext dbContext, IContaBancariaService contaBancariaService)
    {
        _dbContext = dbContext;
        _contaBancariaService = contaBancariaService;
    }

    public async Task<RelatorioGraficosResponse> GetGraficosAsync(
        DateOnly dataInicial,
        DateOnly dataFinal,
        Guid usuarioId,
        Guid? contaBancariaId = null,
        Guid? cartaoCreditoId = null,
        IReadOnlyCollection<Guid>? categoriaIds = null,
        TipoTransacao? tipoTransacao = null,
        string? status = null,
        bool somenteRecorrentes = false,
        bool somenteParceladas = false,
        CancellationToken cancellationToken = default)
    {
        if (dataFinal < dataInicial)
        {
            throw new ArgumentOutOfRangeException(
                nameof(dataFinal),
                "A data final deve ser maior ou igual à data inicial.");
        }

        var inicioPeriodo = new DateOnly(dataInicial.Year, dataInicial.Month, 1);
        var fimPeriodo = new DateOnly(dataFinal.Year, dataFinal.Month, 1)
            .AddMonths(1)
            .AddDays(-1);
        var quantidadeMeses =
            ((fimPeriodo.Year - inicioPeriodo.Year) * 12) +
            fimPeriodo.Month -
            inicioPeriodo.Month +
            1;

        if (quantidadeMeses > 12)
        {
            throw new ArgumentOutOfRangeException(
                nameof(dataFinal),
                "O período do relatório deve ter no máximo 12 meses.");
        }

        var diasPeriodo = dataFinal.DayNumber - dataInicial.DayNumber + 1;
        var fimPeriodoAnterior = dataInicial.AddDays(-1);
        var inicioPeriodoAnterior = fimPeriodoAnterior.AddDays(-(diasPeriodo - 1));
        var hoje = DateOnly.FromDateTime(DateTime.Today);

        var transacoesPeriodo = await ObterTransacoesRelatorioAsync(
            usuarioId,
            dataInicial,
            dataFinal,
            contaBancariaId,
            cartaoCreditoId,
            categoriaIds,
            tipoTransacao,
            status,
            somenteRecorrentes,
            somenteParceladas,
            VisaoRelatorio.Consumo,
            cancellationToken);

        var transacoesPeriodoAnterior = await ObterTransacoesRelatorioAsync(
            usuarioId,
            inicioPeriodoAnterior,
            fimPeriodoAnterior,
            contaBancariaId,
            cartaoCreditoId,
            categoriaIds,
            tipoTransacao,
            status,
            somenteRecorrentes,
            somenteParceladas,
            VisaoRelatorio.Consumo,
            cancellationToken);

        var transacoesCaixaPeriodo = await ObterTransacoesRelatorioAsync(
            usuarioId,
            dataInicial,
            dataFinal,
            contaBancariaId,
            cartaoCreditoId,
            categoriaIds,
            tipoTransacao,
            status,
            somenteRecorrentes,
            somenteParceladas,
            VisaoRelatorio.Caixa,
            cancellationToken);

        var resumoAtual = CalcularResumo(transacoesPeriodo);
        var resumoAnterior = CalcularResumo(transacoesPeriodoAnterior);
        var despesasPorCategoria = CalcularDespesasPorCategoria(transacoesPeriodo);
        var totaisMensais = CalcularTotaisMensais(transacoesPeriodo, inicioPeriodo, fimPeriodo);
        var totaisMensaisCaixa = CalcularTotaisMensais(transacoesCaixaPeriodo, inicioPeriodo, fimPeriodo);
        var projecaoDiaria = CalcularProjecaoDiaria(transacoesCaixaPeriodo, dataInicial, dataFinal);
        var previstoRealizado = CalcularPrevistoRealizado(transacoesPeriodo, hoje);
        var inicioCompromissos = new DateOnly(hoje.Year, hoje.Month, 1);
        var horizonteMeses = Math.Clamp(quantidadeMeses, 6, 12);
        var fimCompromissos = inicioCompromissos.AddMonths(horizonteMeses).AddDays(-1);
        var transacoesCompromissos = await ObterTransacoesRelatorioAsync(
            usuarioId,
            inicioCompromissos,
            fimCompromissos,
            contaBancariaId,
            cartaoCreditoId,
            categoriaIds,
            tipoTransacao,
            status,
            somenteRecorrentes,
            somenteParceladas,
            VisaoRelatorio.Consumo,
            cancellationToken);
        var compromissosFuturos = CalcularCompromissosFuturos(
            transacoesCompromissos,
            inicioCompromissos,
            fimCompromissos);
        var disponivelAposCompromissos = await CalcularDisponivelAposCompromissosAsync(
            transacoesPeriodo,
            dataFinal,
            usuarioId,
            contaBancariaId,
            categoriaIds,
            cancellationToken);

        return new RelatorioGraficosResponse
        {
            Mes = fimPeriodo.Month,
            Ano = fimPeriodo.Year,
            DespesasPorCategoria = despesasPorCategoria,
            SaldoAnual = totaisMensais,
            SerieFluxo = totaisMensaisCaixa,
            Kpis = new RelatorioKpisResponse
            {
                Receitas = CriarComparativo(resumoAtual.Receitas, resumoAnterior.Receitas, "receita"),
                Despesas = CriarComparativo(resumoAtual.Despesas, resumoAnterior.Despesas, "despesa"),
                Investimentos = CriarComparativo(resumoAtual.Investimentos, resumoAnterior.Investimentos, "investimento"),
                ResultadoLiquido = CriarComparativo(resumoAtual.ResultadoLiquido, resumoAnterior.ResultadoLiquido, "resultado"),
                SaldoPrevistoFimPeriodo = CriarComparativo(resumoAtual.ResultadoLiquido, resumoAnterior.ResultadoLiquido, "resultado"),
                TaxaEconomia = CriarComparativo(
                    CalcularTaxaEconomia(resumoAtual.Receitas, resumoAtual.Despesas),
                    CalcularTaxaEconomia(resumoAnterior.Receitas, resumoAnterior.Despesas),
                    "taxa")
            },
            ProjecaoDiaria = projecaoDiaria,
            PrevistoVersusRealizado = previstoRealizado,
            EvolucaoMensal = totaisMensais,
            DisponivelAposCompromissos = disponivelAposCompromissos,
            CompromissosFuturos = compromissosFuturos
        };
    }

    private async Task<IReadOnlyList<TransacaoRelatorio>> ObterTransacoesRelatorioAsync(
        Guid usuarioId,
        DateOnly dataInicial,
        DateOnly dataFinal,
        Guid? contaBancariaId,
        Guid? cartaoCreditoId,
        IReadOnlyCollection<Guid>? categoriaIds,
        TipoTransacao? tipoTransacao,
        string? status,
        bool somenteRecorrentes,
        bool somenteParceladas,
        VisaoRelatorio visao,
        CancellationToken cancellationToken)
    {
        var categorias = categoriaIds?
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList() ?? [];
        var statusNormalizado = status?.Trim().ToLowerInvariant();

        var query = _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.OrigemTransacao == OrigemTransacao.Lancamento &&
                transacao.DataOcorrencia >= dataInicial &&
                transacao.DataOcorrencia <= dataFinal);

        query = visao switch
        {
            VisaoRelatorio.Consumo => query.Where(transacao =>
                transacao.FormaPagamento != FormaPagamentoFaturaCartao),
            VisaoRelatorio.Caixa => query.Where(transacao =>
                !transacao.CartaoCreditoId.HasValue ||
                transacao.FormaPagamento == FormaPagamentoFaturaCartao),
            _ => query
        };

        if (contaBancariaId.HasValue)
        {
            query = query.Where(transacao => transacao.ContaBancariaId == contaBancariaId.Value);
        }

        if (cartaoCreditoId.HasValue)
        {
            query = query.Where(transacao => transacao.CartaoCreditoId == cartaoCreditoId.Value);
        }

        if (categorias.Count > 0)
        {
            query = query.Where(transacao =>
                transacao.CategoriaId.HasValue &&
                categorias.Contains(transacao.CategoriaId.Value));
        }

        if (tipoTransacao.HasValue)
        {
            query = query.Where(transacao => transacao.Tipo == tipoTransacao.Value);
        }

        if (somenteRecorrentes)
        {
            query = query.Where(transacao => transacao.IsFixa);
        }

        if (somenteParceladas)
        {
            query = query.Where(transacao => transacao.CompraParceladaId.HasValue);
        }

        if (statusNormalizado is "realizado" or "pagas" or "paga")
        {
            query = query.Where(transacao => transacao.IsPaga);
        }
        else if (statusNormalizado is "pendente" or "pendentes")
        {
            query = query.Where(transacao => !transacao.IsPaga);
        }

        return await query
            .Select(transacao => new TransacaoRelatorio(
                transacao.DataOcorrencia,
                transacao.Tipo,
                transacao.Valor,
                transacao.IsPaga,
                transacao.CategoriaId,
                transacao.Categoria == null ? "Sem categoria" : transacao.Categoria.Nome,
                transacao.Categoria == null ? "#64748B" : transacao.Categoria.CorHexa,
                transacao.IsFixa,
                transacao.CompraParceladaId.HasValue,
                transacao.CartaoCreditoId.HasValue,
                transacao.FormaPagamento,
                transacao.Id,
                transacao.CartaoCreditoId,
                transacao.ContaBancariaId,
                transacao.CompraParceladaId,
                transacao.NumeroParcelaQuitada,
                transacao.DataOcorrencia,
                transacao.FormaPagamento == FormaPagamentoFaturaCartao
                    ? "PagamentoFatura"
                    : transacao.CartaoCreditoId.HasValue
                        ? "CompraCartao"
                        : transacao.CompraParceladaId.HasValue
                            ? "Parcela"
                            : transacao.IsFixa
                                ? "Recorrencia"
                                : "Lancamento",
                transacao.FormaPagamento != FormaPagamentoFaturaCartao,
                !transacao.CartaoCreditoId.HasValue ||
                    transacao.FormaPagamento == FormaPagamentoFaturaCartao,
                !transacao.IsPaga &&
                    transacao.FormaPagamento != FormaPagamentoFaturaCartao))
            .ToListAsync(cancellationToken);
    }

    private static IReadOnlyList<RelatorioCategoriaResponse> CalcularDespesasPorCategoria(
        IReadOnlyList<TransacaoRelatorio> transacoes)
    {
        return transacoes
            .Where(transacao => transacao.Tipo == TipoTransacao.Despesa)
            .GroupBy(transacao => new
            {
                transacao.CategoriaId,
                transacao.CategoriaNome,
                transacao.CategoriaCorHexa
            })
            .Select(grupo => new RelatorioCategoriaResponse
            {
                CategoriaId = grupo.Key.CategoriaId,
                CategoriaNome = grupo.Key.CategoriaNome,
                CategoriaCorHexa = grupo.Key.CategoriaCorHexa,
                Valor = grupo.Sum(item => item.Valor)
            })
            .OrderByDescending(item => item.Valor)
            .ToList();
    }

    private static IReadOnlyList<RelatorioMensalResponse> CalcularTotaisMensais(
        IReadOnlyList<TransacaoRelatorio> transacoes,
        DateOnly dataInicial,
        DateOnly dataFinal)
    {
        var agregados = transacoes
            .GroupBy(transacao => new
            {
                transacao.DataOcorrencia.Year,
                transacao.DataOcorrencia.Month
            })
            .ToDictionary(
                grupo => (grupo.Key.Year, grupo.Key.Month),
                grupo =>
                {
                    var receitas = grupo
                        .Where(transacao => transacao.Tipo == TipoTransacao.Receita)
                        .Sum(transacao => transacao.Valor);
                    var despesas = grupo
                        .Where(transacao => transacao.Tipo == TipoTransacao.Despesa)
                        .Sum(transacao => transacao.Valor);
                    var investimentos = grupo
                        .Where(transacao => transacao.Tipo == TipoTransacao.Investimento)
                        .Sum(transacao => transacao.Valor);

                    return new RelatorioMensalResponse
                    {
                        Mes = grupo.Key.Month,
                        Ano = grupo.Key.Year,
                        Receitas = receitas,
                        Despesas = despesas,
                        Investimentos = investimentos,
                        Saldo = receitas - despesas - investimentos
                    };
                });

        return EnumerarMeses(dataInicial, dataFinal)
            .Select(referencia =>
                agregados.GetValueOrDefault((referencia.Year, referencia.Month)) ??
                new RelatorioMensalResponse
                {
                    Mes = referencia.Month,
                    Ano = referencia.Year
                })
            .ToList();
    }

    private static IReadOnlyList<RelatorioProjecaoDiariaResponse> CalcularProjecaoDiaria(
        IReadOnlyList<TransacaoRelatorio> transacoes,
        DateOnly dataInicial,
        DateOnly dataFinal)
    {
        var movimentosPorDia = transacoes
            .GroupBy(transacao => transacao.DataOcorrencia)
            .ToDictionary(
                grupo => grupo.Key,
                grupo => new
                {
                    Entradas = grupo
                        .Where(transacao => transacao.Tipo == TipoTransacao.Receita)
                        .Sum(transacao => transacao.Valor),
                    Saidas = grupo
                        .Where(transacao =>
                            transacao.Tipo == TipoTransacao.Despesa ||
                            transacao.Tipo == TipoTransacao.Investimento)
                        .Sum(transacao => transacao.Valor)
                });

        var saldoAcumulado = 0m;
        return EnumerarDias(dataInicial, dataFinal)
            .Select(data =>
            {
                var movimento = movimentosPorDia.GetValueOrDefault(data);
                var entradas = movimento?.Entradas ?? 0m;
                var saidas = movimento?.Saidas ?? 0m;
                saldoAcumulado += entradas - saidas;

                return new RelatorioProjecaoDiariaResponse
                {
                    Data = data,
                    Entradas = entradas,
                    Saidas = saidas,
                    SaldoAcumulado = saldoAcumulado
                };
            })
            .ToList();
    }

    private static IReadOnlyList<RelatorioPrevistoRealizadoResponse> CalcularPrevistoRealizado(
        IReadOnlyList<TransacaoRelatorio> transacoes,
        DateOnly hoje)
    {
        decimal Realizado(Func<TransacaoRelatorio, bool> predicate) =>
            transacoes.Where(item => predicate(item) && (item.IsPaga || item.DataOcorrencia <= hoje))
                .Sum(item => item.Valor);

        decimal Previsto(Func<TransacaoRelatorio, bool> predicate) =>
            transacoes.Where(predicate).Sum(item => item.Valor);

        var receitasPrevistas = Previsto(item => item.Tipo == TipoTransacao.Receita);
        var despesasPrevistas = Previsto(item => item.Tipo == TipoTransacao.Despesa);
        var investimentosPrevistos = Previsto(item => item.Tipo == TipoTransacao.Investimento);
        var receitasRealizadas = Realizado(item => item.Tipo == TipoTransacao.Receita);
        var despesasRealizadas = Realizado(item => item.Tipo == TipoTransacao.Despesa);
        var investimentosRealizados = Realizado(item => item.Tipo == TipoTransacao.Investimento);

        return
        [
            new RelatorioPrevistoRealizadoResponse
            {
                Nome = "Receitas (competência)",
                Previsto = receitasPrevistas,
                Realizado = receitasRealizadas
            },
            new RelatorioPrevistoRealizadoResponse
            {
                Nome = "Despesas (competência)",
                Previsto = despesasPrevistas,
                Realizado = despesasRealizadas
            },
            new RelatorioPrevistoRealizadoResponse
            {
                Nome = "Saldo (competência)",
                Previsto = receitasPrevistas - despesasPrevistas - investimentosPrevistos,
                Realizado = receitasRealizadas - despesasRealizadas - investimentosRealizados
            }
        ];
    }

    private static IReadOnlyList<RelatorioCompromissoFuturoResponse> CalcularCompromissosFuturos(
        IReadOnlyList<TransacaoRelatorio> transacoes,
        DateOnly dataInicial,
        DateOnly dataFinal)
    {
        var futuras = transacoes
            .Where(transacao => !transacao.IsPaga)
            .GroupBy(transacao => new
            {
                transacao.DataOcorrencia.Year,
                transacao.DataOcorrencia.Month
            })
            .ToDictionary(
                grupo => (grupo.Key.Year, grupo.Key.Month),
                grupo => new RelatorioCompromissoFuturoResponse
                {
                    Mes = grupo.Key.Month,
                    Ano = grupo.Key.Year,
                    Faturas = grupo
                        .Where(item =>
                            item.Tipo == TipoTransacao.Despesa &&
                            item.IsCartao)
                        .Sum(item => item.Valor),
                    ParcelasForaDeFatura = grupo
                        .Where(item =>
                            item.Tipo == TipoTransacao.Despesa &&
                            item.IsParcelada &&
                            !item.IsCartao)
                        .Sum(item => item.Valor),
                    DespesasFixas = grupo
                        .Where(item =>
                            item.Tipo == TipoTransacao.Despesa &&
                            item.IsFixa &&
                            !item.IsCartao &&
                            !item.IsParcelada)
                        .Sum(item => item.Valor),
                    OutrasDespesas = grupo
                        .Where(item =>
                            item.Tipo == TipoTransacao.Despesa &&
                            !item.IsCartao &&
                            !item.IsParcelada &&
                            !item.IsFixa)
                        .Sum(item => item.Valor),
                    ReceitasPrevistas = grupo
                        .Where(item => item.Tipo == TipoTransacao.Receita)
                        .Sum(item => item.Valor)
                });

        return EnumerarMeses(dataInicial, dataFinal)
            .Select(referencia =>
            {
                var compromisso = futuras.GetValueOrDefault((referencia.Year, referencia.Month)) ??
                    new RelatorioCompromissoFuturoResponse
                    {
                        Mes = referencia.Month,
                        Ano = referencia.Year
                    };
                compromisso.Parcelas = compromisso.ParcelasForaDeFatura;
                compromisso.ReceitasRecorrentes = compromisso.ReceitasPrevistas;
                compromisso.ObrigacoesFuturas =
                    compromisso.Faturas +
                    compromisso.ParcelasForaDeFatura +
                    compromisso.DespesasFixas +
                    compromisso.OutrasDespesas;
                compromisso.ImpactoLiquido =
                    compromisso.ReceitasPrevistas -
                    compromisso.ObrigacoesFuturas;
                compromisso.Total = compromisso.ObrigacoesFuturas;
                return compromisso;
            })
            .ToList();
    }

    private async Task<RelatorioDisponivelAposCompromissosResponse> CalcularDisponivelAposCompromissosAsync(
        IReadOnlyList<TransacaoRelatorio> transacoesPeriodo,
        DateOnly dataLimite,
        Guid usuarioId,
        Guid? contaBancariaId,
        IReadOnlyCollection<Guid>? categoriaIds,
        CancellationToken cancellationToken)
    {
        var saldosContas = await _contaBancariaService.ObterDistribuicaoAsync(usuarioId, cancellationToken);
        var saldoAtual = contaBancariaId.HasValue
            ? saldosContas
                .Where(conta => conta.Id == contaBancariaId.Value)
                .Sum(conta => conta.SaldoAtual)
            : saldosContas.Sum(conta => conta.SaldoAtual);
        var pendentesAteLimite = transacoesPeriodo
            .Where(transacao =>
                !transacao.IsPaga &&
                transacao.DataOcorrencia <= dataLimite)
            .ToList();
        var obrigacoesPendentes = pendentesAteLimite
            .Where(transacao => transacao.Tipo == TipoTransacao.Despesa)
            .Sum(transacao => transacao.Valor);
        var investimentosPendentes = pendentesAteLimite
            .Where(transacao => transacao.Tipo == TipoTransacao.Investimento)
            .Sum(transacao => transacao.Valor);
        var receitasPrevistas = pendentesAteLimite
            .Where(transacao => transacao.Tipo == TipoTransacao.Receita)
            .Sum(transacao => transacao.Valor);
        const decimal reservaMinimaConfigurada = 0m;
        var disponivel =
            saldoAtual -
            obrigacoesPendentes -
            investimentosPendentes -
            reservaMinimaConfigurada;

        return new RelatorioDisponivelAposCompromissosResponse
        {
            SaldoAtual = saldoAtual,
            ObrigacoesPendentesAteDataLimite = obrigacoesPendentes,
            InvestimentosPendentesAteDataLimite = investimentosPendentes,
            ReservaMinimaConfigurada = reservaMinimaConfigurada,
            DisponivelAposCompromissos = disponivel,
            ReceitasPrevistas = receitasPrevistas,
            DisponivelConsiderandoReceitasPrevistas = disponivel + receitasPrevistas,
            DataLimite = dataLimite,
            Observacao = categoriaIds?.Any(id => id != Guid.Empty) == true
                ? "Disponível calculado sobre o saldo global ou da conta selecionada; categorias filtram apenas os compromissos e receitas exibidos."
                : null
        };
    }

    private static ResumoPeriodo CalcularResumo(IReadOnlyList<TransacaoRelatorio> transacoes)
    {
        var receitas = transacoes
            .Where(transacao => transacao.Tipo == TipoTransacao.Receita)
            .Sum(transacao => transacao.Valor);
        var despesas = transacoes
            .Where(transacao => transacao.Tipo == TipoTransacao.Despesa)
            .Sum(transacao => transacao.Valor);
        var investimentos = transacoes
            .Where(transacao => transacao.Tipo == TipoTransacao.Investimento)
            .Sum(transacao => transacao.Valor);

        return new ResumoPeriodo(receitas, despesas, investimentos);
    }

    private static decimal CalcularTaxaEconomia(decimal receitas, decimal despesas)
    {
        if (receitas <= 0)
        {
            return 0;
        }

        return Math.Round(((receitas - despesas) / receitas) * 100, 2);
    }

    private static RelatorioComparativoValorResponse CriarComparativo(
        decimal atual,
        decimal anterior,
        string tipo)
    {
        var diferenca = atual - anterior;
        var percentual = anterior == 0
            ? (decimal?)null
            : Math.Round((diferenca / Math.Abs(anterior)) * 100, 2);
        var tendencia = CalcularTendencia(tipo, diferenca);

        return new RelatorioComparativoValorResponse
        {
            ValorAtual = atual,
            ValorAnterior = anterior,
            DiferencaAbsoluta = diferenca,
            VariacaoPercentual = percentual,
            Tendencia = tendencia,
            Mensagem = percentual.HasValue
                ? $"{Math.Abs(percentual.Value):N1}% {(diferenca >= 0 ? "acima" : "abaixo")} do período anterior"
                : "Sem base para comparação"
        };
    }

    private static string CalcularTendencia(string tipo, decimal diferenca)
    {
        if (diferenca == 0)
        {
            return "Neutra";
        }

        return tipo switch
        {
            "receita" or "resultado" or "taxa" => diferenca > 0 ? "Melhora" : "Piora",
            "despesa" or "investimento" => diferenca < 0 ? "Melhora" : "Piora",
            _ => "Neutra"
        };
    }

    private static IEnumerable<DateOnly> EnumerarMeses(DateOnly inicio, DateOnly fim)
    {
        var cursor = new DateOnly(inicio.Year, inicio.Month, 1);
        var ultimoMes = new DateOnly(fim.Year, fim.Month, 1);

        while (cursor <= ultimoMes)
        {
            yield return cursor;
            cursor = cursor.AddMonths(1);
        }
    }

    private static IEnumerable<DateOnly> EnumerarDias(DateOnly inicio, DateOnly fim)
    {
        for (var cursor = inicio; cursor <= fim; cursor = cursor.AddDays(1))
        {
            yield return cursor;
        }
    }

    private sealed record TransacaoRelatorio(
        DateOnly DataOcorrencia,
        TipoTransacao Tipo,
        decimal Valor,
        bool IsPaga,
        Guid? CategoriaId,
        string CategoriaNome,
        string CategoriaCorHexa,
        bool IsFixa,
        bool IsParcelada,
        bool IsCartao,
        string FormaPagamento,
        Guid OrigemId,
        Guid? CartaoCreditoId,
        Guid? ContaBancariaId,
        Guid? CompraParceladaId,
        int? NumeroParcela,
        DateOnly DataCaixa,
        string Origem,
        bool ImpactaConsumo,
        bool ImpactaSaldo,
        bool ImpactaCompromissos)
    {
        public DateOnly DataCompetencia => DataOcorrencia;
        public bool Realizada => IsPaga;
        public bool Pendente => !IsPaga;
        public bool Projetada => !IsPaga && DataOcorrencia > DateOnly.FromDateTime(DateTime.Today);
        public string Competencia => $"{DataCompetencia.Year:D4}-{DataCompetencia.Month:D2}";
    }

    private sealed record ResumoPeriodo(decimal Receitas, decimal Despesas, decimal Investimentos)
    {
        public decimal ResultadoLiquido => Receitas - Despesas - Investimentos;
    }

    private enum VisaoRelatorio
    {
        Consumo,
        Caixa
    }
}
