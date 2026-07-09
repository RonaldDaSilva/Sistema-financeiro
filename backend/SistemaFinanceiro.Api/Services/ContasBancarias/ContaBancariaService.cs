using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.ContasBancarias;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.ContasBancarias;

public sealed class ContaBancariaService : IContaBancariaService
{
    private readonly AppDbContext _dbContext;

    public ContaBancariaService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ContaBancariaResponse>> ListarAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.ContasBancarias
            .AsNoTracking()
            .Where(conta => conta.UsuarioId == usuarioId)
            .OrderBy(conta => conta.NomeCustomizado)
            .Select(conta => new ContaBancariaResponse
            {
                Id = conta.Id,
                NomeCustomizado = conta.NomeCustomizado,
                CodigoBanco = conta.CodigoBanco,
                SaldoInicial = conta.SaldoInicial,
                IsFavorita = conta.IsFavorita,
                DataCriacao = conta.DataCriacao
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<ContaBancariaResponse?> ObterPorIdAsync(
        Guid id,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.ContasBancarias
            .AsNoTracking()
            .Where(conta => conta.Id == id && conta.UsuarioId == usuarioId)
            .Select(conta => new ContaBancariaResponse
            {
                Id = conta.Id,
                NomeCustomizado = conta.NomeCustomizado,
                CodigoBanco = conta.CodigoBanco,
                SaldoInicial = conta.SaldoInicial,
                IsFavorita = conta.IsFavorita,
                DataCriacao = conta.DataCriacao
            })
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<ContaBancariaResponse> CriarAsync(
        ContaBancariaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var conta = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = request.NomeCustomizado.Trim(),
            CodigoBanco = request.CodigoBanco,
            SaldoInicial = request.SaldoInicial
        };

        _dbContext.ContasBancarias.Add(conta);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(conta);
    }

    public async Task<ContaBancariaResponse?> AtualizarAsync(
        Guid id,
        ContaBancariaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var conta = await _dbContext.ContasBancarias
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId,
                cancellationToken);

        if (conta is null)
        {
            return null;
        }

        conta.NomeCustomizado = request.NomeCustomizado.Trim();
        conta.CodigoBanco = request.CodigoBanco;
        conta.SaldoInicial = request.SaldoInicial;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(conta);
    }

    public async Task<ContaBancariaResponse?> FavoritarAsync(
        Guid id,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var contas = await _dbContext.ContasBancarias
            .Where(conta => conta.UsuarioId == usuarioId)
            .ToListAsync(cancellationToken);

        var contaFavorita = contas.SingleOrDefault(conta => conta.Id == id);
        if (contaFavorita is null)
        {
            return null;
        }

        foreach (var conta in contas)
        {
            conta.IsFavorita = conta.Id == id;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(contaFavorita);
    }

    public async Task<bool> ExcluirAsync(
        Guid id,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var conta = await _dbContext.ContasBancarias
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId,
                cancellationToken);

        if (conta is null)
        {
            return false;
        }

        _dbContext.ContasBancarias.Remove(conta);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<ContaDistribuicaoResponse>> ObterDistribuicaoAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var movimentosPorConta = _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.ContaBancariaId.HasValue &&
                transacao.IsPaga)
            .GroupBy(transacao => transacao.ContaBancariaId!.Value)
            .Select(grupo => new
            {
                ContaBancariaId = grupo.Key,
                Movimento = grupo.Sum(transacao =>
                    transacao.Tipo == TipoTransacao.Receita
                        ? transacao.Valor
                        : transacao.Tipo == TipoTransacao.Despesa
                            ? -transacao.Valor
                            : 0m)
            });

        return await _dbContext.ContasBancarias
            .AsNoTracking()
            .Where(conta => conta.UsuarioId == usuarioId)
            .GroupJoin(
                movimentosPorConta,
                conta => conta.Id,
                movimento => movimento.ContaBancariaId,
                (conta, movimentos) => new ContaDistribuicaoResponse
                {
                    Id = conta.Id,
            CodigoBanco = conta.CodigoBanco,
            NomeCustomizado = conta.NomeCustomizado,
            SaldoAtual = conta.SaldoInicial +
                        (movimentos.Select(item => (decimal?)item.Movimento).Sum() ?? 0m)
                })
            .OrderBy(conta => conta.NomeCustomizado)
            .ToListAsync(cancellationToken);
    }

    private static ContaBancariaResponse Mapear(ContaBancaria conta)
    {
        return new ContaBancariaResponse
        {
            Id = conta.Id,
            NomeCustomizado = conta.NomeCustomizado,
            CodigoBanco = conta.CodigoBanco,
            SaldoInicial = conta.SaldoInicial,
            IsFavorita = conta.IsFavorita,
            DataCriacao = conta.DataCriacao
        };
    }
}
