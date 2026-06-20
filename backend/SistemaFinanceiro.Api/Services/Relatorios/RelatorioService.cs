using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Relatorios;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Relatorios;

public sealed class RelatorioService : IRelatorioService
{
    private readonly AppDbContext _dbContext;

    public RelatorioService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<RelatorioGraficosResponse> GetGraficosAsync(
        int mes,
        int ano,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        if (mes is < 1 or > 12)
        {
            throw new ArgumentOutOfRangeException(nameof(mes), "O mês deve estar entre 1 e 12.");
        }

        if (ano < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(ano), "O ano deve ser válido.");
        }

        var inicioMes = new DateOnly(ano, mes, 1);
        var fimMes = inicioMes.AddMonths(1).AddDays(-1);
        var inicioAno = new DateOnly(ano, 1, 1);
        var fimAno = new DateOnly(ano, 12, 31);

        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var inicioFluxo = new DateOnly(hoje.Year, hoje.Month, 1).AddMonths(-5);
        var fimFluxo = inicioFluxo.AddMonths(12).AddDays(-1);

        var despesasPorCategoria = await GetDespesasPorCategoriaAsync(
            usuarioId,
            inicioMes,
            fimMes,
            cancellationToken);
        var saldoAnual = await GetTotaisMensaisAsync(
            usuarioId,
            inicioAno,
            fimAno,
            cancellationToken);
        var serieFluxo = await GetTotaisMensaisAsync(
            usuarioId,
            inicioFluxo,
            fimFluxo,
            cancellationToken);

        return new RelatorioGraficosResponse
        {
            Mes = mes,
            Ano = ano,
            DespesasPorCategoria = despesasPorCategoria,
            SaldoAnual = saldoAnual,
            SerieFluxo = serieFluxo
        };
    }

    private async Task<IReadOnlyList<RelatorioCategoriaResponse>> GetDespesasPorCategoriaAsync(
        Guid usuarioId,
        DateOnly dataInicial,
        DateOnly dataFinal,
        CancellationToken cancellationToken)
    {
        var despesasTransacoes = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.Tipo == TipoTransacao.Despesa &&
                transacao.DataOcorrencia >= dataInicial &&
                transacao.DataOcorrencia <= dataFinal)
            .Select(transacao => new
            {
                transacao.CategoriaId,
                CategoriaNome = transacao.Categoria == null ? "Sem categoria" : transacao.Categoria.Nome,
                CategoriaCorHexa = transacao.Categoria == null ? "#64748B" : transacao.Categoria.CorHexa,
                transacao.Valor
            })
            .GroupBy(item => new
            {
                item.CategoriaId,
                item.CategoriaNome,
                item.CategoriaCorHexa
            })
            .Select(grupo => new RelatorioCategoriaResponse
            {
                CategoriaId = grupo.Key.CategoriaId,
                CategoriaNome = grupo.Key.CategoriaNome,
                CategoriaCorHexa = grupo.Key.CategoriaCorHexa,
                Valor = grupo.Sum(item => item.Valor)
            })
            .ToListAsync(cancellationToken);

        var comprasParceladas = await _dbContext.ComprasParceladas
            .AsNoTracking()
            .Where(compra =>
                compra.UsuarioId == usuarioId &&
                compra.DataCompra >= dataInicial &&
                compra.DataCompra <= dataFinal)
            .Select(compra => new
            {
                CategoriaId = (Guid?)compra.CategoriaId,
                CategoriaNome = compra.Categoria.Nome,
                CategoriaCorHexa = compra.Categoria.CorHexa,
                Valor = compra.ValorTotal
            })
            .GroupBy(item => new
            {
                item.CategoriaId,
                item.CategoriaNome,
                item.CategoriaCorHexa
            })
            .Select(grupo => new RelatorioCategoriaResponse
            {
                CategoriaId = grupo.Key.CategoriaId,
                CategoriaNome = grupo.Key.CategoriaNome,
                CategoriaCorHexa = grupo.Key.CategoriaCorHexa,
                Valor = grupo.Sum(item => item.Valor)
            })
            .ToListAsync(cancellationToken);

        return despesasTransacoes
            .Concat(comprasParceladas)
            .GroupBy(item => new
            {
                item.CategoriaId,
                item.CategoriaNome,
                item.CategoriaCorHexa
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

    private async Task<IReadOnlyList<RelatorioMensalResponse>> GetTotaisMensaisAsync(
        Guid usuarioId,
        DateOnly dataInicial,
        DateOnly dataFinal,
        CancellationToken cancellationToken)
    {
        var agregados = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.DataOcorrencia >= dataInicial &&
                transacao.DataOcorrencia <= dataFinal)
            .Select(transacao => new
            {
                transacao.DataOcorrencia.Year,
                transacao.DataOcorrencia.Month,
                transacao.Tipo,
                transacao.Valor
            })
            .GroupBy(item => new
            {
                item.Year,
                item.Month
            })
            .Select(grupo => new
            {
                Ano = grupo.Key.Year,
                Mes = grupo.Key.Month,
                Receitas = grupo
                    .Where(item => item.Tipo == TipoTransacao.Receita)
                    .Sum(item => item.Valor),
                Despesas = grupo
                    .Where(item => item.Tipo == TipoTransacao.Despesa)
                    .Sum(item => item.Valor),
                Investimentos = grupo
                    .Where(item => item.Tipo == TipoTransacao.Investimento)
                    .Sum(item => item.Valor)
            })
            .ToListAsync(cancellationToken);

        var agregadosPorMes = agregados.ToDictionary(
            item => (item.Ano, item.Mes),
            item => item);

        return EnumerarMeses(dataInicial, dataFinal)
            .Select(referencia =>
            {
                var agregado = agregadosPorMes.GetValueOrDefault((referencia.Year, referencia.Month));
                var receitas = agregado?.Receitas ?? 0m;
                var despesas = agregado?.Despesas ?? 0m;
                var investimentos = agregado?.Investimentos ?? 0m;

                return new RelatorioMensalResponse
                {
                    Mes = referencia.Month,
                    Ano = referencia.Year,
                    Receitas = receitas,
                    Despesas = despesas,
                    Investimentos = investimentos,
                    Saldo = receitas - despesas - investimentos
                };
            })
            .ToList();
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
}
