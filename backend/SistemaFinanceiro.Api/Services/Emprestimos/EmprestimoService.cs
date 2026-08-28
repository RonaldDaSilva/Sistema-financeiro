using System.Data;
using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Emprestimos;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.CartoesCredito;

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

    public async Task<ResumoMensalEmprestimosResponse> ObterResumoMensalAsync(
        Guid usuarioId,
        int mes,
        int ano,
        Guid? contatoId = null,
        bool incluirArquivados = false,
        int pagina = 1,
        int tamanhoPagina = 50,
        CancellationToken cancellationToken = default)
    {
        var inicioMes = new DateOnly(ano, mes, 1);
        var hoje = DateOnly.FromDateTime(DateTime.Now);
        var competenciaAtual = new DateOnly(hoje.Year, hoje.Month, 1);
        var query = _dbContext.Emprestimos
            .AsNoTracking()
            .AsSplitQuery()
            .Include(emprestimo => emprestimo.Contato)
            .Include(emprestimo => emprestimo.CartaoCredito)
            .Include(emprestimo => emprestimo.ContaBancaria)
            .Include(emprestimo => emprestimo.Parcelas)
            .Include(emprestimo => emprestimo.AlteracoesRecorrencia)
            .Where(emprestimo => emprestimo.UsuarioId == usuarioId);

        if (!incluirArquivados)
        {
            query = query.Where(emprestimo => !emprestimo.IsArquivado);
        }

        if (contatoId.HasValue)
        {
            query = query.Where(emprestimo => emprestimo.ContatoId == contatoId.Value);
        }

        var emprestimos = await query.ToListAsync(cancellationToken);
        var pagamentosNoMes = await _dbContext.PagamentosEmprestimos
            .AsNoTracking()
            .Where(pagamento =>
                pagamento.UsuarioId == usuarioId &&
                pagamento.Data >= inicioMes &&
                pagamento.Data < inicioMes.AddMonths(1) &&
                (incluirArquivados || !pagamento.Emprestimo.IsArquivado) &&
                (!contatoId.HasValue || pagamento.Emprestimo.ContatoId == contatoId.Value))
            .Select(pagamento => pagamento.ValorTotal)
            .ToListAsync(cancellationToken);
        var recebidoNoMes = pagamentosNoMes.Sum();

        var ocorrenciasMes = emprestimos
            .Where(item => item.Status != StatusEmprestimo.Cancelado)
            .Select(item => (Emprestimo: item, Ocorrencia: ObterOcorrenciaNoMes(item, inicioMes)))
            .Where(item => item.Ocorrencia is not null)
            .OrderByDescending(item => item.Ocorrencia!.Vencimento)
            .ThenBy(item => item.Emprestimo.Descricao)
            .ToList();
        var totalItens = ocorrenciasMes.Count;
        var itens = ocorrenciasMes
            .Skip((pagina - 1) * tamanhoPagina)
            .Take(tamanhoPagina)
            .Select(item => MapearItemMensal(item.Emprestimo, item.Ocorrencia!, competenciaAtual))
            .ToList();

        return new ResumoMensalEmprestimosResponse
        {
            Mes = mes,
            Ano = ano,
            AReceberTotal = emprestimos.Sum(item => CalcularSaldoConstituido(item, competenciaAtual)),
            PrevistoNoMes = ocorrenciasMes.Sum(item => item.Ocorrencia!.Valor),
            RecebidoNoMes = recebidoNoMes,
            Pagina = pagina,
            TamanhoPagina = tamanhoPagina,
            TotalItens = totalItens,
            TotalPaginas = totalItens == 0 ? 0 : (int)Math.Ceiling(totalItens / (decimal)tamanhoPagina),
            Itens = itens
        };
    }

    private static DateOnly? ObterCompetencia(
        OrigemFinanceiraEmprestimo origem,
        DateOnly dataReferencia,
        int? melhorDiaCompra,
        int? diaVencimento)
    {
        if (origem != OrigemFinanceiraEmprestimo.CartaoCredito)
        {
            return dataReferencia;
        }

        if (!melhorDiaCompra.HasValue || !diaVencimento.HasValue)
        {
            return null;
        }

        var cartao = new CartaoCredito
        {
            MelhorDiaCompra = melhorDiaCompra.Value,
            DiaVencimento = diaVencimento.Value
        };
        return CicloFaturaCartaoCalculator.CalcularParaCompra(cartao, dataReferencia).DataVencimento;
    }

    private static OcorrenciaEmprestimo? ObterOcorrenciaNoMes(Emprestimo emprestimo, DateOnly mes)
    {
        if (emprestimo.Tipo != TipoEmprestimo.Fixo)
        {
            var parcela = emprestimo.Parcelas.FirstOrDefault(item =>
            {
                var vencimento = ObterVencimento(emprestimo, item.Competencia == default ? item.DataVencimento : item.Competencia);
                return vencimento.Year == mes.Year && vencimento.Month == mes.Month;
            });
            return parcela is null
                ? null
                : new OcorrenciaEmprestimo(
                    parcela.Competencia == default ? parcela.DataVencimento : parcela.Competencia,
                    ObterVencimento(emprestimo, parcela.Competencia == default ? parcela.DataVencimento : parcela.Competencia),
                    parcela.Valor,
                    parcela.Status,
                    parcela.NumeroParcela,
                    parcela);
        }

        var referencia = EncontrarReferenciaPorMesDeVencimento(emprestimo, mes);
        if (!referencia.HasValue || !RecorrenciaContem(emprestimo, referencia.Value))
        {
            return null;
        }

        var persistida = emprestimo.Parcelas.SingleOrDefault(item => item.Competencia == referencia.Value);
        return new OcorrenciaEmprestimo(
            referencia.Value,
            ObterVencimento(emprestimo, referencia.Value),
            persistida?.Valor ?? ObterValorRecorrencia(emprestimo, referencia.Value),
            persistida?.Status ?? StatusParcelaEmprestimo.Pendente,
            ObterNumeroCompetencia(emprestimo, referencia.Value),
            persistida);
    }

    private static DateOnly? EncontrarReferenciaPorMesDeVencimento(Emprestimo emprestimo, DateOnly mes)
    {
        for (var deslocamento = -2; deslocamento <= 1; deslocamento++)
        {
            var referencia = new DateOnly(mes.Year, mes.Month, 1).AddMonths(deslocamento);
            referencia = new DateOnly(
                referencia.Year,
                referencia.Month,
                Math.Min(emprestimo.Data.Day, DateTime.DaysInMonth(referencia.Year, referencia.Month)));
            var vencimento = ObterVencimento(emprestimo, referencia);
            if (vencimento.Year == mes.Year && vencimento.Month == mes.Month)
            {
                return referencia;
            }
        }
        return null;
    }

    private static bool RecorrenciaContem(Emprestimo emprestimo, DateOnly referencia) =>
        emprestimo.Tipo == TipoEmprestimo.Fixo &&
        emprestimo.Status != StatusEmprestimo.Cancelado &&
        referencia >= emprestimo.Data &&
        (!emprestimo.DataFimRecorrencia.HasValue || referencia <= emprestimo.DataFimRecorrencia.Value);

    private static decimal ObterValorRecorrencia(Emprestimo emprestimo, DateOnly competencia)
    {
        var exata = emprestimo.AlteracoesRecorrencia
            .Where(item => item.Escopo == EscopoAlteracaoRecorrenciaEmprestimo.SomenteCompetencia &&
                MesmoMes(item.Competencia, competencia))
            .OrderByDescending(item => item.CriadoEm)
            .FirstOrDefault();
        if (exata is not null) return exata.Valor;

        return emprestimo.AlteracoesRecorrencia
            .Where(item => item.Escopo == EscopoAlteracaoRecorrenciaEmprestimo.DestaCompetenciaEmDiante &&
                item.Competencia <= competencia)
            .OrderByDescending(item => item.Competencia)
            .ThenByDescending(item => item.CriadoEm)
            .Select(item => (decimal?)item.Valor)
            .FirstOrDefault() ?? emprestimo.ValorTotal;
    }

    private static decimal CalcularSaldoConstituido(Emprestimo emprestimo, DateOnly competenciaAtual)
    {
        if (emprestimo.Status == StatusEmprestimo.Cancelado) return 0m;
        if (emprestimo.Tipo != TipoEmprestimo.Fixo)
        {
            return emprestimo.Parcelas
                .Where(item => item.Status == StatusParcelaEmprestimo.Pendente)
                .Sum(item => item.Valor);
        }

        decimal total = 0m;
        var referencia = emprestimo.Data;
        while (referencia <= competenciaAtual.AddMonths(1) && RecorrenciaContem(emprestimo, referencia))
        {
            var vencimento = ObterVencimento(emprestimo, referencia);
            if (vencimento.Year > competenciaAtual.Year ||
                (vencimento.Year == competenciaAtual.Year && vencimento.Month > competenciaAtual.Month)) break;
            var persistida = emprestimo.Parcelas.SingleOrDefault(item => item.Competencia == referencia);
            if (persistida is null || persistida.Status == StatusParcelaEmprestimo.Pendente)
            {
                total += persistida?.Valor ?? ObterValorRecorrencia(emprestimo, referencia);
            }
            referencia = emprestimo.Data.AddMonths(ObterNumeroCompetencia(emprestimo, referencia));
        }
        return total;
    }

    private static EmprestimoMensalItemResponse MapearItemMensal(
        Emprestimo emprestimo,
        OcorrenciaEmprestimo ocorrencia,
        DateOnly competenciaAtual)
    {
        var valorPago = emprestimo.Parcelas.Where(item => item.Status == StatusParcelaEmprestimo.Paga).Sum(item => item.Valor);
        return new EmprestimoMensalItemResponse
        {
            Id = emprestimo.Id,
            ContatoId = emprestimo.ContatoId,
            ContatoNome = emprestimo.Contato.Nome,
            Descricao = emprestimo.Descricao,
            ValorTotal = emprestimo.ValorTotal,
            ValorPago = valorPago,
            SaldoReceber = CalcularSaldoConstituido(emprestimo, competenciaAtual),
            Data = emprestimo.Data,
            Tipo = emprestimo.Tipo,
            DataFimRecorrencia = emprestimo.DataFimRecorrencia,
            RecorrenciaAtiva = RecorrenciaEstaAtivaAgora(emprestimo),
            OrigemFinanceira = emprestimo.OrigemFinanceira,
            OrigemNome = emprestimo.OrigemFinanceira == OrigemFinanceiraEmprestimo.CartaoCredito
                ? emprestimo.CartaoCredito?.ApelidoCartao ?? "Cartão"
                : emprestimo.ContaBancaria?.NomeCustomizado ?? "Conta bancária",
            QuantidadeParcelas = emprestimo.QuantidadeParcelas,
            ParcelasPagas = emprestimo.Parcelas.Count(item => item.Status == StatusParcelaEmprestimo.Paga),
            Status = emprestimo.Status,
            IsArquivado = emprestimo.IsArquivado,
            ValorCompetencia = ocorrencia.Valor,
            DataCompetencia = ocorrencia.Vencimento,
            NumeroParcelaCompetencia = emprestimo.Tipo == TipoEmprestimo.Fixo ? null : ocorrencia.Numero,
            StatusCompetencia = ocorrencia.Status,
            ProximoVencimento = ocorrencia.Vencimento
        };
    }

    private static DateOnly ObterVencimento(Emprestimo emprestimo, DateOnly referencia) =>
        ObterCompetencia(
            emprestimo.OrigemFinanceira,
            referencia,
            emprestimo.CartaoCredito?.MelhorDiaCompra,
            emprestimo.CartaoCredito?.DiaVencimento) ?? referencia;

    private static int ObterNumeroCompetencia(Emprestimo emprestimo, DateOnly competencia) =>
        ((competencia.Year - emprestimo.Data.Year) * 12) + competencia.Month - emprestimo.Data.Month + 1;

    private static bool MesmoMes(DateOnly esquerda, DateOnly direita) =>
        esquerda.Year == direita.Year && esquerda.Month == direita.Month;

    private static bool RecorrenciaEstaAtivaAgora(Emprestimo emprestimo)
    {
        var hoje = DateOnly.FromDateTime(DateTime.Now);
        return emprestimo.Tipo == TipoEmprestimo.Fixo &&
            emprestimo.Status != StatusEmprestimo.Cancelado &&
            (!emprestimo.DataFimRecorrencia.HasValue || emprestimo.DataFimRecorrencia.Value >= hoje);
    }

    private sealed record OcorrenciaEmprestimo(
        DateOnly Competencia,
        DateOnly Vencimento,
        decimal Valor,
        StatusParcelaEmprestimo Status,
        int Numero,
        ParcelaEmprestimo? Parcela);

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
            Tipo = request.Tipo == TipoEmprestimo.Avista && request.QuantidadeParcelas > 1
                ? TipoEmprestimo.Parcelado
                : request.Tipo,
            DataFimRecorrencia = request.Tipo == TipoEmprestimo.Fixo ? request.DataFimRecorrencia : null,
            RecorrenciaAtiva = request.Tipo == TipoEmprestimo.Fixo &&
                (!request.DataFimRecorrencia.HasValue || request.DataFimRecorrencia.Value >= DateOnly.FromDateTime(DateTime.Now)),
            OrigemFinanceira = request.OrigemFinanceira,
            CartaoCreditoId = request.CartaoCreditoId,
            ContaBancariaId = request.ContaBancariaId,
            QuantidadeParcelas = request.QuantidadeParcelas,
            Observacao = NormalizarTexto(request.Observacao)
        };

        var quantidadeMaterializada = emprestimo.Tipo == TipoEmprestimo.Fixo ? 1 : request.QuantidadeParcelas;
        for (var numero = 1; numero <= quantidadeMaterializada; numero++)
        {
            emprestimo.Parcelas.Add(new ParcelaEmprestimo
            {
                UsuarioId = usuarioId,
                NumeroParcela = numero,
                Competencia = request.Data.AddMonths(numero - 1),
                DataVencimento = request.Data.AddMonths(numero - 1),
                Valor = emprestimo.Tipo == TipoEmprestimo.Fixo
                    ? request.ValorTotal
                    : CalcularValorParcela(request.ValorTotal, request.QuantidadeParcelas, numero)
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
            .Include(item => item.AlteracoesRecorrencia)
            .Include(item => item.CartaoCredito)
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId,
                cancellationToken);
        if (emprestimo is null)
        {
            return null;
        }

        if (emprestimo.Status == StatusEmprestimo.Cancelado ||
            (emprestimo.Tipo != TipoEmprestimo.Fixo && emprestimo.Status == StatusEmprestimo.Pago))
        {
            throw new InvalidOperationException("Este empréstimo não possui parcelas disponíveis para pagamento.");
        }

        await ValidarContaRecebimentoAsync(usuarioId, request.ContaBancariaId, cancellationToken);

        var parcelaIds = request.ParcelaIds.Distinct().ToList();
        if (parcelaIds.Count != request.ParcelaIds.Count)
        {
            throw new InvalidOperationException("Uma parcela não pode ser selecionada mais de uma vez.");
        }

        var competencias = request.Competencias
            .Select(item => new DateOnly(item.Year, item.Month, Math.Min(emprestimo.Data.Day, DateTime.DaysInMonth(item.Year, item.Month))))
            .Distinct()
            .ToList();
        if (emprestimo.Tipo == TipoEmprestimo.Fixo)
        {
            foreach (var competencia in competencias)
            {
                if (!RecorrenciaContem(emprestimo, competencia))
                {
                    throw new InvalidOperationException("Uma ou mais competências não pertencem à recorrência ativa.");
                }
                var existente = emprestimo.Parcelas.SingleOrDefault(item => MesmoMes(item.Competencia, competencia));
                if (existente is null)
                {
                    existente = new ParcelaEmprestimo
                    {
                        UsuarioId = usuarioId,
                        Emprestimo = emprestimo,
                        NumeroParcela = ObterNumeroCompetencia(emprestimo, competencia),
                        Competencia = competencia,
                        DataVencimento = competencia,
                        Valor = ObterValorRecorrencia(emprestimo, competencia)
                    };
                    emprestimo.Parcelas.Add(existente);
                    await CriarLancamentoConcessaoOcorrenciaAsync(emprestimo, existente, cancellationToken);
                }
                parcelaIds.Add(existente.Id);
            }
            parcelaIds = parcelaIds.Distinct().ToList();
        }

        if (emprestimo.Tipo != TipoEmprestimo.Fixo && emprestimo.QuantidadeParcelas == 1 && parcelaIds.Count == 0)
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

        emprestimo.Status = emprestimo.Tipo != TipoEmprestimo.Fixo && emprestimo.Parcelas.All(
            parcela => parcela.Status == StatusParcelaEmprestimo.Paga)
                ? StatusEmprestimo.Pago
                : StatusEmprestimo.ParcialmentePago;
        emprestimo.AtualizadoEm = DateTimeOffset.UtcNow;

        _dbContext.PagamentosEmprestimos.Add(pagamento);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return MapearPagamento(pagamento);
    }

    public async Task<EmprestimoDetalheResponse?> AlterarRecorrenciaAsync(
        Guid usuarioId,
        Guid id,
        AlteracaoRecorrenciaEmprestimoRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Valor <= 0 || request.Competencia == default ||
            !Enum.IsDefined(request.Escopo))
        {
            throw new InvalidOperationException("Informe competência, valor e escopo válidos.");
        }

        var emprestimo = await _dbContext.Emprestimos
            .Include(item => item.Parcelas)
            .Include(item => item.AlteracoesRecorrencia)
            .SingleOrDefaultAsync(item => item.Id == id && item.UsuarioId == usuarioId, cancellationToken);
        if (emprestimo is null) return null;
        if (emprestimo.Tipo != TipoEmprestimo.Fixo)
            throw new InvalidOperationException("Somente empréstimos fixos possuem alterações por competência.");

        var competencia = new DateOnly(
            request.Competencia.Year,
            request.Competencia.Month,
            Math.Min(emprestimo.Data.Day, DateTime.DaysInMonth(request.Competencia.Year, request.Competencia.Month)));
        if (!RecorrenciaContem(emprestimo, competencia))
            throw new InvalidOperationException("A competência não pertence a esta recorrência.");
        if (emprestimo.Parcelas.Any(item => MesmoMes(item.Competencia, competencia) && item.Status == StatusParcelaEmprestimo.Paga))
            throw new InvalidOperationException("Uma competência já paga não pode ter seu valor alterado.");

        var existente = emprestimo.AlteracoesRecorrencia.SingleOrDefault(item =>
            MesmoMes(item.Competencia, competencia) && item.Escopo == request.Escopo);
        if (existente is null)
        {
            emprestimo.AlteracoesRecorrencia.Add(new AlteracaoRecorrenciaEmprestimo
            {
                UsuarioId = usuarioId,
                Competencia = competencia,
                Valor = request.Valor,
                Escopo = request.Escopo
            });
        }
        else
        {
            existente.Valor = request.Valor;
            existente.CriadoEm = DateTimeOffset.UtcNow;
        }

        var parcelaConstituida = emprestimo.Parcelas.SingleOrDefault(item =>
            MesmoMes(item.Competencia, competencia) && item.Status == StatusParcelaEmprestimo.Pendente);
        if (parcelaConstituida is not null)
        {
            parcelaConstituida.Valor = request.Valor;
            var lancamento = await _dbContext.Transacoes.SingleOrDefaultAsync(
                item => item.UsuarioId == usuarioId && item.ParcelaEmprestimoId == parcelaConstituida.Id,
                cancellationToken);
            if (lancamento is not null) lancamento.Valor = request.Valor;
        }
        emprestimo.AtualizadoEm = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return await ObterAsync(usuarioId, id, cancellationToken);
    }

    public async Task<EmprestimoDetalheResponse?> EncerrarRecorrenciaAsync(
        Guid usuarioId,
        Guid id,
        EncerrarRecorrenciaEmprestimoRequest request,
        CancellationToken cancellationToken = default)
    {
        var emprestimo = await _dbContext.Emprestimos.SingleOrDefaultAsync(
            item => item.Id == id && item.UsuarioId == usuarioId,
            cancellationToken);
        if (emprestimo is null) return null;
        if (emprestimo.Tipo != TipoEmprestimo.Fixo)
            throw new InvalidOperationException("Somente empréstimos fixos podem ter a recorrência encerrada.");
        if (request.UltimaCompetencia < emprestimo.Data)
            throw new InvalidOperationException("A última competência não pode ser anterior ao início.");

        emprestimo.DataFimRecorrencia = new DateOnly(
            request.UltimaCompetencia.Year,
            request.UltimaCompetencia.Month,
            Math.Min(emprestimo.Data.Day, DateTime.DaysInMonth(request.UltimaCompetencia.Year, request.UltimaCompetencia.Month)));
        emprestimo.RecorrenciaAtiva = false;
        emprestimo.AtualizadoEm = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return await ObterAsync(usuarioId, id, cancellationToken);
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

    public async Task<bool> ExcluirAsync(
        Guid usuarioId,
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var emprestimo = await _dbContext.Emprestimos
            .Include(item => item.Parcelas)
            .Include(item => item.Pagamentos)
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId,
                cancellationToken);
        if (emprestimo is null)
        {
            return false;
        }

        if (emprestimo.Pagamentos.Count > 0 ||
            emprestimo.Parcelas.Any(parcela => parcela.Status == StatusParcelaEmprestimo.Paga))
        {
            throw new InvalidOperationException(
                "Este empréstimo já possui pagamentos registrados e não pode ser excluído diretamente.");
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var lancamentos = await _dbContext.Transacoes
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.EmprestimoId == emprestimo.Id)
            .ToListAsync(cancellationToken);
        _dbContext.Transacoes.RemoveRange(lancamentos);
        _dbContext.Emprestimos.Remove(emprestimo);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
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

    private async Task CriarLancamentoConcessaoOcorrenciaAsync(
        Emprestimo emprestimo,
        ParcelaEmprestimo parcela,
        CancellationToken cancellationToken)
    {
        var codigo = await ObterProximoCodigoExibicaoAsync(emprestimo.UsuarioId, cancellationToken);
        emprestimo.LancamentosFinanceiros.Add(new Transacao
        {
            CodigoExibicao = codigo,
            UsuarioId = emprestimo.UsuarioId,
            Tipo = TipoTransacao.Despesa,
            Descricao = emprestimo.Descricao,
            Valor = parcela.Valor,
            DataOcorrencia = parcela.Competencia,
            FormaPagamento = emprestimo.OrigemFinanceira == OrigemFinanceiraEmprestimo.CartaoCredito
                ? "Cartão de crédito"
                : "Empréstimo via conta",
            CartaoCreditoId = emprestimo.CartaoCreditoId,
            ContaBancariaId = emprestimo.ContaBancariaId,
            IsPaga = emprestimo.OrigemFinanceira == OrigemFinanceiraEmprestimo.ContaBancaria,
            OrigemTransacao = OrigemTransacao.EmprestimoConcedido,
            Emprestimo = emprestimo,
            ParcelaEmprestimo = parcela
        });
    }

    private async Task<int> ObterProximoCodigoExibicaoAsync(
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var ultimoCodigo = await _dbContext.Transacoes
            .Where(transacao => transacao.UsuarioId == usuarioId)
            .MaxAsync(transacao => (int?)transacao.CodigoExibicao, cancellationToken);
        var ultimoRastreado = _dbContext.ChangeTracker
            .Entries<Transacao>()
            .Where(item => item.State == EntityState.Added && item.Entity.UsuarioId == usuarioId)
            .Select(item => (int?)item.Entity.CodigoExibicao)
            .Max();
        return Math.Max(ultimoCodigo ?? 0, ultimoRastreado ?? 0) + 1;
    }

    private IQueryable<Emprestimo> ObterDetalheQuery(Guid usuarioId, Guid id) =>
        _dbContext.Emprestimos
            .AsSplitQuery()
            .Include(emprestimo => emprestimo.Contato)
            .Include(emprestimo => emprestimo.Parcelas)
            .Include(emprestimo => emprestimo.AlteracoesRecorrencia)
            .Include(emprestimo => emprestimo.CartaoCredito)
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

        if (!Enum.IsDefined(request.Tipo))
        {
            throw new InvalidOperationException("Tipo de empréstimo inválido.");
        }

        if (request.Tipo == TipoEmprestimo.Fixo &&
            request.DataFimRecorrencia.HasValue && request.DataFimRecorrencia.Value < request.Data)
        {
            throw new InvalidOperationException("A data final não pode ser anterior à data inicial.");
        }

        if (request.Tipo != TipoEmprestimo.Fixo && request.QuantidadeParcelas is < 1 or > 360)
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
                : emprestimo.Tipo == TipoEmprestimo.Fixo
                    ? CalcularSaldoConstituido(
                        emprestimo,
                        new DateOnly(DateTime.Now.Year, DateTime.Now.Month, 1))
                    : emprestimo.ValorTotal - valorPago,
            Data = emprestimo.Data,
            Tipo = emprestimo.Tipo,
            DataFimRecorrencia = emprestimo.DataFimRecorrencia,
            RecorrenciaAtiva = RecorrenciaEstaAtivaAgora(emprestimo),
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
            Tipo = resumo.Tipo,
            DataFimRecorrencia = resumo.DataFimRecorrencia,
            RecorrenciaAtiva = resumo.RecorrenciaAtiva,
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
            Parcelas = MapearParcelasDetalhe(emprestimo),
            Pagamentos = emprestimo.Pagamentos
                .OrderByDescending(pagamento => pagamento.Data)
                .ThenByDescending(pagamento => pagamento.CriadoEm)
                .Select(MapearPagamento)
                .ToList(),
            AlteracoesRecorrencia = emprestimo.AlteracoesRecorrencia
                .OrderBy(item => item.Competencia)
                .Select(item => new AlteracaoRecorrenciaEmprestimoResponse
                {
                    Id = item.Id,
                    Competencia = item.Competencia,
                    Valor = item.Valor,
                    Escopo = item.Escopo
                })
                .ToList()
        };
    }

    private static IReadOnlyList<ParcelaEmprestimoResponse> MapearParcelasDetalhe(Emprestimo emprestimo)
    {
        if (emprestimo.Tipo != TipoEmprestimo.Fixo)
        {
            return emprestimo.Parcelas.OrderBy(item => item.NumeroParcela).Select(item => MapearParcela(item, emprestimo.QuantidadeParcelas)).ToList();
        }

        var inicioJanela = new DateOnly(DateTime.Now.Year, DateTime.Now.Month, 1).AddMonths(-6);
        var fimJanela = inicioJanela.AddMonths(18);
        var referencias = new List<DateOnly>();
        for (var referencia = emprestimo.Data; referencia < fimJanela && RecorrenciaContem(emprestimo, referencia); referencia = emprestimo.Data.AddMonths(ObterNumeroCompetencia(emprestimo, referencia)))
        {
            if (referencia >= inicioJanela || emprestimo.Parcelas.Any(item => MesmoMes(item.Competencia, referencia)))
                referencias.Add(referencia);
        }
        referencias.AddRange(emprestimo.Parcelas.Select(item => item.Competencia));

        return referencias.Distinct().OrderBy(item => item).Select(referencia =>
        {
            var persistida = emprestimo.Parcelas.SingleOrDefault(item => MesmoMes(item.Competencia, referencia));
            return persistida is not null
                ? MapearParcela(persistida, 0)
                : new ParcelaEmprestimoResponse
                {
                    Id = Guid.Empty,
                    NumeroParcela = ObterNumeroCompetencia(emprestimo, referencia),
                    QuantidadeTotal = 0,
                    Competencia = referencia,
                    DataVencimento = ObterVencimento(emprestimo, referencia),
                    Valor = ObterValorRecorrencia(emprestimo, referencia),
                    Status = StatusParcelaEmprestimo.Pendente,
                    IsVirtual = true
                };
        }).ToList();
    }

    private static ParcelaEmprestimoResponse MapearParcela(ParcelaEmprestimo parcela, int quantidadeTotal) => new()
    {
        Id = parcela.Id,
        NumeroParcela = parcela.NumeroParcela,
        QuantidadeTotal = quantidadeTotal,
        Competencia = parcela.Competencia == default ? parcela.DataVencimento : parcela.Competencia,
        DataVencimento = parcela.DataVencimento,
        Valor = parcela.Valor,
        Status = parcela.Status,
        DataPagamento = parcela.DataPagamento,
        PagamentoEmprestimoId = parcela.PagamentoEmprestimoId,
        IsVirtual = false
    };

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
