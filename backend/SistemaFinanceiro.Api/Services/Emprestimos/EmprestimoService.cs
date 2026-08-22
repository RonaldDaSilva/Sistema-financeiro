using System.Data;
using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Emprestimos;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Emprestimos;

public sealed class EmprestimoService : IEmprestimoService
{
    private readonly AppDbContext _dbContext;

    public EmprestimoService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<EmprestimoResumoResponse>> ListarAsync(
        Guid usuarioId,
        Guid? contatoId = null,
        StatusEmprestimo? status = null,
        bool incluirArquivados = false,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Emprestimos
            .AsNoTracking()
            .Include(emprestimo => emprestimo.Contato)
            .Include(emprestimo => emprestimo.Parcelas)
            .Where(emprestimo => emprestimo.UsuarioId == usuarioId);

        if (!incluirArquivados)
        {
            query = query.Where(emprestimo => !emprestimo.IsArquivado);
        }

        if (contatoId.HasValue)
        {
            query = query.Where(emprestimo => emprestimo.ContatoId == contatoId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(emprestimo => emprestimo.Status == status.Value);
        }

        var emprestimos = await query
            .OrderByDescending(emprestimo => emprestimo.Data)
            .ThenBy(emprestimo => emprestimo.Descricao)
            .ToListAsync(cancellationToken);

        return emprestimos.Select(MapearResumo).ToList();
    }

    public async Task<EmprestimoDetalheResponse?> ObterAsync(
        Guid usuarioId,
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var emprestimo = await ObterDetalheQuery(usuarioId, id)
            .AsNoTracking()
            .SingleOrDefaultAsync(cancellationToken);
        return emprestimo is null ? null : MapearDetalhe(emprestimo);
    }

    public async Task<EmprestimoDetalheResponse> CriarAsync(
        Guid usuarioId,
        CriarEmprestimoRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidarCriacao(request);

        var contato = await _dbContext.ContatosEmprestimos
            .SingleOrDefaultAsync(
                item => item.Id == request.ContatoId && item.UsuarioId == usuarioId && item.Ativo,
                cancellationToken);
        if (contato is null)
        {
            throw new InvalidOperationException("Contato não encontrado para este usuário.");
        }

        await ValidarOrigemAsync(usuarioId, request, cancellationToken);

        var emprestimo = new Emprestimo
        {
            UsuarioId = usuarioId,
            Contato = contato,
            Descricao = request.Descricao.Trim(),
            ValorTotal = request.ValorTotal,
            Data = request.Data,
            OrigemFinanceira = request.OrigemFinanceira,
            CartaoCreditoId = request.CartaoCreditoId,
            ContaBancariaId = request.ContaBancariaId,
            QuantidadeParcelas = request.QuantidadeParcelas,
            Observacao = NormalizarTexto(request.Observacao)
        };

        for (var numero = 1; numero <= request.QuantidadeParcelas; numero++)
        {
            emprestimo.Parcelas.Add(new ParcelaEmprestimo
            {
                UsuarioId = usuarioId,
                NumeroParcela = numero,
                DataVencimento = request.Data.AddMonths(numero - 1),
                Valor = CalcularValorParcela(request.ValorTotal, request.QuantidadeParcelas, numero)
            });
        }

        await CriarLancamentosConcessaoAsync(emprestimo, cancellationToken);

        _dbContext.Emprestimos.Add(emprestimo);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapearDetalhe(emprestimo);
    }

    public async Task<EmprestimoDetalheResponse?> AtualizarAsync(
        Guid usuarioId,
        Guid id,
        AtualizarEmprestimoRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Descricao))
        {
            throw new InvalidOperationException("A descrição do empréstimo é obrigatória.");
        }

        var emprestimo = await ObterDetalheQuery(usuarioId, id)
            .SingleOrDefaultAsync(cancellationToken);
        if (emprestimo is null)
        {
            return null;
        }

        var contato = await _dbContext.ContatosEmprestimos
            .SingleOrDefaultAsync(
                item => item.Id == request.ContatoId && item.UsuarioId == usuarioId && item.Ativo,
                cancellationToken);
        if (contato is null)
        {
            throw new InvalidOperationException("Contato não encontrado para este usuário.");
        }

