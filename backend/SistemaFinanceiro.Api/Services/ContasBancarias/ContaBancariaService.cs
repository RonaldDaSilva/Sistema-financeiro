using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.ContasBancarias;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.ContasBancarias;

public sealed class ContaBancariaService : IContaBancariaService
{
    private const string FormaPagamentoFaturaCartao = "Pagamento de fatura";

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
            .Where(conta => conta.UsuarioId == usuarioId && !conta.IsArquivada)
            .OrderByDescending(conta => conta.IsFavorita)
            .ThenBy(conta => conta.NomeCustomizado)
            .Select(conta => new ContaBancariaResponse
            {
                Id = conta.Id,
                NomeCustomizado = conta.NomeCustomizado,
                CodigoBanco = conta.CodigoBanco,
                SaldoInicial = conta.SaldoInicial,
                IsFavorita = conta.IsFavorita,
                IsArquivada = conta.IsArquivada,
                PermiteEditarSaldoInicial = !conta.Transacoes.Any(),
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
                IsArquivada = conta.IsArquivada,
                PermiteEditarSaldoInicial = !conta.Transacoes.Any(),
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
        return Mapear(conta, permiteEditarSaldoInicial: true);
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

        var possuiMovimentacao = await _dbContext.Transacoes
            .AsNoTracking()
            .AnyAsync(
                transacao => transacao.UsuarioId == usuarioId &&
                    transacao.ContaBancariaId == id,
                cancellationToken);

        conta.NomeCustomizado = request.NomeCustomizado.Trim();
        conta.CodigoBanco = request.CodigoBanco;
        if (!possuiMovimentacao)
        {
            conta.SaldoInicial = request.SaldoInicial;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(conta, !possuiMovimentacao);
    }

    public async Task<ContaBancariaResponse?> FavoritarAsync(
        Guid id,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var contas = await _dbContext.ContasBancarias
            .Where(conta => conta.UsuarioId == usuarioId && !conta.IsArquivada)
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

    public async Task<ContaBancariaResponse?> ArquivarAsync(
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
            return null;
        }

        conta.IsArquivada = true;
        conta.IsFavorita = false;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(conta);
    }

    /// <summary>
    /// Ajuste de saldo é persistido como transação paga de origem AjusteSaldo.
    /// A movimentação afeta o saldo da conta, mas deve ser excluída dos relatórios
    /// de consumo/receita/despesa por ser uma reconciliação patrimonial.
    /// </summary>
    public async Task<ContaBancariaResponse?> AjustarSaldoAsync(
        Guid id,
        AjustarSaldoContaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var conta = await _dbContext.ContasBancarias
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId && !item.IsArquivada,
                cancellationToken);

        if (conta is null)
        {
            return null;
        }

        var saldoAtual = await CalcularSaldoContaAsync(id, usuarioId, cancellationToken);
        var diferenca = request.SaldoInformado - saldoAtual;
        if (diferenca == 0)
        {
            return Mapear(conta);
        }

        _dbContext.Transacoes.Add(new Transacao
        {
            UsuarioId = usuarioId,
            CodigoExibicao = await ObterProximoCodigoExibicaoAsync(usuarioId, cancellationToken),
            Tipo = diferenca > 0 ? TipoTransacao.Receita : TipoTransacao.Despesa,
            Descricao = "Ajuste de saldo",
            Valor = Math.Abs(diferenca),
            DataOcorrencia = request.Data ?? DateOnly.FromDateTime(DateTime.Today),
            FormaPagamento = "Ajuste de saldo",
            ContaBancariaId = conta.Id,
            IsPaga = true,
            OrigemTransacao = OrigemTransacao.AjusteSaldo,
            SaldoAnteriorAjuste = saldoAtual,
            SaldoInformadoAjuste = request.SaldoInformado,
            Observacao = string.IsNullOrWhiteSpace(request.Observacao)
                ? null
                : request.Observacao.Trim()
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(conta);
    }

    public async Task<Guid> TransferirAsync(
        TransferenciaContaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        if (request.ContaOrigemId == request.ContaDestinoId)
        {
            throw new InvalidOperationException("A conta de origem deve ser diferente da conta de destino.");
        }

        var contas = await _dbContext.ContasBancarias
            .Where(conta =>
                conta.UsuarioId == usuarioId &&
                !conta.IsArquivada &&
                (conta.Id == request.ContaOrigemId || conta.Id == request.ContaDestinoId))
            .ToListAsync(cancellationToken);

        var origem = contas.SingleOrDefault(conta => conta.Id == request.ContaOrigemId);
        var destino = contas.SingleOrDefault(conta => conta.Id == request.ContaDestinoId);
        if (origem is null || destino is null)
        {
            throw new InvalidOperationException("Conta de origem ou destino não encontrada.");
        }

        var saldoOrigem = await CalcularSaldoContaAsync(origem.Id, usuarioId, cancellationToken);
        if (saldoOrigem - request.Valor < 0 && !request.ConfirmarSemSaldo)
        {
            throw new InvalidOperationException("SALDO_INSUFICIENTE");
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var transferenciaId = Guid.NewGuid();
        var data = request.Data ?? DateOnly.FromDateTime(DateTime.Today);
        var descricao = string.IsNullOrWhiteSpace(request.Descricao)
            ? "Transferência entre contas"
            : request.Descricao.Trim();
        var proximoCodigo = await ObterProximoCodigoExibicaoAsync(usuarioId, cancellationToken);

        _dbContext.Transacoes.AddRange(
            new Transacao
            {
                UsuarioId = usuarioId,
                CodigoExibicao = proximoCodigo,
                Tipo = TipoTransacao.Despesa,
                Descricao = descricao,
                Valor = request.Valor,
                DataOcorrencia = data,
                FormaPagamento = "Transferência",
                ContaBancariaId = origem.Id,
                IsPaga = true,
                OrigemTransacao = OrigemTransacao.Transferencia,
                TransferenciaId = transferenciaId
            },
            new Transacao
            {
                UsuarioId = usuarioId,
                CodigoExibicao = proximoCodigo + 1,
                Tipo = TipoTransacao.Receita,
                Descricao = descricao,
                Valor = request.Valor,
                DataOcorrencia = data,
                FormaPagamento = "Transferência",
                ContaBancariaId = destino.Id,
                IsPaga = true,
                OrigemTransacao = OrigemTransacao.Transferencia,
                TransferenciaId = transferenciaId
            });

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return transferenciaId;
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

        var possuiVinculo = await _dbContext.Transacoes
            .AsNoTracking()
            .AnyAsync(
                transacao => transacao.UsuarioId == usuarioId &&
                    transacao.ContaBancariaId == id,
                cancellationToken);

        if (possuiVinculo)
        {
            conta.IsArquivada = true;
            conta.IsFavorita = false;
        }
        else
        {
            _dbContext.ContasBancarias.Remove(conta);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<ContaDistribuicaoResponse>> ObterDistribuicaoAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var transacoesComDivisaoVinculada = await ObterTransacoesComDivisaoVinculadaAsync(
            usuarioId,
            cancellationToken);
        var movimentos = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.ContaBancariaId.HasValue &&
                transacao.IsPaga &&
                (!transacao.CartaoCreditoId.HasValue ||
                    transacao.FormaPagamento == FormaPagamentoFaturaCartao))
            .Select(transacao => new MovimentoConta(
                transacao.Id,
                transacao.ContaBancariaId!.Value,
                transacao.Tipo,
                transacao.Valor,
                transacao.IsDividida,
                transacao.ValorTotalOriginal))
            .ToListAsync(cancellationToken);
        var movimentosFixosLiquidados = await ObterMovimentosFixosLiquidadosAsync(
            usuarioId,
            cancellationToken);
        movimentos.AddRange(movimentosFixosLiquidados);

        var movimentosPorConta = movimentos
            .GroupBy(transacao => transacao.ContaBancariaId)
            .ToDictionary(
                grupo => grupo.Key,
                grupo => grupo.Sum(transacao => CalcularImpactoSaldo(
                    transacao.Tipo,
                    ObterValorMovimentoSaldo(transacao, transacoesComDivisaoVinculada))));

        var contas = await _dbContext.ContasBancarias
            .AsNoTracking()
            .Where(conta => conta.UsuarioId == usuarioId && !conta.IsArquivada)
            .ToListAsync(cancellationToken);

        return contas
            .Select(conta => new ContaDistribuicaoResponse
            {
                Id = conta.Id,
                CodigoBanco = conta.CodigoBanco,
                NomeCustomizado = conta.NomeCustomizado,
                SaldoAtual = conta.SaldoInicial +
                    movimentosPorConta.GetValueOrDefault(conta.Id)
            })
            .OrderByDescending(conta => conta.SaldoAtual)
            .ToList();
    }

    private static ContaBancariaResponse Mapear(
        ContaBancaria conta,
        bool permiteEditarSaldoInicial = false)
    {
        return new ContaBancariaResponse
        {
            Id = conta.Id,
            NomeCustomizado = conta.NomeCustomizado,
            CodigoBanco = conta.CodigoBanco,
            SaldoInicial = conta.SaldoInicial,
            IsFavorita = conta.IsFavorita,
            IsArquivada = conta.IsArquivada,
            PermiteEditarSaldoInicial = permiteEditarSaldoInicial,
            DataCriacao = conta.DataCriacao
        };
    }

    private async Task<decimal> CalcularSaldoContaAsync(
        Guid contaId,
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var conta = await _dbContext.ContasBancarias
            .AsNoTracking()
            .Where(item => item.Id == contaId && item.UsuarioId == usuarioId)
            .Select(item => new { item.SaldoInicial })
            .SingleAsync(cancellationToken);

        var transacoesComDivisaoVinculada = await ObterTransacoesComDivisaoVinculadaAsync(
            usuarioId,
            cancellationToken);
        var movimentos = await _dbContext.Transacoes
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.ContaBancariaId == contaId &&
                transacao.IsPaga &&
                (!transacao.CartaoCreditoId.HasValue ||
                    transacao.FormaPagamento == FormaPagamentoFaturaCartao))
            .Select(transacao => new MovimentoConta(
                transacao.Id,
                transacao.ContaBancariaId!.Value,
                transacao.Tipo,
                transacao.Valor,
                transacao.IsDividida,
                transacao.ValorTotalOriginal))
            .ToListAsync(cancellationToken);
        var movimentosFixosLiquidados = await ObterMovimentosFixosLiquidadosAsync(
            usuarioId,
            cancellationToken);
        movimentos.AddRange(movimentosFixosLiquidados.Where(movimento => movimento.ContaBancariaId == contaId));

        return conta.SaldoInicial +
            movimentos.Sum(transacao => CalcularImpactoSaldo(
                transacao.Tipo,
                ObterValorMovimentoSaldo(transacao, transacoesComDivisaoVinculada)));
    }

    private async Task<List<MovimentoConta>> ObterMovimentosFixosLiquidadosAsync(
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        return await _dbContext.TransacoesFixasPagamentos
            .AsNoTracking()
            .Where(pagamento =>
                pagamento.UsuarioId == usuarioId &&
                pagamento.IsPaga &&
                pagamento.TransacaoFixa.ContaBancariaId.HasValue)
            .Select(pagamento => new MovimentoConta(
                pagamento.TransacaoFixaId,
                pagamento.TransacaoFixa.ContaBancariaId!.Value,
                pagamento.TransacaoFixa.Tipo,
                pagamento.TransacaoFixa.Valor,
                pagamento.TransacaoFixa.IsDividida,
                pagamento.TransacaoFixa.ValorTotalOriginal))
            .ToListAsync(cancellationToken);
    }

    private async Task<HashSet<Guid>> ObterTransacoesComDivisaoVinculadaAsync(
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var ids = await _dbContext.DivisoesTransacoes
            .AsNoTracking()
            .Where(divisao =>
                divisao.UsuarioCriadorId == usuarioId &&
                divisao.TransacaoOrigemId.HasValue)
            .Select(divisao => divisao.TransacaoOrigemId!.Value)
            .ToListAsync(cancellationToken);

        return ids.ToHashSet();
    }

    private static decimal ObterValorMovimentoSaldo(
        MovimentoConta movimento,
        IReadOnlySet<Guid> transacoesComDivisaoVinculada)
    {
        if (movimento.Tipo == TipoTransacao.Despesa &&
            movimento.IsDividida &&
            movimento.ValorTotalOriginal.HasValue &&
            transacoesComDivisaoVinculada.Contains(movimento.TransacaoId))
        {
            return movimento.ValorTotalOriginal.Value;
        }

        return movimento.Valor;
    }

    private static decimal CalcularImpactoSaldo(TipoTransacao tipo, decimal valor)
    {
        return tipo == TipoTransacao.Receita
            ? valor
            : tipo == TipoTransacao.Despesa ||
              tipo == TipoTransacao.Investimento
                ? -valor
                : 0m;
    }

    private async Task<int> ObterProximoCodigoExibicaoAsync(
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var ultimoCodigo = await _dbContext.Transacoes
            .Where(transacao => transacao.UsuarioId == usuarioId)
            .MaxAsync(transacao => (int?)transacao.CodigoExibicao, cancellationToken);

        return (ultimoCodigo ?? 0) + 1;
    }

    private sealed record MovimentoConta(
        Guid TransacaoId,
        Guid ContaBancariaId,
        TipoTransacao Tipo,
        decimal Valor,
        bool IsDividida,
        decimal? ValorTotalOriginal);
}