        emprestimo.Contato = contato;
        emprestimo.Descricao = request.Descricao.Trim();
        emprestimo.Observacao = NormalizarTexto(request.Observacao);
        emprestimo.AtualizadoEm = DateTimeOffset.UtcNow;
        foreach (var lancamento in emprestimo.LancamentosFinanceiros)
        {
            lancamento.Descricao = emprestimo.Descricao;
        }
        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapearDetalhe(emprestimo);
    }

    public async Task<PagamentoEmprestimoResponse?> RegistrarPagamentoAsync(
        Guid usuarioId,
        Guid id,
        RegistrarPagamentoEmprestimoRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Data == default)
        {
            throw new InvalidOperationException("A data do pagamento é obrigatória.");
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var emprestimo = await _dbContext.Emprestimos
            .Include(item => item.Parcelas)
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId,
                cancellationToken);
        if (emprestimo is null)
        {
            return null;
        }

        if (emprestimo.Status is StatusEmprestimo.Cancelado or StatusEmprestimo.Pago)
        {
            throw new InvalidOperationException("Este empréstimo não possui parcelas disponíveis para pagamento.");
        }

        await ValidarContaRecebimentoAsync(usuarioId, request.ContaBancariaId, cancellationToken);

        var parcelaIds = request.ParcelaIds.Distinct().ToList();
        if (parcelaIds.Count != request.ParcelaIds.Count)
        {
            throw new InvalidOperationException("Uma parcela não pode ser selecionada mais de uma vez.");
        }

        if (emprestimo.QuantidadeParcelas == 1 && parcelaIds.Count == 0)
        {
            parcelaIds.Add(emprestimo.Parcelas.Single().Id);
        }

        if (parcelaIds.Count == 0)
        {
            throw new InvalidOperationException("Selecione ao menos uma parcela para registrar o pagamento.");
        }

        var parcelas = emprestimo.Parcelas
            .Where(parcela => parcelaIds.Contains(parcela.Id))
            .ToList();
        if (parcelas.Count != parcelaIds.Count)
        {
            throw new InvalidOperationException("Uma ou mais parcelas não pertencem a este empréstimo.");
        }

        if (parcelas.Any(parcela => parcela.Status != StatusParcelaEmprestimo.Pendente))
        {
            throw new InvalidOperationException("Uma ou mais parcelas já foram pagas ou canceladas.");
        }

        var pagamento = new PagamentoEmprestimo
        {
            UsuarioId = usuarioId,
            Emprestimo = emprestimo,
            Data = request.Data,
            ContaBancariaId = request.ContaBancariaId,
            ValorTotal = parcelas.Sum(parcela => parcela.Valor),
            Observacao = NormalizarTexto(request.Observacao)
        };

        foreach (var parcela in parcelas)
        {
            parcela.Status = StatusParcelaEmprestimo.Paga;
            parcela.DataPagamento = request.Data;
            parcela.PagamentoEmprestimo = pagamento;
        }

        var codigoExibicao = await ObterProximoCodigoExibicaoAsync(usuarioId, cancellationToken);
        pagamento.LancamentoFinanceiro = new Transacao
        {
            CodigoExibicao = codigoExibicao,
            UsuarioId = usuarioId,
            Tipo = TipoTransacao.Receita,
            Descricao = emprestimo.Descricao,
            Valor = pagamento.ValorTotal,
            DataOcorrencia = request.Data,
            FormaPagamento = "Recebimento de empréstimo",
            ContaBancariaId = request.ContaBancariaId,
            IsPaga = true,
            OrigemTransacao = OrigemTransacao.RecebimentoEmprestimo,
            Emprestimo = emprestimo,
            PagamentoEmprestimo = pagamento
        };

        emprestimo.Status = emprestimo.Parcelas.All(
            parcela => parcela.Status == StatusParcelaEmprestimo.Paga)
                ? StatusEmprestimo.Pago
                : StatusEmprestimo.ParcialmentePago;
        emprestimo.AtualizadoEm = DateTimeOffset.UtcNow;

        _dbContext.PagamentosEmprestimos.Add(pagamento);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return MapearPagamento(pagamento);
    }

    public async Task<EmprestimoDetalheResponse?> DesfazerPagamentoAsync(
        Guid usuarioId,
        Guid id,
        Guid pagamentoId,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var pagamento = await _dbContext.PagamentosEmprestimos
            .Include(item => item.Emprestimo)
                .ThenInclude(emprestimo => emprestimo.Parcelas)
            .Include(item => item.Parcelas)
            .SingleOrDefaultAsync(
                item => item.Id == pagamentoId &&
                    item.EmprestimoId == id &&
                    item.UsuarioId == usuarioId,
                cancellationToken);
        if (pagamento is null)
        {
            return null;
        }

        var lancamento = await _dbContext.Transacoes.SingleOrDefaultAsync(
            transacao => transacao.UsuarioId == usuarioId &&
                transacao.PagamentoEmprestimoId == pagamentoId,
            cancellationToken);
        if (lancamento is not null)
        {
            _dbContext.Transacoes.Remove(lancamento);
        }

        foreach (var parcela in pagamento.Parcelas)
        {
            parcela.Status = StatusParcelaEmprestimo.Pendente;
            parcela.DataPagamento = null;
            parcela.PagamentoEmprestimo = null;
            parcela.PagamentoEmprestimoId = null;
        }

        var emprestimo = pagamento.Emprestimo;
        emprestimo.Status = emprestimo.Parcelas.Any(
            parcela => parcela.Status == StatusParcelaEmprestimo.Paga)
                ? StatusEmprestimo.ParcialmentePago
                : StatusEmprestimo.EmAberto;
        emprestimo.IsArquivado = false;
        emprestimo.AtualizadoEm = DateTimeOffset.UtcNow;
        _dbContext.PagamentosEmprestimos.Remove(pagamento);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await ObterAsync(usuarioId, id, cancellationToken);
    }

    public async Task<EmprestimoDetalheResponse?> DefinirArquivamentoAsync(
        Guid usuarioId,
        Guid id,
        bool arquivar,
        CancellationToken cancellationToken = default)
    {
        var emprestimo = await _dbContext.Emprestimos.SingleOrDefaultAsync(
            item => item.Id == id && item.UsuarioId == usuarioId,
            cancellationToken);
        if (emprestimo is null)
        {
            return null;
        }

        if (arquivar && emprestimo.Status != StatusEmprestimo.Pago)
        {
            throw new InvalidOperationException("Somente empréstimos totalmente pagos podem ser arquivados.");
        }

        emprestimo.IsArquivado = arquivar;
        emprestimo.AtualizadoEm = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return await ObterAsync(usuarioId, id, cancellationToken);
    }

    public async Task<bool> CancelarAsync(
        Guid usuarioId,
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var emprestimo = await _dbContext.Emprestimos
            .Include(item => item.Parcelas)
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId,
                cancellationToken);
        if (emprestimo is null)
        {
            return false;
        }

        if (emprestimo.Status == StatusEmprestimo.Cancelado)
        {
            return true;
        }

        if (emprestimo.Parcelas.Any(parcela => parcela.Status == StatusParcelaEmprestimo.Paga))
        {
            throw new InvalidOperationException("Não é possível cancelar um empréstimo que já possui pagamentos.");
        }

        var lancamentos = await _dbContext.Transacoes
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.EmprestimoId == emprestimo.Id)
            .ToListAsync(cancellationToken);
        _dbContext.Transacoes.RemoveRange(lancamentos);

        emprestimo.Status = StatusEmprestimo.Cancelado;
        emprestimo.AtualizadoEm = DateTimeOffset.UtcNow;
        foreach (var parcela in emprestimo.Parcelas)
        {
            parcela.Status = StatusParcelaEmprestimo.Cancelada;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    internal static decimal CalcularValorParcela(decimal valorTotal, int quantidadeParcelas, int numeroParcela)
    {
        var valorBase = Math.Round(valorTotal / quantidadeParcelas, 2, MidpointRounding.AwayFromZero);
        return numeroParcela == quantidadeParcelas
            ? valorTotal - (valorBase * (quantidadeParcelas - 1))
            : valorBase;
    }

    private async Task CriarLancamentosConcessaoAsync(
        Emprestimo emprestimo,
        CancellationToken cancellationToken)
    {
        var codigoExibicao = await ObterProximoCodigoExibicaoAsync(
            emprestimo.UsuarioId,
            cancellationToken);

        if (emprestimo.OrigemFinanceira == OrigemFinanceiraEmprestimo.ContaBancaria)
        {
            emprestimo.LancamentosFinanceiros.Add(new Transacao
            {
                CodigoExibicao = codigoExibicao,
                UsuarioId = emprestimo.UsuarioId,
                Tipo = TipoTransacao.Despesa,
                Descricao = emprestimo.Descricao,
                Valor = emprestimo.ValorTotal,
                DataOcorrencia = emprestimo.Data,
                FormaPagamento = "Empréstimo via conta",
                ContaBancariaId = emprestimo.ContaBancariaId,
                IsPaga = true,
                OrigemTransacao = OrigemTransacao.EmprestimoConcedido
            });
            return;
        }

        foreach (var parcela in emprestimo.Parcelas.OrderBy(item => item.NumeroParcela))
        {
            emprestimo.LancamentosFinanceiros.Add(new Transacao
            {
                CodigoExibicao = codigoExibicao++,
                UsuarioId = emprestimo.UsuarioId,
                Tipo = TipoTransacao.Despesa,
                Descricao = emprestimo.Descricao,
                Valor = parcela.Valor,
                DataOcorrencia = parcela.DataVencimento,
                FormaPagamento = "Cartão de crédito",
                CartaoCreditoId = emprestimo.CartaoCreditoId,
                IsPaga = false,
                OrigemTransacao = OrigemTransacao.EmprestimoConcedido,
                ParcelaEmprestimo = parcela
            });
        }
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

    private IQueryable<Emprestimo> ObterDetalheQuery(Guid usuarioId, Guid id) =>
        _dbContext.Emprestimos
            .AsSplitQuery()
            .Include(emprestimo => emprestimo.Contato)
            .Include(emprestimo => emprestimo.Parcelas)
            .Include(emprestimo => emprestimo.Pagamentos)
                .ThenInclude(pagamento => pagamento.Parcelas)
            .Include(emprestimo => emprestimo.LancamentosFinanceiros)
            .Where(emprestimo => emprestimo.Id == id && emprestimo.UsuarioId == usuarioId);

    private async Task ValidarOrigemAsync(
        Guid usuarioId,
        CriarEmprestimoRequest request,
        CancellationToken cancellationToken)
    {
        if (request.OrigemFinanceira == OrigemFinanceiraEmprestimo.CartaoCredito)
        {
            if (!request.CartaoCreditoId.HasValue || request.ContaBancariaId.HasValue)
            {
                throw new InvalidOperationException("Informe somente o cartão de crédito para esta origem.");
            }

            var existe = await _dbContext.CartoesCredito.AnyAsync(
                cartao => cartao.Id == request.CartaoCreditoId.Value &&
                    cartao.UsuarioId == usuarioId &&
                    !cartao.IsArquivado,
                cancellationToken);
            if (!existe)
            {
                throw new InvalidOperationException("Cartão de crédito não encontrado para este usuário.");
            }

            return;
        }

        if (request.OrigemFinanceira == OrigemFinanceiraEmprestimo.ContaBancaria)
        {
            if (!request.ContaBancariaId.HasValue || request.CartaoCreditoId.HasValue)
            {
                throw new InvalidOperationException("Informe somente a conta bancária para esta origem.");
            }

            var existe = await _dbContext.ContasBancarias.AnyAsync(
                conta => conta.Id == request.ContaBancariaId.Value &&
                    conta.UsuarioId == usuarioId &&
                    !conta.IsArquivada,
                cancellationToken);
            if (!existe)
            {
                throw new InvalidOperationException("Conta bancária não encontrada para este usuário.");
            }

            return;
        }

        throw new InvalidOperationException("Origem financeira inválida.");
    }

    private async Task ValidarContaRecebimentoAsync(
        Guid usuarioId,
        Guid? contaBancariaId,
        CancellationToken cancellationToken)
    {
        if (!contaBancariaId.HasValue)
        {
            return;
        }

        var existe = await _dbContext.ContasBancarias.AnyAsync(
            conta => conta.Id == contaBancariaId.Value &&
                conta.UsuarioId == usuarioId &&
                !conta.IsArquivada,
            cancellationToken);
        if (!existe)
        {
            throw new InvalidOperationException("Conta de recebimento não encontrada para este usuário.");
        }
    }

    private static void ValidarCriacao(CriarEmprestimoRequest request)
    {
        if (request.ContatoId == Guid.Empty)
        {
            throw new InvalidOperationException("O contato é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(request.Descricao))
        {
            throw new InvalidOperationException("A descrição do empréstimo é obrigatória.");
        }

        if (request.ValorTotal <= 0)
        {
            throw new InvalidOperationException("O valor total deve ser maior que zero.");
        }

        if (request.Data == default)
        {
            throw new InvalidOperationException("A data do empréstimo é obrigatória.");
        }

        if (request.QuantidadeParcelas is < 1 or > 360)
        {
            throw new InvalidOperationException("A quantidade de parcelas deve estar entre 1 e 360.");
        }
    }

    private static EmprestimoResumoResponse MapearResumo(Emprestimo emprestimo)
    {
        var valorPago = emprestimo.Parcelas
            .Where(parcela => parcela.Status == StatusParcelaEmprestimo.Paga)
            .Sum(parcela => parcela.Valor);
        return new EmprestimoResumoResponse
        {
            Id = emprestimo.Id,
            ContatoId = emprestimo.ContatoId,
            ContatoNome = emprestimo.Contato.Nome,
            Descricao = emprestimo.Descricao,
            ValorTotal = emprestimo.ValorTotal,
            ValorPago = valorPago,
            SaldoReceber = emprestimo.Status == StatusEmprestimo.Cancelado
                ? 0m
                : emprestimo.ValorTotal - valorPago,
            Data = emprestimo.Data,
            OrigemFinanceira = emprestimo.OrigemFinanceira,
            QuantidadeParcelas = emprestimo.QuantidadeParcelas,
            ParcelasPagas = emprestimo.Parcelas.Count(parcela => parcela.Status == StatusParcelaEmprestimo.Paga),
            Status = emprestimo.Status,
            IsArquivado = emprestimo.IsArquivado
        };
    }

    private static EmprestimoDetalheResponse MapearDetalhe(Emprestimo emprestimo)
    {
        var resumo = MapearResumo(emprestimo);
        return new EmprestimoDetalheResponse
        {
            Id = resumo.Id,
            ContatoId = resumo.ContatoId,
            ContatoNome = resumo.ContatoNome,
            Descricao = resumo.Descricao,
            ValorTotal = resumo.ValorTotal,
            ValorPago = resumo.ValorPago,
            SaldoReceber = resumo.SaldoReceber,
            Data = resumo.Data,
            OrigemFinanceira = resumo.OrigemFinanceira,
            QuantidadeParcelas = resumo.QuantidadeParcelas,
            ParcelasPagas = resumo.ParcelasPagas,
            Status = resumo.Status,
            IsArquivado = resumo.IsArquivado,
            CartaoCreditoId = emprestimo.CartaoCreditoId,
            ContaBancariaId = emprestimo.ContaBancariaId,
            Observacao = emprestimo.Observacao,
            CriadoEm = emprestimo.CriadoEm,
            AtualizadoEm = emprestimo.AtualizadoEm,
            Parcelas = emprestimo.Parcelas
                .OrderBy(parcela => parcela.NumeroParcela)
                .Select(parcela => new ParcelaEmprestimoResponse
                {
                    Id = parcela.Id,
                    NumeroParcela = parcela.NumeroParcela,
                    QuantidadeTotal = emprestimo.QuantidadeParcelas,
                    DataVencimento = parcela.DataVencimento,
                    Valor = parcela.Valor,
                    Status = parcela.Status,
                    DataPagamento = parcela.DataPagamento,
                    PagamentoEmprestimoId = parcela.PagamentoEmprestimoId
                })
                .ToList(),
            Pagamentos = emprestimo.Pagamentos
                .OrderByDescending(pagamento => pagamento.Data)
                .ThenByDescending(pagamento => pagamento.CriadoEm)
                .Select(MapearPagamento)
                .ToList()
        };
    }

    private static PagamentoEmprestimoResponse MapearPagamento(PagamentoEmprestimo pagamento) => new()
    {
        Id = pagamento.Id,
        Data = pagamento.Data,
        ContaBancariaId = pagamento.ContaBancariaId,
        ValorTotal = pagamento.ValorTotal,
        Observacao = pagamento.Observacao,
        ParcelaIds = pagamento.Parcelas.Select(parcela => parcela.Id).ToList(),
        CriadoEm = pagamento.CriadoEm
    };

    private static string? NormalizarTexto(string? texto) =>
        string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();
}
