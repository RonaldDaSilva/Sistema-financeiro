using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Divisoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.CartoesCredito;

namespace SistemaFinanceiro.Api.Services.Divisoes;

public sealed class DivisaoTransacaoService : IDivisaoTransacaoService
{
    private const int LimiteResolucaoEmailPorMinuto = 10;
    private const string EntidadeDivisao = "DivisaoTransacao";
    private static readonly ConcurrentDictionary<Guid, Queue<DateTimeOffset>> ResolucaoEmailPorUsuario = new();

    private readonly AppDbContext _dbContext;

    public DivisaoTransacaoService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<DivisaoTransacaoResponse?> ObterAsync(
        Guid usuarioId,
        Guid divisaoId,
        CancellationToken cancellationToken = default)
    {
        var divisao = await _dbContext.DivisoesTransacoes
            .IgnoreQueryFilters()
            .Include(item => item.Participantes)
                .ThenInclude(participante => participante.ParticipanteUsuario)
            .Include(item => item.Versoes)
                .ThenInclude(versao => versao.Participantes)
            .Include(item => item.CompraParcelada)
                .ThenInclude(compra => compra!.CartaoCredito)
            .Include(item => item.TransacaoOrigem)
                .ThenInclude(transacao => transacao!.CartaoCredito)
            .SingleOrDefaultAsync(
                item => item.Id == divisaoId &&
                    (item.UsuarioCriadorId == usuarioId ||
                        item.Participantes.Any(participante =>
                            participante.UsuarioId == usuarioId ||
                            participante.ParticipanteUsuarioId == usuarioId)),
                cancellationToken);

        return divisao is null ? null : Mapear(divisao, usuarioId);
    }

    public async Task<DivisoesCompartilhadasResponse> ListarCompartilhadasAsync(
        Guid usuarioId,
        ListarDivisoesCompartilhadasRequest request,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.DivisoesTransacoes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(divisao =>
                divisao.UsuarioCriadorId == usuarioId ||
                divisao.Participantes.Any(participante =>
                    participante.ParticipanteUsuarioId == usuarioId));

        query = request.Status.HasValue
            ? query.Where(divisao => divisao.Status == request.Status.Value)
            : query.Where(divisao => divisao.Status != DivisaoTransacaoStatus.Cancelada);

        query = query.Where(divisao =>
            (divisao.TransacaoOrigem != null &&
                divisao.TransacaoOrigem.DataOcorrencia <= request.DataFinal &&
                (divisao.TransacaoOrigem.IsFixa ||
                    divisao.TransacaoOrigem.DataOcorrencia >= request.DataInicial ||
                    (divisao.TransacaoOrigem.CartaoCreditoId != null &&
                        divisao.TransacaoOrigem.DataOcorrencia >= request.DataInicial.AddMonths(-1)))) ||
            (divisao.CompraParcelada != null &&
                divisao.CompraParcelada.DataCompra <= request.DataFinal));

        var divisoes = await query
            .Include(divisao => divisao.UsuarioCriador)
            .Include(divisao => divisao.Participantes)
                .ThenInclude(participante => participante.ParticipanteUsuario)
            .Include(divisao => divisao.TransacaoOrigem)
                .ThenInclude(transacao => transacao!.CartaoCredito)
            .Include(divisao => divisao.CompraParcelada)
                .ThenInclude(compra => compra!.CartaoCredito)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        var idsPessoas = divisoes
            .SelectMany(divisao => divisao.Participantes)
            .Where(participante =>
                participante.ParticipanteUsuarioId.HasValue &&
                participante.ParticipanteUsuarioId != usuarioId)
            .Select(participante => participante.ParticipanteUsuarioId!.Value)
            .Concat(divisoes
                .Where(divisao => divisao.UsuarioCriadorId != usuarioId)
                .Select(divisao => divisao.UsuarioCriadorId))
            .Distinct()
            .ToList();

        var apelidos = await _dbContext.ContatosDivisao
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(contato =>
                contato.UsuarioId == usuarioId &&
                contato.Ativo &&
                idsPessoas.Contains(contato.UsuarioContatoId))
            .ToDictionaryAsync(
                contato => contato.UsuarioContatoId,
                contato => contato.Apelido,
                cancellationToken);

        var pessoas = divisoes
            .SelectMany(divisao => divisao.Participantes
                .Where(participante =>
                    participante.ParticipanteUsuarioId.HasValue &&
                    participante.ParticipanteUsuarioId != usuarioId &&
                    participante.ParticipanteUsuario != null)
                .Select(participante => new
                {
                    UsuarioId = participante.ParticipanteUsuarioId!.Value,
                    Nome = participante.ParticipanteUsuario!.Nome
                })
                .Append(divisao.UsuarioCriadorId != usuarioId
                    ? new { UsuarioId = divisao.UsuarioCriadorId, Nome = divisao.UsuarioCriador.Nome }
                    : null))
            .Where(pessoa => pessoa is not null)
            .Select(pessoa => pessoa!)
            .GroupBy(pessoa => pessoa.UsuarioId)
            .Select(grupo => new PessoaDivisaoCompartilhadaResponse
            {
                UsuarioId = grupo.Key,
                NomeExibicao = ObterNomePessoa(grupo.Key, grupo.First().Nome, apelidos)
            })
            .OrderBy(pessoa => pessoa.NomeExibicao)
            .ToList();

        if (request.ParticipanteUsuarioId.HasValue)
        {
            var pessoaId = request.ParticipanteUsuarioId.Value;
            divisoes = divisoes
                .Where(divisao =>
                    divisao.UsuarioCriadorId == pessoaId ||
                    divisao.Participantes.Any(participante =>
                        participante.ParticipanteUsuarioId == pessoaId))
                .ToList();
        }

        var itens = divisoes
            .Select(divisao => ProjetarDivisaoCompartilhada(
                divisao,
                usuarioId,
                request.DataInicial,
                request.DataFinal,
                apelidos))
            .Where(item => item is not null)
            .Select(item => item!)
            .OrderByDescending(item => item.DataReferencia)
            .ThenBy(item => item.Descricao)
            .ToList();

        var partePessoaSelecionada = request.ParticipanteUsuarioId.HasValue
            ? itens.Sum(item => item.Participantes
                .Where(participante => participante.UsuarioId == request.ParticipanteUsuarioId)
                .Sum(participante => participante.Valor))
            : (decimal?)null;
        var possuiOutrosParticipantes = request.ParticipanteUsuarioId.HasValue && itens.Any(item =>
            item.Participantes.Any(participante =>
                !participante.SouEu &&
                participante.UsuarioId != request.ParticipanteUsuarioId));
        var totalItens = itens.Count;
        var totalPaginas = totalItens == 0
            ? 0
            : (int)Math.Ceiling(totalItens / (decimal)request.TamanhoPagina);

        return new DivisoesCompartilhadasResponse
        {
            Itens = itens
                .Skip((request.Pagina - 1) * request.TamanhoPagina)
                .Take(request.TamanhoPagina)
                .ToList(),
            Pessoas = pessoas,
            Resumo = new ResumoDivisoesCompartilhadasResponse
            {
                MinhaParte = itens.Sum(item => item.MinhaParte),
                ValorTotal = itens.Sum(item => item.ValorTotal),
                PartePessoaSelecionada = partePessoaSelecionada,
                PossuiOutrosParticipantes = possuiOutrosParticipantes
            },
            Pagina = request.Pagina,
            TamanhoPagina = request.TamanhoPagina,
            TotalItens = totalItens,
            TotalPaginas = totalPaginas
        };
    }

    public async Task<ResolverConvidadoDivisaoResponse> ResolverConvidadoAsync(
        Guid usuarioId,
        ResolverConvidadoDivisaoRequest request,
        CancellationToken cancellationToken = default)
    {
        VerificarRateLimit(usuarioId, DateTimeOffset.UtcNow);
        var email = NormalizarEmail(request.Email);
        var usuarioAtual = await _dbContext.Usuarios
            .AsNoTracking()
            .SingleAsync(usuario => usuario.Id == usuarioId, cancellationToken);
        if (NormalizarEmail(usuarioAtual.Email) == email)
        {
            throw new InvalidOperationException("Não é possível convidar o próprio e-mail.");
        }

        var usuario = await _dbContext.Usuarios
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Email.ToLower() == email, cancellationToken);

        return usuario is null
            ? new ResolverConvidadoDivisaoResponse { Encontrado = false }
            : new ResolverConvidadoDivisaoResponse
            {
                Encontrado = true,
                NomeExibicao = usuario.Nome,
                EmailMascarado = ContatoDivisaoService.MascararEmail(usuario.Email),
                Identificador = usuario.Id
            };
    }

    public async Task<DivisaoTransacaoResponse> CriarConviteAsync(
        Guid usuarioId,
        CriarConviteDivisaoRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.TransacaoOrigemId.HasValue == request.CompraParceladaId.HasValue)
        {
            throw new InvalidOperationException(
                "Informe exatamente uma origem para a divisão: transação ou compra parcelada.");
        }

        var participantesUsuariosRequest = NormalizarParticipantesUsuarios(request);
        var participantesExternosRequest = (request.ParticipantesExternos ?? [])
            .Where(participante => participante.Percentual > 0 || participante.Valor > 0)
            .ToList();
        if (participantesUsuariosRequest.Count == 0 && participantesExternosRequest.Count == 0)
        {
            throw new InvalidOperationException("Informe ao menos um participante da divisão.");
        }

        var convidados = new List<(Usuario Usuario, CriarParticipanteUsuarioDivisaoRequest Request)>();
        foreach (var participanteRequest in participantesUsuariosRequest)
        {
            var convidado = await ResolverUsuarioConvidadoAsync(
                usuarioId,
                participanteRequest,
                cancellationToken);
            convidados.Add((convidado, participanteRequest));
        }

        var transacao = request.TransacaoOrigemId.HasValue
            ? await _dbContext.Transacoes
                .Include(item => item.CartaoCredito)
                .SingleOrDefaultAsync(
                item => item.Id == request.TransacaoOrigemId.Value && item.UsuarioId == usuarioId,
                cancellationToken)
            : null;
        var compraParcelada = request.CompraParceladaId.HasValue
            ? await _dbContext.ComprasParceladas
                .Include(compra => compra.Categoria)
                .Include(compra => compra.CartaoCredito)
                .SingleOrDefaultAsync(
                    compra => compra.Id == request.CompraParceladaId.Value && compra.UsuarioId == usuarioId,
                    cancellationToken)
            : null;
        if (transacao is null && compraParcelada is null)
        {
            throw new InvalidOperationException(request.TransacaoOrigemId.HasValue
                ? "Transação de origem não encontrada."
                : "Compra parcelada de origem não encontrada.");
        }

        var jaPossuiDivisaoVinculada = await _dbContext.DivisoesTransacoes
            .AsNoTracking()
            .AnyAsync(
                divisao =>
                    divisao.UsuarioCriadorId == usuarioId &&
                    ((transacao != null && divisao.TransacaoOrigemId == transacao.Id) ||
                        (compraParcelada != null && divisao.CompraParceladaId == compraParcelada.Id)) &&
                    divisao.EncerradoEm == null,
                cancellationToken);
        if (jaPossuiDivisaoVinculada)
        {
            throw new InvalidOperationException(transacao is not null
                ? "Esta transação já possui uma divisão vinculada."
                : "Esta compra parcelada já possui uma divisão vinculada.");
        }

        await using var dbTransaction = _dbContext.Database.CurrentTransaction is null
            ? await _dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;
        var agora = DateTimeOffset.UtcNow;
        var valorTotal = transacao is not null
            ? transacao.ValorTotalOriginal ?? transacao.Valor
            : compraParcelada!.ValorTotalOriginal ?? compraParcelada.ValorTotal;
        var participacoes = convidados
            .Select(item => ((decimal?)item.Request.Percentual, (decimal?)null))
            .Concat(participantesExternosRequest.Select(item =>
                item.ModoDefinicao == ModoDefinicaoParticipacaoDivisao.Valor
                    ? ((decimal?)null, item.Valor)
                    : (item.Percentual, (decimal?)null)))
            .ToList();
        var distribuicao = DivisaoTransacaoRules.CalcularDistribuicao(valorTotal, participacoes);
        var percentualCriador = distribuicao.PercentualCriador;

        if (transacao is not null)
        {
            transacao.IsDividida = true;
            transacao.ValorTotalOriginal = valorTotal;
            transacao.PercentualDivisao = percentualCriador;
            transacao.Valor = distribuicao.ValorCriador;
        }
        else
        {
            compraParcelada!.IsDividida = true;
            compraParcelada.ValorTotalOriginal = valorTotal;
            compraParcelada.PercentualDivisao = percentualCriador;
            compraParcelada.ValorTotal = distribuicao.ValorCriador;
        }

        var divisao = new DivisaoTransacao
        {
            UsuarioId = usuarioId,
            UsuarioCriadorId = usuarioId,
            TransacaoOrigemId = transacao?.Id,
            CompraParceladaId = compraParcelada?.Id,
            CompraParcelada = compraParcelada,
            ValorTotal = valorTotal,
            Status = convidados.Count > 0 ? DivisaoTransacaoStatus.Pendente : DivisaoTransacaoStatus.Aceita,
            VersaoAtual = 1,
            CriadoEm = agora,
            AtualizadoEm = agora
        };

        divisao.Participantes.Add(new DivisaoTransacaoParticipante
        {
            UsuarioId = usuarioId,
            ParticipanteUsuarioId = usuarioId,
            TipoParticipante = TipoParticipanteDivisao.Criador,
            Percentual = percentualCriador,
            Valor = distribuicao.ValorCriador,
            Status = DivisaoTransacaoParticipanteStatus.Aceito,
            RespondidoEm = agora,
            VersaoAceita = 1,
            VersaoConvite = 1,
            Ativo = true
        });

        var indiceValor = 1;
        foreach (var (convidado, participanteRequest) in convidados)
        {
            divisao.Participantes.Add(new DivisaoTransacaoParticipante
            {
                UsuarioId = convidado.Id,
                ParticipanteUsuarioId = convidado.Id,
                TipoParticipante = TipoParticipanteDivisao.UsuarioSistema,
                Percentual = participanteRequest.Percentual,
                Valor = distribuicao.Valores[indiceValor - 1],
                Status = DivisaoTransacaoParticipanteStatus.Pendente,
                ExpiraEm = DivisaoTransacaoRules.CalcularExpiracaoConvite(
                    ObterDataPadraoConvidado(transacao, compraParcelada),
                    agora),
                VersaoConvite = 1,
                Ativo = true
            });
            indiceValor++;
        }

        foreach (var participanteRequest in participantesExternosRequest)
        {
            divisao.Participantes.Add(new DivisaoTransacaoParticipante
            {
                UsuarioId = usuarioId,
                TipoParticipante = TipoParticipanteDivisao.Externo,
                Percentual = distribuicao.Percentuais[indiceValor - 1],
                Valor = distribuicao.Valores[indiceValor - 1],
                ModoDefinicao = participanteRequest.ModoDefinicao,
                Status = DivisaoTransacaoParticipanteStatus.Aceito,
                RespondidoEm = agora,
                VersaoAceita = 1,
                VersaoConvite = 1,
                MotivoResposta = NormalizarTexto(participanteRequest.Nome),
                Ativo = true
            });
            indiceValor++;
        }

        DivisaoTransacaoRules.ValidarParticipantes(valorTotal, divisao.Participantes.ToList());

        _dbContext.DivisoesTransacoes.Add(divisao);
        foreach (var participante in divisao.Participantes.Where(item => item.TipoParticipante == TipoParticipanteDivisao.UsuarioSistema))
        {
            var participanteRequest = convidados.Single(item => item.Usuario.Id == participante.ParticipanteUsuarioId).Request;
            await SalvarContatoSeSolicitadoAsync(
                usuarioId,
                participante.ParticipanteUsuarioId!.Value,
                participanteRequest.SalvarContato,
                participanteRequest.ApelidoContato,
                agora,
                cancellationToken);
            CriarNotificacao(
                participante.ParticipanteUsuarioId.Value,
                TipoNotificacao.DivisaoRecebida,
                "Convite de divisão recebido",
                compraParcelada is null
                    ? $"{transacao!.Descricao}: {participante.Valor:C} aguardando sua resposta."
                    : $"{compraParcelada.Descricao}: sua parte é {participante.Valor:C} em {compraParcelada.QuantidadeParcelas} parcelas.",
                divisao,
                "ResponderDivisao",
                divisao.VersaoAtual,
                participante.Id);
        }

        foreach (var participante in divisao.Participantes.Where(item => item.TipoParticipante == TipoParticipanteDivisao.Externo))
        {
            await CriarOuAtualizarPendenciaReembolsoAsync(divisao, participante, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        if (dbTransaction is not null)
        {
            await dbTransaction.CommitAsync(cancellationToken);
        }
        return Mapear(divisao);
    }

    public async Task<DivisaoTransacaoResponse?> AceitarAsync(
        Guid usuarioId,
        Guid participanteId,
        ClassificarAceiteDivisaoRequest? request = null,
        CancellationToken cancellationToken = default)
    {
        var participante = await ObterParticipanteComDivisaoAsync(participanteId, cancellationToken);
        if (participante is null)
        {
            return null;
        }

        if (participante.UsuarioId != usuarioId || participante.ParticipanteUsuarioId != usuarioId)
        {
            throw new InvalidOperationException("Convite não pertence ao usuário autenticado.");
        }

        if (participante.Status == DivisaoTransacaoParticipanteStatus.Aceito)
        {
            return Mapear(participante.DivisaoTransacao, usuarioId);
        }

        if (participante.Status != DivisaoTransacaoParticipanteStatus.Pendente ||
            participante.VersaoConvite != participante.DivisaoTransacao.VersaoAtual)
        {
            throw new InvalidOperationException("Convite não está pendente na versão atual.");
        }

        await ValidarClassificacaoAsync(usuarioId, request, cancellationToken);
        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var versaoAtual = participante.DivisaoTransacao.VersaoAtual;
        var conviteReservado = await _dbContext.DivisoesTransacoesParticipantes
            .IgnoreQueryFilters()
            .Where(item =>
                item.Id == participante.Id &&
                item.Status == DivisaoTransacaoParticipanteStatus.Pendente &&
                item.VersaoConvite == versaoAtual)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(
                    item => item.Status,
                    DivisaoTransacaoParticipanteStatus.Aceito),
                cancellationToken);
        if (conviteReservado == 0)
        {
            await dbTransaction.RollbackAsync(cancellationToken);
            _dbContext.ChangeTracker.Clear();
            var atualizado = await ObterParticipanteComDivisaoAsync(participanteId, cancellationToken);
            if (atualizado?.Status == DivisaoTransacaoParticipanteStatus.Aceito)
            {
                return Mapear(atualizado.DivisaoTransacao, usuarioId);
            }

            throw new InvalidOperationException("Convite não está pendente na versão atual.");
        }

        var transacaoOrigem = await ObterTransacaoOrigemAsync(participante.DivisaoTransacao, cancellationToken);
        var compraOrigem = await ObterCompraParceladaOrigemAsync(
            participante.DivisaoTransacao,
            cancellationToken);

        if (compraOrigem is not null)
        {
            var categoriaId = await ObterCategoriaDaObrigacaoParceladaAsync(
                usuarioId,
                request?.CategoriaId,
                compraOrigem,
                cancellationToken);
            var primeiraParcela = ObterPrimeiraCompetencia(compraOrigem) ?? compraOrigem.DataCompra;
            var compraGerada = new CompraParcelada
            {
                UsuarioId = usuarioId,
                CartaoCreditoId = null,
                CategoriaId = categoriaId,
                Descricao = $"Parte compartilhada - {compraOrigem.Descricao}",
                QuantidadeParcelas = compraOrigem.QuantidadeParcelas,
                ValorTotal = participante.Valor,
                DataCompra = compraOrigem.DataCompra,
                DataPrimeiroVencimento = primeiraParcela,
                FormaPagamento = FormaPagamentoCompraParcelada.Carne,
                IsDividida = false
            };

            _dbContext.ComprasParceladas.Add(compraGerada);
            participante.CompraParceladaGerada = compraGerada;
        }
        else
        {
            var codigo = await ObterProximoCodigoExibicaoAsync(usuarioId, cancellationToken);
            var transacaoGerada = new Transacao
            {
                UsuarioId = usuarioId,
                CodigoExibicao = codigo,
                Tipo = TipoTransacao.Despesa,
                Descricao = $"Parte compartilhada - {transacaoOrigem?.Descricao ?? "divisão"}",
                Valor = participante.Valor,
                DataOcorrencia = ObterDataPadraoConvidado(transacaoOrigem, null),
                CategoriaId = request?.CategoriaId,
                ContaBancariaId = request?.ContaBancariaId,
                CartaoCreditoId = request?.CartaoCreditoId,
                FormaPagamento = request?.CartaoCreditoId.HasValue == true ? "Cartão de crédito" : "Divisão compartilhada",
                IsFixa = false,
                IsPaga = false,
                OrigemTransacao = OrigemTransacao.Lancamento
            };

            _dbContext.Transacoes.Add(transacaoGerada);
            participante.TransacaoGerada = transacaoGerada;
        }

        participante.Status = DivisaoTransacaoParticipanteStatus.Aceito;
        participante.RespondidoEm = DateTimeOffset.UtcNow;
        participante.VersaoAceita = participante.DivisaoTransacao.VersaoAtual;
        participante.DivisaoTransacao.Status = ObterStatusGlobal(participante.DivisaoTransacao);
        participante.DivisaoTransacao.AtualizadoEm = DateTimeOffset.UtcNow;
        await CriarOuAtualizarPendenciaReembolsoAsync(
            participante.DivisaoTransacao,
            participante,
            cancellationToken);
        ResolverNotificacoesPendentes(
            usuarioId,
            participante.DivisaoTransacao.Id,
            TipoNotificacao.DivisaoRecebida,
            participante.Id);
        CriarNotificacao(
            participante.DivisaoTransacao.UsuarioCriadorId,
            TipoNotificacao.DivisaoAceita,
            "Divisão aceita",
            "Um convite de divisão foi aceito.",
            participante.DivisaoTransacao,
            null,
            participante.DivisaoTransacao.VersaoAtual,
            participante.Id);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
        return Mapear(participante.DivisaoTransacao, usuarioId);
    }

    public async Task<DivisaoTransacaoResponse?> RecusarAsync(
        Guid usuarioId,
        Guid participanteId,
        RecusarDivisaoRequest request,
        CancellationToken cancellationToken = default)
    {
        var participante = await ObterParticipanteComDivisaoAsync(participanteId, cancellationToken);
        if (participante is null)
        {
            return null;
        }

        if (participante.UsuarioId != usuarioId || participante.ParticipanteUsuarioId != usuarioId)
        {
            throw new InvalidOperationException("Convite não pertence ao usuário autenticado.");
        }

        if (participante.Status != DivisaoTransacaoParticipanteStatus.Pendente)
        {
            throw new InvalidOperationException("Somente convites pendentes podem ser recusados.");
        }

        participante.Status = DivisaoTransacaoParticipanteStatus.Recusado;
        participante.RespondidoEm = DateTimeOffset.UtcNow;
        participante.MotivoResposta = NormalizarTexto(request.Motivo);
        participante.DivisaoTransacao.Status = ObterStatusGlobal(participante.DivisaoTransacao);
        participante.DivisaoTransacao.AtualizadoEm = DateTimeOffset.UtcNow;
        ResolverNotificacoesPendentes(usuarioId, participante.DivisaoTransacao.Id, TipoNotificacao.DivisaoRecebida);

        var convidado = await _dbContext.Usuarios
            .AsNoTracking()
            .SingleAsync(usuario => usuario.Id == usuarioId, cancellationToken);
        var origem = await ObterTransacaoOrigemAsync(participante.DivisaoTransacao, cancellationToken);
        CriarNotificacao(
            participante.DivisaoTransacao.UsuarioCriadorId,
            TipoNotificacao.DivisaoRecusada,
            "Divisão recusada",
            $"{convidado.Nome} recusou {origem?.Descricao ?? "a divisão"}: total {participante.DivisaoTransacao.ValorTotal:C}, recusado {participante.Valor:C} ({participante.Percentual}%).",
            participante.DivisaoTransacao,
            "DecidirRecusaDivisao",
            participante.DivisaoTransacao.VersaoAtual,
            participante.Id);

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(participante.DivisaoTransacao, usuarioId);
    }

    public async Task<DivisaoTransacaoResponse?> AssumirValorAsync(
        Guid usuarioId,
        Guid divisaoId,
        CancellationToken cancellationToken = default)
    {
        var divisao = await ObterDivisaoDoCriadorAsync(usuarioId, divisaoId, cancellationToken);
        if (divisao is null)
        {
            return null;
        }

        if (divisao.Status is not (DivisaoTransacaoStatus.RecusadaAguardandoDecisao or DivisaoTransacaoStatus.Expirada))
        {
            throw new InvalidOperationException("A divisão não possui decisão pendente.");
        }

        var elegiveis = divisao.Participantes
            .Where(participante =>
                participante.Ativo &&
                participante.Status is DivisaoTransacaoParticipanteStatus.Recusado or DivisaoTransacaoParticipanteStatus.Expirado)
            .ToList();
        if (elegiveis.Count != 1)
        {
            throw new InvalidOperationException(
                elegiveis.Count == 0
                    ? "Não há valor recusado ou expirado para assumir."
                    : "Informe o participante cujo valor será assumido.");
        }

        return await AssumirValorInternoAsync(usuarioId, divisao, elegiveis[0], cancellationToken);
    }

    public async Task<DivisaoTransacaoResponse?> AssumirValorParticipanteAsync(
        Guid usuarioId,
        Guid participanteId,
        CancellationToken cancellationToken = default)
    {
        var participante = await ObterParticipanteComDivisaoAsync(participanteId, cancellationToken);
        if (participante is null)
        {
            return null;
        }

        if (participante.DivisaoTransacao.UsuarioCriadorId != usuarioId)
        {
            throw new InvalidOperationException("Somente o criador pode assumir esta participação.");
        }

        return await AssumirValorInternoAsync(usuarioId, participante.DivisaoTransacao, participante, cancellationToken);
    }

    private async Task<DivisaoTransacaoResponse> AssumirValorInternoAsync(
        Guid usuarioId,
        DivisaoTransacao divisao,
        DivisaoTransacaoParticipante participanteAlvo,
        CancellationToken cancellationToken)
    {
        if (!participanteAlvo.Ativo ||
            participanteAlvo.Status is not (DivisaoTransacaoParticipanteStatus.Recusado or
                DivisaoTransacaoParticipanteStatus.Expirado))
        {
            throw new InvalidOperationException("A participação não possui valor recusado ou expirado para assumir.");
        }

        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var criador = ObterParticipanteCriador(divisao);
        criador.Valor += participanteAlvo.Valor;
        criador.Percentual += participanteAlvo.Percentual;
        participanteAlvo.Ativo = false;

        var transacaoOrigem = await ObterTransacaoOrigemAsync(divisao, cancellationToken);
        if (transacaoOrigem is not null)
        {
            transacaoOrigem.Valor = criador.Valor;
            transacaoOrigem.PercentualDivisao = criador.Percentual;
            transacaoOrigem.ValorTotalOriginal = divisao.ValorTotal;
        }

        var compraOrigem = await ObterCompraParceladaOrigemAsync(divisao, cancellationToken);
        if (compraOrigem is not null)
        {
            compraOrigem.ValorTotal = criador.Valor;
            compraOrigem.PercentualDivisao = criador.Percentual;
            compraOrigem.ValorTotalOriginal = divisao.ValorTotal;
        }

        divisao.Status = ObterStatusGlobal(divisao);
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;
        await DispensarReembolsoParticipanteAsync(divisao.Id, participanteAlvo.Id, usuarioId, cancellationToken);
        ResolverNotificacoesPendentes(
            usuarioId,
            divisao.Id,
            participanteAlvo.Status == DivisaoTransacaoParticipanteStatus.Expirado
                ? TipoNotificacao.DivisaoExpirada
                : TipoNotificacao.DivisaoRecusada,
            participanteAlvo.Id);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
        return Mapear(divisao);
    }

    public async Task<DivisaoTransacaoResponse?> ManterParteCriadorAsync(
        Guid usuarioId,
        Guid participanteId,
        CancellationToken cancellationToken = default)
    {
        var participante = await ObterParticipanteComDivisaoAsync(participanteId, cancellationToken);
        if (participante is null)
        {
            return null;
        }

        var divisao = participante.DivisaoTransacao;
        if (divisao.UsuarioCriadorId != usuarioId)
        {
            throw new InvalidOperationException("Somente o criador pode manter sua parte nesta divisão.");
        }

        if (!participante.Ativo ||
            participante.TipoParticipante != TipoParticipanteDivisao.UsuarioSistema ||
            participante.Status is not (DivisaoTransacaoParticipanteStatus.Recusado or
                DivisaoTransacaoParticipanteStatus.Expirado))
        {
            throw new InvalidOperationException("A participação não possui decisão pendente.");
        }

        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        participante.Ativo = false;
        divisao.Status = ObterStatusGlobal(divisao);
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;

        await DispensarReembolsoParticipanteAsync(divisao.Id, participante.Id, usuarioId, cancellationToken);
        ResolverNotificacoesPendentes(
            usuarioId,
            divisao.Id,
            participante.Status == DivisaoTransacaoParticipanteStatus.Expirado
                ? TipoNotificacao.DivisaoExpirada
                : TipoNotificacao.DivisaoRecusada,
            participante.Id);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
        return Mapear(divisao);
    }

    public async Task<DivisaoTransacaoResponse?> ReenviarAsync(
        Guid usuarioId,
        Guid divisaoId,
        ReenviarDivisaoRequest request,
        CancellationToken cancellationToken = default)
    {
        var divisao = await ObterDivisaoDoCriadorAsync(usuarioId, divisaoId, cancellationToken);
        if (divisao is null)
        {
            return null;
        }

        if (divisao.Status is not (DivisaoTransacaoStatus.RecusadaAguardandoDecisao or DivisaoTransacaoStatus.Expirada))
        {
            throw new InvalidOperationException("A divisão não pode ser reenviada no status atual.");
        }

        var elegiveis = divisao.Participantes
            .Where(participante =>
                participante.TipoParticipante == TipoParticipanteDivisao.UsuarioSistema &&
                participante.Status is DivisaoTransacaoParticipanteStatus.Recusado or DivisaoTransacaoParticipanteStatus.Expirado)
            .OrderByDescending(participante => participante.VersaoConvite)
            .ToList();
        var anterior = request.ParticipanteId.HasValue
            ? elegiveis.SingleOrDefault(item => item.Id == request.ParticipanteId.Value)
            : elegiveis.Count == 1 ? elegiveis[0] : null;
        if (anterior?.ParticipanteUsuarioId is null)
        {
            throw new InvalidOperationException(
                elegiveis.Count > 1 && !request.ParticipanteId.HasValue
                    ? "Informe o participante cujo convite será reenviado."
                    : "Não há convidado elegível para reenviar.");
        }

        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var outrosParticipantes = divisao.Participantes
            .Where(participante =>
                participante.Ativo &&
                participante.TipoParticipante != TipoParticipanteDivisao.Criador &&
                participante.Id != anterior.Id)
            .OrderBy(participante => participante.Id)
            .ToList();
        var percentualConvidado = request.PercentualConvidado ?? anterior.Percentual;
        var participacoes = outrosParticipantes
            .Select(item => item.ModoDefinicao == ModoDefinicaoParticipacaoDivisao.Valor
                ? ((decimal?)null, (decimal?)item.Valor)
                : ((decimal?)item.Percentual, (decimal?)null))
            .Append(((decimal?)percentualConvidado, (decimal?)null))
            .ToList();
        var distribuicao = DivisaoTransacaoRules.CalcularDistribuicao(divisao.ValorTotal, participacoes);
        var criador = ObterParticipanteCriador(divisao);
        criador.Percentual = distribuicao.PercentualCriador;
        criador.Valor = distribuicao.ValorCriador;
        var transacaoOrigem = await ObterTransacaoOrigemAsync(divisao, cancellationToken);
        if (transacaoOrigem is not null)
        {
            transacaoOrigem.Valor = distribuicao.ValorCriador;
            transacaoOrigem.PercentualDivisao = distribuicao.PercentualCriador;
        }
        var compraOrigem = await ObterCompraParceladaOrigemAsync(divisao, cancellationToken);
        if (compraOrigem is not null)
        {
            compraOrigem.ValorTotal = distribuicao.ValorCriador;
            compraOrigem.PercentualDivisao = distribuicao.PercentualCriador;
        }
        for (var indice = 0; indice < outrosParticipantes.Count; indice++)
        {
            outrosParticipantes[indice].Percentual = distribuicao.Percentuais[indice];
            outrosParticipantes[indice].Valor = distribuicao.Valores[indice];
        }

        anterior.Ativo = false;

        divisao.VersaoAtual++;
        divisao.QuantidadeReenvios++;
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;
        var novoParticipante = new DivisaoTransacaoParticipante
        {
            UsuarioId = anterior.ParticipanteUsuarioId.Value,
            ParticipanteUsuarioId = anterior.ParticipanteUsuarioId.Value,
            TipoParticipante = TipoParticipanteDivisao.UsuarioSistema,
            Percentual = percentualConvidado,
            Valor = distribuicao.Valores[^1],
            Status = DivisaoTransacaoParticipanteStatus.Pendente,
            ExpiraEm = DivisaoTransacaoRules.CalcularExpiracaoConvite(
                ObterDataPadraoConvidado(transacaoOrigem, compraOrigem),
                DateTimeOffset.UtcNow),
            VersaoConvite = divisao.VersaoAtual,
            Ativo = true
        };
        divisao.Participantes.Add(novoParticipante);
        divisao.Status = ObterStatusGlobal(divisao);

        CriarNotificacao(
            anterior.ParticipanteUsuarioId.Value,
            TipoNotificacao.DivisaoRecebida,
            "Convite de divisão reenviado",
            $"Uma divisão foi reenviada para sua resposta: {novoParticipante.Valor:C}.",
            divisao,
            "ResponderDivisao",
            divisao.VersaoAtual,
            novoParticipante.Id);
        ResolverNotificacoesPendentes(
            usuarioId,
            divisao.Id,
            anterior.Status == DivisaoTransacaoParticipanteStatus.Expirado
                ? TipoNotificacao.DivisaoExpirada
                : TipoNotificacao.DivisaoRecusada,
            anterior.Id);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
        return Mapear(divisao);
    }

    public async Task<bool> ExcluirAsync(
        Guid usuarioId,
        Guid divisaoId,
        ExcluirDivisaoRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(request.Escopo, "EstaOcorrencia", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Nesta etapa, informe explicitamente o escopo EstaOcorrencia.");
        }

        var divisao = await ObterDivisaoDoCriadorAsync(usuarioId, divisaoId, cancellationToken);
        if (divisao is null)
        {
            return false;
        }

        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var statusAnterior = divisao.Status;
        var possuiParticipanteAceito = divisao.Participantes.Any(participante =>
            participante.Ativo &&
            participante.TipoParticipante == TipoParticipanteDivisao.UsuarioSistema &&
            participante.Status == DivisaoTransacaoParticipanteStatus.Aceito);
        divisao.Status = DivisaoTransacaoStatus.Cancelada;
        divisao.EncerradoEm = DateTimeOffset.UtcNow;
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;
        foreach (var participante in divisao.Participantes.Where(participante => participante.Ativo))
        {
            participante.Status = DivisaoTransacaoParticipanteStatus.Cancelado;
            participante.Ativo = false;
        }

        var transacaoOrigem = await ObterTransacaoOrigemAsync(divisao, cancellationToken);
        if (!possuiParticipanteAceito &&
            statusAnterior != DivisaoTransacaoStatus.Aceita &&
            transacaoOrigem is not null)
        {
            transacaoOrigem.IsDividida = false;
            transacaoOrigem.Valor = divisao.ValorTotal;
            transacaoOrigem.ValorTotalOriginal = null;
            transacaoOrigem.PercentualDivisao = null;
        }

        var compraOrigem = await ObterCompraParceladaOrigemAsync(divisao, cancellationToken);
        if (!possuiParticipanteAceito &&
            statusAnterior != DivisaoTransacaoStatus.Aceita &&
            compraOrigem is not null)
        {
            compraOrigem.IsDividida = false;
            compraOrigem.ValorTotal = divisao.ValorTotal;
            compraOrigem.ValorTotalOriginal = null;
            compraOrigem.PercentualDivisao = null;
        }

        foreach (var participanteUsuarioId in divisao.Participantes
            .Select(item => item.ParticipanteUsuarioId)
            .Where(participanteUsuarioId => participanteUsuarioId.HasValue && participanteUsuarioId.Value != usuarioId)
            .Select(participanteUsuarioId => participanteUsuarioId!.Value))
        {
            CriarNotificacao(
                participanteUsuarioId,
                TipoNotificacao.DivisaoCancelada,
                "Divisão cancelada",
                "Uma divisão aceita foi cancelada pelo criador para ocorrências futuras.",
                divisao,
                null,
                divisao.VersaoAtual);
        }

        await DispensarReembolsosPendentesAsync(divisao.Id, usuarioId, cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<bool> CancelarParticipacaoAsync(
        Guid usuarioId,
        Guid participanteId,
        CancellationToken cancellationToken = default)
    {
        var participante = await ObterParticipanteComDivisaoAsync(participanteId, cancellationToken);
        if (participante is null)
        {
            return false;
        }

        if (participante.ParticipanteUsuarioId != usuarioId || participante.UsuarioId != usuarioId)
        {
            throw new InvalidOperationException("A participação não pertence ao usuário autenticado.");
        }

        if (!participante.Ativo || participante.Status != DivisaoTransacaoParticipanteStatus.Aceito)
        {
            throw new InvalidOperationException("Somente uma participação aceita e ativa pode ser cancelada.");
        }

        var reembolso = await _dbContext.ReembolsosDivisao
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(item =>
                item.DivisaoTransacaoId == participante.DivisaoTransacaoId &&
                item.ParticipanteId == participante.Id,
                cancellationToken);
        if (reembolso?.ValorRecebido > 0)
        {
            throw new InvalidOperationException(
                "Uma participação com reembolso recebido deve permanecer no histórico financeiro.");
        }

        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        if (participante.TransacaoGeradaId.HasValue)
        {
            var transacao = await _dbContext.Transacoes
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.Id == participante.TransacaoGeradaId.Value, cancellationToken);
            if (transacao?.IsPaga == true)
            {
                throw new InvalidOperationException(
                    "Uma obrigação compartilhada já realizada não pode ser excluída; preserve o histórico.");
            }

            participante.TransacaoGeradaId = null;
            participante.TransacaoGerada = null;
            if (transacao is not null)
            {
                _dbContext.Transacoes.Remove(transacao);
            }
        }

        if (participante.CompraParceladaGeradaId.HasValue)
        {
            var compraId = participante.CompraParceladaGeradaId.Value;
            var possuiParcelaRealizada = await _dbContext.Transacoes
                .IgnoreQueryFilters()
                .AnyAsync(item => item.CompraParceladaId == compraId && item.IsPaga, cancellationToken);
            if (possuiParcelaRealizada)
            {
                throw new InvalidOperationException(
                    "Uma série compartilhada com parcela realizada não pode ser excluída; preserve o histórico.");
            }

            var compra = await _dbContext.ComprasParceladas
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.Id == compraId, cancellationToken);
            participante.CompraParceladaGeradaId = null;
            participante.CompraParceladaGerada = null;
            if (compra is not null)
            {
                _dbContext.ComprasParceladas.Remove(compra);
            }
        }

        participante.Status = DivisaoTransacaoParticipanteStatus.Recusado;
        participante.RespondidoEm = DateTimeOffset.UtcNow;
        participante.MotivoResposta = "Participante solicitou remover sua obrigação.";
        participante.DivisaoTransacao.Status = ObterStatusGlobal(participante.DivisaoTransacao);
        participante.DivisaoTransacao.AtualizadoEm = DateTimeOffset.UtcNow;
        if (reembolso is not null)
        {
            reembolso.Status = ReembolsoDivisaoStatus.Dispensado;
            reembolso.AtualizadoEm = DateTimeOffset.UtcNow;
        }

        var usuario = await _dbContext.Usuarios
            .AsNoTracking()
            .SingleAsync(item => item.Id == usuarioId, cancellationToken);
        CriarNotificacao(
            participante.DivisaoTransacao.UsuarioCriadorId,
            TipoNotificacao.DivisaoRecusada,
            "Participação removida",
            $"{usuario.Nome} solicitou remover sua parte de {participante.Valor:C} ({participante.Percentual}%).",
            participante.DivisaoTransacao,
            "DecidirRecusaDivisao",
            participante.DivisaoTransacao.VersaoAtual,
            participante.Id);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<DivisaoTransacaoResponse?> ProporAlteracaoAsync(
        Guid usuarioId,
        Guid divisaoId,
        ProporAlteracaoDivisaoRequest request,
        CancellationToken cancellationToken = default)
    {
        var divisao = await ObterDivisaoDoCriadorAsync(usuarioId, divisaoId, cancellationToken);
        if (divisao is null)
        {
            return null;
        }

        if (divisao.Status != DivisaoTransacaoStatus.Aceita)
        {
            throw new InvalidOperationException("Somente divisões aceitas podem receber proposta de alteração.");
        }

        if (divisao.Versoes.Any(versao => versao.Status == DivisaoTransacaoVersaoStatus.PropostaPendente))
        {
            throw new InvalidOperationException("Já existe uma alteração pendente para esta divisão.");
        }

        var transacaoOrigem = await ObterTransacaoOrigemAsync(divisao, cancellationToken);
        var compraOrigem = await ObterCompraParceladaOrigemAsync(divisao, cancellationToken);
        var criador = ObterParticipanteCriador(divisao);
        var participantesAtivos = divisao.Participantes
            .Where(item => item.Ativo && item.TipoParticipante != TipoParticipanteDivisao.Criador)
            .OrderBy(item => item.Id)
            .ToList();
        var usuariosAtivos = participantesAtivos
            .Where(item => item.TipoParticipante == TipoParticipanteDivisao.UsuarioSistema)
            .ToList();
        if (usuariosAtivos.Count == 0)
        {
            throw new InvalidOperationException("A divisão não possui participante do sistema para aprovar a alteração.");
        }

        var percentuaisInformados = request.Participantes.ToDictionary(
            item => item.ParticipanteId,
            item => item.Percentual);
        if (request.PercentualConvidado.HasValue)
        {
            if (usuariosAtivos.Count != 1 || percentuaisInformados.Count > 0)
            {
                throw new InvalidOperationException(
                    "Use a coleção Participantes para alterar uma divisão com vários convidados.");
            }

            percentuaisInformados[usuariosAtivos[0].Id] = request.PercentualConvidado.Value;
        }

        if (percentuaisInformados.Keys.Any(id => participantesAtivos.All(item => item.Id != id)))
        {
            throw new InvalidOperationException("A proposta contém participante inexistente ou inativo.");
        }

        var valorTotalProposto = request.ValorTotal ?? divisao.ValorTotal;
        var participacoesPropostas = participantesAtivos.Select(item =>
        {
            var percentual = percentuaisInformados.GetValueOrDefault(item.Id, item.Percentual);
            return item.ModoDefinicao == ModoDefinicaoParticipacaoDivisao.Valor &&
                !percentuaisInformados.ContainsKey(item.Id)
                    ? ((decimal?)null, (decimal?)item.Valor)
                    : ((decimal?)percentual, (decimal?)null);
        }).ToList();
        var distribuicao = DivisaoTransacaoRules.CalcularDistribuicao(
            valorTotalProposto,
            participacoesPropostas);
        var mudancaGlobal = valorTotalProposto != divisao.ValorTotal ||
            request.Vencimento.HasValue || request.QuantidadeParcelas.HasValue ||
            request.Recorrencia is not null || request.Frequencia is not null ||
            request.ResponsabilidadeParticipante is not null;
        var afetados = usuariosAtivos.Where(item =>
        {
            var indice = participantesAtivos.IndexOf(item);
            return mudancaGlobal ||
                item.Percentual != distribuicao.Percentuais[indice] ||
                item.Valor != distribuicao.Valores[indice];
        }).ToList();
        if (afetados.Count == 0)
        {
            throw new InvalidOperationException("A proposta não altera a divisão vigente.");
        }

        var participanteCompatibilidade = afetados[0];
        var indiceCompatibilidade = participantesAtivos.IndexOf(participanteCompatibilidade);
        var versao = new DivisaoTransacaoVersao
        {
            UsuarioId = divisao.UsuarioId,
            DivisaoTransacaoId = divisao.Id,
            Versao = Math.Max(
                divisao.VersaoAtual,
                divisao.Versoes.Count == 0 ? divisao.VersaoAtual : divisao.Versoes.Max(item => item.Versao)) + 1,
            Status = DivisaoTransacaoVersaoStatus.PropostaPendente,
            Escopo = NormalizarEscopo(request.Escopo),
            UsuarioSolicitanteId = usuarioId,
            ValorTotalAnterior = divisao.ValorTotal,
            ValorTotalProposto = valorTotalProposto,
            PercentualCriadorAnterior = criador.Percentual,
            PercentualCriadorProposto = distribuicao.PercentualCriador,
            ValorCriadorAnterior = criador.Valor,
            ValorCriadorProposto = distribuicao.ValorCriador,
            PercentualParticipanteAnterior = participanteCompatibilidade.Percentual,
            PercentualParticipanteProposto = distribuicao.Percentuais[indiceCompatibilidade],
            ValorParticipanteAnterior = participanteCompatibilidade.Valor,
            ValorParticipanteProposto = distribuicao.Valores[indiceCompatibilidade],
            VencimentoAnterior = transacaoOrigem?.DataOcorrencia ?? ObterPrimeiraCompetencia(compraOrigem),
            VencimentoProposto = request.Vencimento ?? transacaoOrigem?.DataOcorrencia ??
                ObterPrimeiraCompetencia(compraOrigem),
            QuantidadeParcelasAnterior = compraOrigem?.QuantidadeParcelas,
            QuantidadeParcelasProposta = request.QuantidadeParcelas ?? compraOrigem?.QuantidadeParcelas,
            RecorrenciaAnterior = transacaoOrigem?.IsFixa == true ? "Fixa" : null,
            RecorrenciaProposta = NormalizarTexto(request.Recorrencia) ?? (transacaoOrigem?.IsFixa == true ? "Fixa" : null),
            FrequenciaAnterior = null,
            FrequenciaProposta = NormalizarTexto(request.Frequencia),
            ResponsabilidadeAnterior = "Participante",
            ResponsabilidadeProposta = NormalizarTexto(request.ResponsabilidadeParticipante) ?? "Participante",
            CriadoEm = DateTimeOffset.UtcNow
        };

        for (var indice = 0; indice < participantesAtivos.Count; indice++)
        {
            var participante = participantesAtivos[indice];
            var requerResposta = afetados.Contains(participante);
            versao.Participantes.Add(new DivisaoTransacaoVersaoParticipante
            {
                UsuarioId = participante.UsuarioId,
                DivisaoTransacaoParticipanteId = participante.Id,
                DivisaoTransacaoParticipante = participante,
                PercentualAnterior = participante.Percentual,
                PercentualProposto = distribuicao.Percentuais[indice],
                ValorAnterior = participante.Valor,
                ValorProposto = distribuicao.Valores[indice],
                Status = requerResposta
                    ? DivisaoTransacaoVersaoParticipanteStatus.Pendente
                    : DivisaoTransacaoVersaoParticipanteStatus.Aceita,
                RespondidoEm = requerResposta ? null : DateTimeOffset.UtcNow
            });
        }

        divisao.Versoes.Add(versao);
        divisao.Status = DivisaoTransacaoStatus.AlteracaoPendente;
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;
        foreach (var participante in afetados)
        {
            var itemVersao = versao.Participantes.Single(item =>
                item.DivisaoTransacaoParticipanteId == participante.Id);
            CriarNotificacao(
                participante.ParticipanteUsuarioId!.Value,
                TipoNotificacao.DivisaoAlterada,
                "Alteração de divisão recebida",
                $"Uma alteração de divisão foi proposta: sua parte passaria de {participante.Valor:C} para {itemVersao.ValorProposto:C}.",
                divisao,
                "ResponderAlteracaoDivisao",
                versao.Versao,
                participante.Id);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(divisao);
    }

    public async Task<DivisaoTransacaoResponse?> AceitarAlteracaoAsync(
        Guid usuarioId,
        Guid versaoId,
        CancellationToken cancellationToken = default)
    {
        var versao = await ObterVersaoComDivisaoAsync(versaoId, cancellationToken);
        if (versao is null)
        {
            return null;
        }

        if (versao.Status != DivisaoTransacaoVersaoStatus.PropostaPendente)
        {
            throw new InvalidOperationException("Alteração não está pendente.");
        }

        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var divisao = versao.DivisaoTransacao;
        GarantirItensVersaoHistorica(versao);
        var resposta = versao.Participantes.SingleOrDefault(item =>
            item.DivisaoTransacaoParticipante.ParticipanteUsuarioId == usuarioId &&
            item.DivisaoTransacaoParticipante.UsuarioId == usuarioId);
        if (resposta is null)
        {
            throw new InvalidOperationException("Alteração não pertence ao usuário autenticado.");
        }

        if (resposta.Status != DivisaoTransacaoVersaoParticipanteStatus.Pendente)
        {
            throw new InvalidOperationException("Este participante já respondeu à alteração.");
        }

        resposta.Status = DivisaoTransacaoVersaoParticipanteStatus.Aceita;
        resposta.RespondidoEm = DateTimeOffset.UtcNow;
        ResolverNotificacoesPendentes(
            usuarioId,
            divisao.Id,
            TipoNotificacao.DivisaoAlterada,
            resposta.DivisaoTransacaoParticipanteId);
        CriarNotificacao(
            divisao.UsuarioCriadorId,
            TipoNotificacao.AlteracaoDivisaoAceita,
            "Alteração de divisão aceita",
            "Um participante aceitou a alteração proposta.",
            divisao,
            null,
            versao.Versao,
            resposta.DivisaoTransacaoParticipanteId);

        if (versao.Participantes.Any(item =>
            item.Status == DivisaoTransacaoVersaoParticipanteStatus.Pendente))
        {
            divisao.Status = DivisaoTransacaoStatus.AlteracaoPendente;
            divisao.AtualizadoEm = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
            await dbTransaction.CommitAsync(cancellationToken);
            return Mapear(divisao, usuarioId);
        }

        var criador = ObterParticipanteCriador(divisao);
        var transacaoOrigem = await ObterTransacaoOrigemAsync(divisao, cancellationToken);
        var compraOrigem = await ObterCompraParceladaOrigemAsync(divisao, cancellationToken);

        divisao.ValorTotal = versao.ValorTotalProposto;
        divisao.VersaoAtual = versao.Versao;
        divisao.Status = DivisaoTransacaoStatus.Aceita;
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;
        criador.Percentual = versao.PercentualCriadorProposto;
        criador.Valor = versao.ValorCriadorProposto;
        criador.VersaoAceita = versao.Versao;
        if (transacaoOrigem is not null && DeveAtualizarOcorrencia(transacaoOrigem, versao.Escopo))
        {
            transacaoOrigem.ValorTotalOriginal = versao.ValorTotalProposto;
            transacaoOrigem.PercentualDivisao = versao.PercentualCriadorProposto;
            transacaoOrigem.Valor = versao.ValorCriadorProposto;
            if (versao.VencimentoProposto.HasValue)
            {
                transacaoOrigem.DataOcorrencia = versao.VencimentoProposto.Value;
            }
        }

        if (compraOrigem is not null)
        {
            compraOrigem.IsDividida = true;
            compraOrigem.ValorTotalOriginal = versao.ValorTotalProposto;
            compraOrigem.PercentualDivisao = versao.PercentualCriadorProposto;
            compraOrigem.ValorTotal = versao.ValorCriadorProposto;
            compraOrigem.QuantidadeParcelas = versao.QuantidadeParcelasProposta ??
                compraOrigem.QuantidadeParcelas;
            AplicarPrimeiraCompetencia(compraOrigem, versao.VencimentoProposto);
        }

        var idsTransacoes = versao.Participantes
            .Select(item => item.DivisaoTransacaoParticipante.TransacaoGeradaId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .ToList();
        var transacoesGeradas = await _dbContext.Transacoes
            .IgnoreQueryFilters()
            .Where(item => idsTransacoes.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken);
        var idsCompras = versao.Participantes
            .Select(item => item.DivisaoTransacaoParticipante.CompraParceladaGeradaId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .ToList();
        var comprasGeradas = await _dbContext.ComprasParceladas
            .IgnoreQueryFilters()
            .Where(item => idsCompras.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken);

        foreach (var itemVersao in versao.Participantes)
        {
            var participante = itemVersao.DivisaoTransacaoParticipante;
            participante.Percentual = itemVersao.PercentualProposto;
            participante.Valor = itemVersao.ValorProposto;
            participante.VersaoAceita = versao.Versao;

            if (participante.TransacaoGeradaId.HasValue &&
                transacoesGeradas.TryGetValue(participante.TransacaoGeradaId.Value, out var transacaoGerada) &&
                DeveAtualizarOcorrencia(transacaoGerada, versao.Escopo))
            {
                transacaoGerada.Valor = itemVersao.ValorProposto;
                if (versao.VencimentoProposto.HasValue)
                {
                    transacaoGerada.DataOcorrencia = versao.VencimentoProposto.Value;
                }
            }

            if (participante.CompraParceladaGeradaId.HasValue &&
                comprasGeradas.TryGetValue(participante.CompraParceladaGeradaId.Value, out var compraGerada))
            {
                compraGerada.ValorTotal = itemVersao.ValorProposto;
                compraGerada.QuantidadeParcelas = versao.QuantidadeParcelasProposta ??
                    compraGerada.QuantidadeParcelas;
                AplicarPrimeiraCompetencia(compraGerada, versao.VencimentoProposto);
            }

            await CriarOuAtualizarPendenciaReembolsoAsync(divisao, participante, cancellationToken);
        }

        versao.Status = DivisaoTransacaoVersaoStatus.Aceita;
        versao.UsuarioRespondenteId = usuarioId;
        versao.RespondidoEm = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
        return Mapear(divisao, usuarioId);
    }

    public async Task<DivisaoTransacaoResponse?> RecusarAlteracaoAsync(
        Guid usuarioId,
        Guid versaoId,
        ResponderAlteracaoDivisaoRequest request,
        CancellationToken cancellationToken = default)
    {
        var versao = await ObterVersaoComDivisaoAsync(versaoId, cancellationToken);
        if (versao is null)
        {
            return null;
        }

        if (versao.Status != DivisaoTransacaoVersaoStatus.PropostaPendente)
        {
            throw new InvalidOperationException("Alteração não está pendente.");
        }

        GarantirItensVersaoHistorica(versao);
        var resposta = versao.Participantes.SingleOrDefault(item =>
            item.DivisaoTransacaoParticipante.ParticipanteUsuarioId == usuarioId &&
            item.DivisaoTransacaoParticipante.UsuarioId == usuarioId);
        if (resposta is null)
        {
            throw new InvalidOperationException("Alteração não pertence ao usuário autenticado.");
        }

        if (resposta.Status != DivisaoTransacaoVersaoParticipanteStatus.Pendente)
        {
            throw new InvalidOperationException("Este participante já respondeu à alteração.");
        }

        resposta.Status = DivisaoTransacaoVersaoParticipanteStatus.Recusada;
        resposta.RespondidoEm = DateTimeOffset.UtcNow;
        resposta.MotivoResposta = NormalizarTexto(request.Motivo);
        versao.Status = DivisaoTransacaoVersaoStatus.Recusada;
        versao.UsuarioRespondenteId = usuarioId;
        versao.RespondidoEm = DateTimeOffset.UtcNow;
        versao.MotivoResposta = NormalizarTexto(request.Motivo);
        versao.DivisaoTransacao.Status = DivisaoTransacaoStatus.Aceita;
        versao.DivisaoTransacao.AtualizadoEm = DateTimeOffset.UtcNow;
        ResolverNotificacoesPendentes(
            usuarioId,
            versao.DivisaoTransacao.Id,
            TipoNotificacao.DivisaoAlterada,
            resposta.DivisaoTransacaoParticipanteId);
        CriarNotificacao(
            versao.DivisaoTransacao.UsuarioCriadorId,
            TipoNotificacao.AlteracaoDivisaoRecusada,
            "Alteração de divisão recusada",
            "Uma alteração de divisão foi recusada pelo participante.",
            versao.DivisaoTransacao,
            "DecidirAlteracaoDivisao",
            versao.Versao,
            resposta.DivisaoTransacaoParticipanteId);

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(versao.DivisaoTransacao, usuarioId);
    }

    public async Task<DivisaoTransacaoResponse?> ReenviarAlteracaoAsync(
        Guid usuarioId,
        Guid versaoId,
        ReenviarAlteracaoDivisaoRequest request,
        CancellationToken cancellationToken = default)
    {
        var versao = await ObterVersaoComDivisaoAsync(versaoId, cancellationToken);
        if (versao is null)
        {
            return null;
        }

        if (versao.DivisaoTransacao.UsuarioCriadorId != usuarioId)
        {
            throw new InvalidOperationException("Somente o criador pode reenviar alteração.");
        }

        if (versao.Status != DivisaoTransacaoVersaoStatus.Recusada)
        {
            throw new InvalidOperationException("Somente alterações recusadas podem ser reenviadas.");
        }

        var divisaoId = versao.DivisaoTransacaoId;
        return await ProporAlteracaoAsync(usuarioId, divisaoId, request, cancellationToken);
    }

    public async Task<DivisaoTransacaoResponse?> ManterVersaoAnteriorAsync(
        Guid usuarioId,
        Guid versaoId,
        CancellationToken cancellationToken = default)
    {
        var versao = await ObterVersaoComDivisaoAsync(versaoId, cancellationToken);
        if (versao is null)
        {
            return null;
        }

        if (versao.DivisaoTransacao.UsuarioCriadorId != usuarioId)
        {
            throw new InvalidOperationException("Somente o criador pode decidir manter a versão anterior.");
        }

        if (versao.Status != DivisaoTransacaoVersaoStatus.Recusada)
        {
            throw new InvalidOperationException("Somente alterações recusadas podem ser encerradas mantendo a versão anterior.");
        }

        versao.DivisaoTransacao.Status = DivisaoTransacaoStatus.Aceita;
        versao.DivisaoTransacao.AtualizadoEm = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(versao.DivisaoTransacao);
    }

    public async Task<IReadOnlyList<ReembolsoDivisaoResponse>> ListarReembolsosAsync(
        Guid usuarioId,
        Guid divisaoId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.ReembolsosDivisao
            .AsNoTracking()
            .Where(item => item.UsuarioId == usuarioId && item.DivisaoTransacaoId == divisaoId)
            .OrderBy(item => item.CriadoEm)
            .Select(item => new ReembolsoDivisaoResponse
            {
                Id = item.Id,
                DivisaoTransacaoId = item.DivisaoTransacaoId,
                ParticipanteId = item.ParticipanteId,
                ParticipanteUsuarioId = item.ParticipanteUsuarioId,
                ParticipanteExternoNome = item.ParticipanteExternoNome,
                ValorDevido = item.ValorDevido,
                ValorRecebido = item.ValorRecebido,
                SaldoPendente = item.ValorDevido - item.ValorRecebido,
                Status = item.Status
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ReembolsoDivisaoResponse>> ListarReembolsosPendentesAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.ReembolsosDivisao
            .AsNoTracking()
            .Where(item =>
                item.UsuarioId == usuarioId &&
                item.Status != ReembolsoDivisaoStatus.Recebido &&
                item.Status != ReembolsoDivisaoStatus.Dispensado &&
                item.ValorDevido > item.ValorRecebido)
            .OrderByDescending(item => item.AtualizadoEm)
            .Select(item => new ReembolsoDivisaoResponse
            {
                Id = item.Id,
                DivisaoTransacaoId = item.DivisaoTransacaoId,
                ParticipanteId = item.ParticipanteId,
                ParticipanteUsuarioId = item.ParticipanteUsuarioId,
                ParticipanteExternoNome = item.ParticipanteExternoNome,
                ValorDevido = item.ValorDevido,
                ValorRecebido = item.ValorRecebido,
                SaldoPendente = item.SaldoPendente,
                Status = item.Status
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<ReembolsoDivisaoResponse?> DispensarReembolsoAsync(
        Guid usuarioId,
        Guid reembolsoId,
        CancellationToken cancellationToken = default)
    {
        var reembolso = await _dbContext.ReembolsosDivisao
            .SingleOrDefaultAsync(
                item => item.Id == reembolsoId && item.UsuarioId == usuarioId,
                cancellationToken);
        if (reembolso is null)
        {
            return null;
        }

        if (reembolso.ValorRecebido > 0)
        {
            throw new InvalidOperationException("Reembolso parcial não pode ser dispensado sem preservar o histórico recebido.");
        }

        reembolso.Status = ReembolsoDivisaoStatus.Dispensado;
        reembolso.AtualizadoEm = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapearReembolso(reembolso);
    }

    public async Task<int> ProcessarExpiracoesAsync(
        DateTimeOffset agora,
        CancellationToken cancellationToken = default)
    {
        var candidatos = await _dbContext.DivisoesTransacoesParticipantes
            .IgnoreQueryFilters()
            .Include(participante => participante.DivisaoTransacao)
            .Where(participante =>
                participante.Ativo &&
                participante.Status == DivisaoTransacaoParticipanteStatus.Pendente &&
                participante.ExpiraEm.HasValue)
            .ToListAsync(cancellationToken);
        var participantes = candidatos
            .Where(participante => participante.ExpiraEm <= agora)
            .ToList();

        foreach (var participante in participantes)
        {
            participante.Status = DivisaoTransacaoParticipanteStatus.Expirado;
            participante.RespondidoEm = agora;
            participante.DivisaoTransacao.Status = ObterStatusGlobal(participante.DivisaoTransacao);
            participante.DivisaoTransacao.AtualizadoEm = agora;
            CriarNotificacao(
                participante.DivisaoTransacao.UsuarioCriadorId,
                TipoNotificacao.DivisaoExpirada,
                "Convite de divisão expirado",
                $"Um convite de divisão expirou: {participante.Valor:C} ({participante.Percentual}%).",
                participante.DivisaoTransacao,
                "DecidirRecusaDivisao",
                participante.DivisaoTransacao.VersaoAtual,
                participante.Id);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return participantes.Count;
    }

    private async Task<Usuario> ResolverUsuarioConvidadoAsync(
        Guid usuarioId,
        CriarParticipanteUsuarioDivisaoRequest request,
        CancellationToken cancellationToken)
    {
        if (request.ContatoId.HasValue)
        {
            var contato = await _dbContext.ContatosDivisao
                .IgnoreQueryFilters()
                .Include(item => item.UsuarioContato)
                .SingleOrDefaultAsync(
                    item => item.Id == request.ContatoId.Value &&
                        item.UsuarioId == usuarioId &&
                        item.Ativo,
                    cancellationToken);
            return contato?.UsuarioContato ??
                throw new InvalidOperationException("Contato convidado não encontrado.");
        }

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            throw new InvalidOperationException("Informe o contato ou e-mail do convidado.");
        }

        var email = NormalizarEmail(request.Email);
        var usuarioAtual = await _dbContext.Usuarios
            .AsNoTracking()
            .SingleAsync(usuario => usuario.Id == usuarioId, cancellationToken);
        if (NormalizarEmail(usuarioAtual.Email) == email)
        {
            throw new InvalidOperationException("Não é possível convidar o próprio e-mail.");
        }

        return await _dbContext.Usuarios
            .SingleOrDefaultAsync(usuario => usuario.Email.ToLower() == email, cancellationToken) ??
            throw new InvalidOperationException("Usuário convidado não encontrado.");
    }

    private async Task SalvarContatoSeSolicitadoAsync(
        Guid usuarioId,
        Guid usuarioContatoId,
        bool salvarContato,
        string? apelido,
        DateTimeOffset agora,
        CancellationToken cancellationToken)
    {
        if (!salvarContato)
        {
            return;
        }

        var contato = await _dbContext.ContatosDivisao
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(
                item => item.UsuarioId == usuarioId && item.UsuarioContatoId == usuarioContatoId,
                cancellationToken);
        if (contato is null)
        {
            _dbContext.ContatosDivisao.Add(new ContatoDivisao
            {
                UsuarioId = usuarioId,
                UsuarioContatoId = usuarioContatoId,
                Apelido = NormalizarTexto(apelido),
                UltimoUsoEm = agora,
                Ativo = true
            });
            return;
        }

        contato.Apelido = NormalizarTexto(apelido) ?? contato.Apelido;
        contato.UltimoUsoEm = agora;
        contato.Ativo = true;
    }

    private async Task ValidarClassificacaoAsync(
        Guid usuarioId,
        ClassificarAceiteDivisaoRequest? request,
        CancellationToken cancellationToken)
    {
        if (request?.CategoriaId.HasValue == true)
        {
            var existe = await _dbContext.Categorias
                .IgnoreQueryFilters()
                .AnyAsync(
                    categoria => categoria.Id == request.CategoriaId.Value &&
                        (categoria.UsuarioId == null || categoria.UsuarioId == usuarioId),
                    cancellationToken);
            if (!existe)
            {
                throw new InvalidOperationException("Categoria inválida para o usuário convidado.");
            }
        }

        if (request?.ContaBancariaId.HasValue == true)
        {
            var existe = await _dbContext.ContasBancarias
                .IgnoreQueryFilters()
                .AnyAsync(
                    conta => conta.Id == request.ContaBancariaId.Value &&
                        conta.UsuarioId == usuarioId &&
                        !conta.IsArquivada,
                    cancellationToken);
            if (!existe)
            {
                throw new InvalidOperationException("Conta inválida para o usuário convidado.");
            }
        }

        if (request?.CartaoCreditoId.HasValue == true)
        {
            var existe = await _dbContext.CartoesCredito
                .IgnoreQueryFilters()
                .AnyAsync(
                    cartao => cartao.Id == request.CartaoCreditoId.Value &&
                        cartao.UsuarioId == usuarioId &&
                        !cartao.IsArquivado,
                    cancellationToken);
            if (!existe)
            {
                throw new InvalidOperationException("Cartão inválido para o usuário convidado.");
            }
        }
    }

    private async Task<DivisaoTransacaoParticipante?> ObterParticipanteComDivisaoAsync(
        Guid participanteId,
        CancellationToken cancellationToken)
    {
        return await _dbContext.DivisoesTransacoesParticipantes
            .IgnoreQueryFilters()
            .Include(participante => participante.DivisaoTransacao)
                .ThenInclude(divisao => divisao.Participantes)
            .Include(participante => participante.DivisaoTransacao)
                .ThenInclude(divisao => divisao.Versoes)
                    .ThenInclude(versao => versao.Participantes)
            .Include(participante => participante.DivisaoTransacao)
                .ThenInclude(divisao => divisao.CompraParcelada)
                    .ThenInclude(compra => compra!.CartaoCredito)
            .SingleOrDefaultAsync(participante => participante.Id == participanteId, cancellationToken);
    }

    private async Task<DivisaoTransacao?> ObterDivisaoDoCriadorAsync(
        Guid usuarioId,
        Guid divisaoId,
        CancellationToken cancellationToken)
    {
        return await _dbContext.DivisoesTransacoes
            .IgnoreQueryFilters()
            .Include(divisao => divisao.Participantes)
            .Include(divisao => divisao.Versoes)
                .ThenInclude(versao => versao.Participantes)
            .Include(divisao => divisao.CompraParcelada)
                .ThenInclude(compra => compra!.CartaoCredito)
            .SingleOrDefaultAsync(
                divisao => divisao.Id == divisaoId &&
                    divisao.UsuarioCriadorId == usuarioId,
                cancellationToken);
    }

    private async Task<DivisaoTransacaoVersao?> ObterVersaoComDivisaoAsync(
        Guid versaoId,
        CancellationToken cancellationToken)
    {
        return await _dbContext.DivisoesTransacoesVersoes
            .IgnoreQueryFilters()
            .Include(versao => versao.DivisaoTransacao)
                .ThenInclude(divisao => divisao.Participantes)
            .Include(versao => versao.DivisaoTransacao)
                .ThenInclude(divisao => divisao.Versoes)
                    .ThenInclude(item => item.Participantes)
            .Include(versao => versao.Participantes)
                .ThenInclude(item => item.DivisaoTransacaoParticipante)
            .Include(versao => versao.DivisaoTransacao)
                .ThenInclude(divisao => divisao.CompraParcelada)
                    .ThenInclude(compra => compra!.CartaoCredito)
            .SingleOrDefaultAsync(versao => versao.Id == versaoId, cancellationToken);
    }

    private async Task<Transacao?> ObterTransacaoOrigemAsync(
        DivisaoTransacao divisao,
        CancellationToken cancellationToken)
    {
        return divisao.TransacaoOrigemId.HasValue
            ? await _dbContext.Transacoes
                .IgnoreQueryFilters()
                .Include(transacao => transacao.CartaoCredito)
                .SingleOrDefaultAsync(
                    transacao => transacao.Id == divisao.TransacaoOrigemId.Value,
                    cancellationToken)
            : null;
    }

    private async Task<CompraParcelada?> ObterCompraParceladaOrigemAsync(
        DivisaoTransacao divisao,
        CancellationToken cancellationToken)
    {
        return divisao.CompraParceladaId.HasValue
            ? await _dbContext.ComprasParceladas
                .IgnoreQueryFilters()
                .Include(compra => compra.Categoria)
                .Include(compra => compra.CartaoCredito)
                .SingleOrDefaultAsync(
                    compra => compra.Id == divisao.CompraParceladaId.Value,
                    cancellationToken)
            : null;
    }

    private async Task<Guid> ObterCategoriaDaObrigacaoParceladaAsync(
        Guid usuarioId,
        Guid? categoriaInformadaId,
        CompraParcelada compraOrigem,
        CancellationToken cancellationToken)
    {
        if (categoriaInformadaId.HasValue)
        {
            return categoriaInformadaId.Value;
        }

        if (compraOrigem.Categoria.UsuarioId is null)
        {
            return compraOrigem.CategoriaId;
        }

        var categoriaGlobalId = await _dbContext.Categorias
            .IgnoreQueryFilters()
            .Where(categoria => categoria.UsuarioId == null)
            .OrderBy(categoria => categoria.Nome)
            .Select(categoria => (Guid?)categoria.Id)
            .FirstOrDefaultAsync(cancellationToken);

        return categoriaGlobalId ?? throw new InvalidOperationException(
            "Selecione uma categoria para aceitar esta divisão parcelada.");
    }

    private static DateOnly? ObterPrimeiraCompetencia(CompraParcelada? compra)
    {
        if (compra is null)
        {
            return null;
        }

        if (compra.FormaPagamento == FormaPagamentoCompraParcelada.Carne)
        {
            return compra.DataPrimeiroVencimento;
        }

        if (compra.CartaoCredito is null)
        {
            return compra.DataCompra;
        }

        return CicloFaturaCartaoCalculator
            .CalcularParaCompra(compra.CartaoCredito, compra.DataCompra)
            .DataVencimento;
    }

    private static void AplicarPrimeiraCompetencia(CompraParcelada compra, DateOnly? primeiraCompetencia)
    {
        if (!primeiraCompetencia.HasValue)
        {
            return;
        }

        if (compra.FormaPagamento == FormaPagamentoCompraParcelada.Carne)
        {
            compra.DataPrimeiroVencimento = primeiraCompetencia.Value;
        }
        else
        {
            compra.DataCompra = primeiraCompetencia.Value;
        }
    }

    private async Task CriarOuAtualizarPendenciaReembolsoAsync(
        DivisaoTransacao divisao,
        DivisaoTransacaoParticipante participante,
        CancellationToken cancellationToken)
    {
        if (participante.TipoParticipante == TipoParticipanteDivisao.Criador ||
            participante.Status != DivisaoTransacaoParticipanteStatus.Aceito ||
            (participante.TipoParticipante == TipoParticipanteDivisao.UsuarioSistema &&
                !participante.ParticipanteUsuarioId.HasValue))
        {
            return;
        }

        var reembolso = await _dbContext.ReembolsosDivisao
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(
                item => item.UsuarioId == divisao.UsuarioCriadorId &&
                    item.DivisaoTransacaoId == divisao.Id &&
                    item.ParticipanteId == participante.Id,
                cancellationToken);

        if (reembolso is null)
        {
            _dbContext.ReembolsosDivisao.Add(new ReembolsoDivisao
            {
                UsuarioId = divisao.UsuarioCriadorId,
                DivisaoTransacaoId = divisao.Id,
                ParticipanteId = participante.Id,
                ParticipanteUsuarioId = participante.ParticipanteUsuarioId,
                ParticipanteExternoNome = participante.TipoParticipante == TipoParticipanteDivisao.Externo
                    ? NormalizarTexto(participante.MotivoResposta) ?? "Participante externo"
                    : null,
                ValorDevido = participante.Valor,
                ValorRecebido = 0m,
                Status = participante.Valor > 0 ? ReembolsoDivisaoStatus.Pendente : ReembolsoDivisaoStatus.Recebido,
                CriadoEm = DateTimeOffset.UtcNow,
                AtualizadoEm = DateTimeOffset.UtcNow
            });
            return;
        }

        if (reembolso.ValorRecebido > participante.Valor)
        {
            throw new InvalidOperationException("A alteração reduziria o reembolso abaixo do valor já recebido.");
        }

        reembolso.ValorDevido = participante.Valor;
        reembolso.AtualizadoEm = DateTimeOffset.UtcNow;
        reembolso.Status = reembolso.ValorRecebido <= 0
            ? ReembolsoDivisaoStatus.Pendente
            : reembolso.ValorRecebido < reembolso.ValorDevido
                ? ReembolsoDivisaoStatus.Parcial
                : ReembolsoDivisaoStatus.Recebido;
    }

    private async Task DispensarReembolsosPendentesAsync(
        Guid divisaoId,
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var reembolsos = await _dbContext.ReembolsosDivisao
            .IgnoreQueryFilters()
            .Where(item =>
                item.UsuarioId == usuarioId &&
                item.DivisaoTransacaoId == divisaoId &&
                item.Status != ReembolsoDivisaoStatus.Recebido)
            .ToListAsync(cancellationToken);

        foreach (var reembolso in reembolsos.Where(item => item.ValorRecebido == 0))
        {
            reembolso.Status = ReembolsoDivisaoStatus.Dispensado;
            reembolso.AtualizadoEm = DateTimeOffset.UtcNow;
        }
    }

    private async Task DispensarReembolsoParticipanteAsync(
        Guid divisaoId,
        Guid participanteId,
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var reembolso = await _dbContext.ReembolsosDivisao
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(item =>
                item.UsuarioId == usuarioId &&
                item.DivisaoTransacaoId == divisaoId &&
                item.ParticipanteId == participanteId &&
                item.Status != ReembolsoDivisaoStatus.Recebido,
                cancellationToken);
        if (reembolso is not null && reembolso.ValorRecebido == 0)
        {
            reembolso.Status = ReembolsoDivisaoStatus.Dispensado;
            reembolso.AtualizadoEm = DateTimeOffset.UtcNow;
        }
    }

    private static DivisaoTransacaoParticipante ObterParticipanteCriador(DivisaoTransacao divisao)
    {
        return divisao.Participantes.Single(participante =>
            participante.Ativo &&
            participante.TipoParticipante == TipoParticipanteDivisao.Criador);
    }

    private static void GarantirItensVersaoHistorica(DivisaoTransacaoVersao versao)
    {
        if (versao.Participantes.Count > 0)
        {
            return;
        }

        var participante = versao.DivisaoTransacao.Participantes.SingleOrDefault(item =>
            item.Ativo &&
            item.TipoParticipante == TipoParticipanteDivisao.UsuarioSistema &&
            item.ParticipanteUsuarioId.HasValue);
        if (participante is null)
        {
            throw new InvalidOperationException(
                "A versão histórica não identifica univocamente o participante afetado.");
        }

        versao.Participantes.Add(new DivisaoTransacaoVersaoParticipante
        {
            UsuarioId = participante.UsuarioId,
            DivisaoTransacaoParticipanteId = participante.Id,
            DivisaoTransacaoParticipante = participante,
            PercentualAnterior = versao.PercentualParticipanteAnterior,
            PercentualProposto = versao.PercentualParticipanteProposto,
            ValorAnterior = versao.ValorParticipanteAnterior,
            ValorProposto = versao.ValorParticipanteProposto,
            Status = DivisaoTransacaoVersaoParticipanteStatus.Pendente
        });
    }

    private static string NormalizarEscopo(string escopo)
    {
        var normalizado = NormalizarTexto(escopo) ?? "EstaOcorrencia";
        return normalizado is "EstaOcorrencia" or "EstaEProximas" or "TodaSerie"
            ? normalizado
            : throw new InvalidOperationException("Escopo de alteração inválido.");
    }

    private static bool DeveAtualizarOcorrencia(Transacao transacao, string escopo)
    {
        if (transacao.IsPaga)
        {
            return false;
        }

        if (escopo == "TodaSerie")
        {
            return true;
        }

        return transacao.DataOcorrencia >= DateOnly.FromDateTime(DateTime.Today);
    }

    private static DivisaoTransacaoStatus ObterStatusGlobal(DivisaoTransacao divisao)
    {
        var convidados = divisao.Participantes
            .Where(participante =>
                participante.Ativo &&
                participante.TipoParticipante == TipoParticipanteDivisao.UsuarioSistema)
            .ToList();
        if (convidados.Any(item => item.Status == DivisaoTransacaoParticipanteStatus.Recusado))
        {
            return DivisaoTransacaoStatus.RecusadaAguardandoDecisao;
        }

        if (convidados.Any(item => item.Status == DivisaoTransacaoParticipanteStatus.Expirado))
        {
            return DivisaoTransacaoStatus.Expirada;
        }

        if (convidados.All(item => item.Status == DivisaoTransacaoParticipanteStatus.Aceito))
        {
            return DivisaoTransacaoStatus.Aceita;
        }

        return convidados.Any(item => item.Status == DivisaoTransacaoParticipanteStatus.Aceito)
            ? DivisaoTransacaoStatus.ParcialmenteAceita
            : DivisaoTransacaoStatus.Pendente;
    }

    private static DateOnly ObterDataPadraoConvidado(Transacao? transacao, CompraParcelada? compra)
    {
        if (compra is not null)
        {
            return ObterPrimeiraCompetencia(compra) ?? compra.DataCompra;
        }

        if (transacao?.CartaoCredito is not null)
        {
            return CicloFaturaCartaoCalculator
                .CalcularParaCompra(transacao.CartaoCredito, transacao.DataOcorrencia)
                .DataVencimento;
        }

        return transacao?.DataOcorrencia ?? DateOnly.FromDateTime(DateTime.Today);
    }

    private async Task<int> ObterProximoCodigoExibicaoAsync(Guid usuarioId, CancellationToken cancellationToken)
    {
        var ultimoCodigo = await _dbContext.Transacoes
            .IgnoreQueryFilters()
            .Where(transacao => transacao.UsuarioId == usuarioId)
            .MaxAsync(transacao => (int?)transacao.CodigoExibicao, cancellationToken);

        return (ultimoCodigo ?? 0) + 1;
    }

    private void CriarNotificacao(
        Guid usuarioId,
        TipoNotificacao tipo,
        string titulo,
        string mensagem,
        DivisaoTransacao divisao,
        string? acaoPendente,
        int? versao,
        Guid? participanteId = null)
    {
        var existe = _dbContext.Notificacoes.Local
            .Any(notificacao =>
                notificacao.UsuarioId == usuarioId &&
                notificacao.TipoNotificacao == tipo &&
                notificacao.Entidade == EntidadeDivisao &&
                notificacao.EntidadeId == divisao.Id &&
                notificacao.Versao == versao &&
                notificacao.ParticipanteDivisaoId == participanteId &&
                !notificacao.Lida);
        if (existe)
        {
            return;
        }

        _dbContext.Notificacoes.Add(new Notificacao
        {
            UsuarioId = usuarioId,
            TipoNotificacao = tipo,
            Titulo = titulo,
            Mensagem = mensagem,
            Lida = false,
            DataCriacao = DateTimeOffset.UtcNow,
            Entidade = EntidadeDivisao,
            EntidadeId = divisao.Id,
            Rota = $"/divisoes/{divisao.Id}",
            AcaoPendente = acaoPendente,
            Versao = versao,
            ParticipanteDivisaoId = participanteId
        });
    }

    private void ResolverNotificacoesPendentes(
        Guid usuarioId,
        Guid divisaoId,
        TipoNotificacao tipo,
        Guid? participanteId = null)
    {
        foreach (var notificacao in _dbContext.Notificacoes
            .IgnoreQueryFilters()
            .Where(notificacao =>
                notificacao.UsuarioId == usuarioId &&
                notificacao.TipoNotificacao == tipo &&
                notificacao.Entidade == EntidadeDivisao &&
                notificacao.EntidadeId == divisaoId &&
                (!participanteId.HasValue || notificacao.ParticipanteDivisaoId == participanteId) &&
                !notificacao.Lida))
        {
            notificacao.Lida = true;
            notificacao.AcaoPendente = null;
        }
    }

    private static DivisaoCompartilhadaResponse? ProjetarDivisaoCompartilhada(
        DivisaoTransacao divisao,
        Guid usuarioId,
        DateOnly dataInicial,
        DateOnly dataFinal,
        IReadOnlyDictionary<Guid, string?> apelidos)
    {
        var ocorrencias = ObterOcorrenciasNoPeriodo(divisao, dataInicial, dataFinal);
        if (ocorrencias.Count == 0)
        {
            return null;
        }

        var participantesVigentes = divisao.Participantes.Any(participante => participante.Ativo)
            ? divisao.Participantes.Where(participante => participante.Ativo).ToList()
            : divisao.Participantes
                .GroupBy(participante => participante.ParticipanteUsuarioId?.ToString() ?? participante.Id.ToString())
                .Select(grupo => grupo.OrderByDescending(participante => participante.VersaoConvite).First())
                .ToList();
        var participanteAtual = participantesVigentes
            .Where(participante => participante.ParticipanteUsuarioId == usuarioId)
            .OrderByDescending(participante => participante.VersaoConvite)
            .FirstOrDefault();
        if (participanteAtual is null)
        {
            return null;
        }

        var quantidadeParcelas = divisao.CompraParcelada?.QuantidadeParcelas ?? 1;
        decimal ProjetarValor(decimal valor)
        {
            return divisao.CompraParcelada is null
                ? valor * ocorrencias.Count
                : ocorrencias.Sum(ocorrencia =>
                    CalcularValorParcela(valor, quantidadeParcelas, ocorrencia.NumeroParcela!.Value));
        }

        var participantes = participantesVigentes
            .OrderBy(participante => participante.TipoParticipante)
            .ThenBy(participante => participante.ParticipanteUsuario?.Nome)
            .Select(participante => new ParticipanteDivisaoCompartilhadaResponse
            {
                Id = participante.Id,
                UsuarioId = participante.ParticipanteUsuarioId,
                NomeExibicao = participante.TipoParticipante == TipoParticipanteDivisao.Externo
                    ? NormalizarTexto(participante.MotivoResposta) ?? "Participante externo"
                    : participante.ParticipanteUsuario is null
                        ? "Participante"
                        : ObterNomePessoa(
                            participante.ParticipanteUsuario.Id,
                            participante.ParticipanteUsuario.Nome,
                            apelidos),
                Tipo = participante.TipoParticipante,
                Percentual = participante.Percentual,
                Valor = ProjetarValor(participante.Valor),
                Status = participante.Status,
                SouEu = participante.ParticipanteUsuarioId == usuarioId,
                Ativo = participante.Ativo
            })
            .ToList();

        var compra = divisao.CompraParcelada;
        var transacao = divisao.TransacaoOrigem;
        var origem = compra is not null
            ? compra.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito
                ? "CartaoParcelado"
                : "Carne"
            : transacao?.CartaoCreditoId.HasValue == true
                ? transacao.IsFixa ? "CartaoRecorrente" : "CartaoCredito"
                : transacao?.IsFixa == true ? "Fixa" : "Avulsa";

        return new DivisaoCompartilhadaResponse
        {
            DivisaoId = divisao.Id,
            Descricao = compra?.Descricao ?? transacao?.Descricao ?? "Despesa compartilhada",
            DataReferencia = ocorrencias.Max(ocorrencia => ocorrencia.Data),
            ValorTotal = ProjetarValor(divisao.ValorTotal),
            ValorTotalSerie = divisao.ValorTotal,
            MinhaParte = ProjetarValor(participanteAtual.Valor),
            MeuPercentual = participanteAtual.Percentual,
            UsuarioCriadorId = divisao.UsuarioCriadorId,
            NomeCriador = ObterNomePessoa(
                divisao.UsuarioCriadorId,
                divisao.UsuarioCriador.Nome,
                apelidos),
            MeuPapel = divisao.UsuarioCriadorId == usuarioId ? "Criador" : "Convidado",
            Origem = origem,
            Status = divisao.Status,
            QuantidadeParcelas = quantidadeParcelas,
            ParcelaInicial = ocorrencias.Min(ocorrencia => ocorrencia.NumeroParcela),
            ParcelaFinal = ocorrencias.Max(ocorrencia => ocorrencia.NumeroParcela),
            QuantidadeOcorrenciasPeriodo = ocorrencias.Count,
            ParticipanteAtualId = participanteAtual.Id,
            TransacaoLocalId = divisao.UsuarioCriadorId == usuarioId
                ? divisao.TransacaoOrigemId
                : participanteAtual.TransacaoGeradaId,
            CompraParceladaLocalId = divisao.UsuarioCriadorId == usuarioId
                ? divisao.CompraParceladaId
                : participanteAtual.CompraParceladaGeradaId,
            Participantes = participantes
        };
    }

    private static IReadOnlyList<OcorrenciaDivisaoCompartilhada> ObterOcorrenciasNoPeriodo(
        DivisaoTransacao divisao,
        DateOnly dataInicial,
        DateOnly dataFinal)
    {
        if (divisao.CompraParcelada is { } compra)
        {
            var primeiraData = compra.FormaPagamento == FormaPagamentoCompraParcelada.CartaoCredito
                ? compra.CartaoCredito is null
                    ? (DateOnly?)null
                    : CicloFaturaCartaoCalculator.CalcularParaCompra(
                        compra.CartaoCredito,
                        compra.DataCompra).DataVencimento
                : compra.DataPrimeiroVencimento ?? compra.DataCompra;
            if (!primeiraData.HasValue)
            {
                return [];
            }

            return Enumerable.Range(1, compra.QuantidadeParcelas)
                .Select(numero => new OcorrenciaDivisaoCompartilhada(
                    primeiraData.Value.AddMonths(numero - 1),
                    numero))
                .Where(ocorrencia => ocorrencia.Data >= dataInicial && ocorrencia.Data <= dataFinal)
                .ToList();
        }

        if (divisao.TransacaoOrigem is not { } transacao)
        {
            return [];
        }

        DateOnly ObterDataFinanceira(DateOnly dataOcorrencia)
        {
            return transacao.CartaoCredito is null
                ? dataOcorrencia
                : CicloFaturaCartaoCalculator.CalcularParaCompra(
                    transacao.CartaoCredito,
                    dataOcorrencia).DataVencimento;
        }

        if (!transacao.IsFixa)
        {
            var data = ObterDataFinanceira(transacao.DataOcorrencia);
            return data >= dataInicial && data <= dataFinal
                ? [new OcorrenciaDivisaoCompartilhada(data, null)]
                : [];
        }

        var ocorrencias = new List<OcorrenciaDivisaoCompartilhada>();
        var inicioBusca = transacao.CartaoCredito is null
            ? dataInicial
            : dataInicial.AddMonths(-1);
        var referencia = transacao.DataOcorrencia;
        if (referencia < inicioBusca)
        {
            var meses = ((inicioBusca.Year - referencia.Year) * 12) +
                inicioBusca.Month - referencia.Month;
            referencia = referencia.AddMonths(Math.Max(0, meses));
        }

        while (referencia <= dataFinal)
        {
            var data = ObterDataFinanceira(referencia);
            if (data >= dataInicial && data <= dataFinal)
            {
                ocorrencias.Add(new OcorrenciaDivisaoCompartilhada(data, null));
            }

            referencia = referencia.AddMonths(1);
        }

        return ocorrencias;
    }

    private static decimal CalcularValorParcela(
        decimal valorTotal,
        int quantidadeParcelas,
        int numeroParcela)
    {
        var valorBase = Math.Round(
            valorTotal / quantidadeParcelas,
            2,
            MidpointRounding.AwayFromZero);
        return numeroParcela == quantidadeParcelas
            ? valorTotal - (valorBase * (quantidadeParcelas - 1))
            : valorBase;
    }

    private static string ObterNomePessoa(
        Guid usuarioId,
        string nome,
        IReadOnlyDictionary<Guid, string?> apelidos)
    {
        return apelidos.TryGetValue(usuarioId, out var apelido) &&
            !string.IsNullOrWhiteSpace(apelido)
                ? apelido.Trim()
                : nome;
    }

    private sealed record OcorrenciaDivisaoCompartilhada(DateOnly Data, int? NumeroParcela);

    private DivisaoTransacaoResponse Mapear(
        DivisaoTransacao divisao,
        Guid? usuarioVisualizadorId = null)
    {
        var podeVerTodos = !usuarioVisualizadorId.HasValue ||
            divisao.UsuarioCriadorId == usuarioVisualizadorId.Value;
        return new DivisaoTransacaoResponse
        {
            Id = divisao.Id,
            UsuarioCriadorId = divisao.UsuarioCriadorId,
            TransacaoOrigemId = divisao.TransacaoOrigemId,
            CompraParceladaId = divisao.CompraParceladaId,
            QuantidadeParcelas = divisao.CompraParcelada?.QuantidadeParcelas,
            FormaPagamentoCompraParcelada = divisao.CompraParcelada?.FormaPagamento,
            DataPrimeiraParcela = ObterPrimeiraCompetencia(divisao.CompraParcelada),
            DescricaoOrigem = divisao.CompraParcelada?.Descricao,
            DataSugeridaConvidado = divisao.TransacaoOrigem is not null
                ? ObterDataPadraoConvidado(divisao.TransacaoOrigem, null)
                : ObterPrimeiraCompetencia(divisao.CompraParcelada),
            ValorTotal = divisao.ValorTotal,
            Status = divisao.Status,
            VersaoAtual = divisao.VersaoAtual,
            QuantidadeReenvios = divisao.QuantidadeReenvios,
            CriadoEm = divisao.CriadoEm,
            AtualizadoEm = divisao.AtualizadoEm,
            Participantes = divisao.Participantes
                .Where(participante =>
                    podeVerTodos || participante.ParticipanteUsuarioId == usuarioVisualizadorId)
                .OrderBy(participante => participante.TipoParticipante)
                .ThenBy(participante => participante.VersaoConvite)
                .Select(participante => new DivisaoParticipanteResponse
                {
                    Id = participante.Id,
                    ParticipanteUsuarioId = participante.ParticipanteUsuarioId,
                    NomeExibicao = participante.TipoParticipante == TipoParticipanteDivisao.Externo
                        ? NormalizarTexto(participante.MotivoResposta) ?? "Participante externo"
                        : participante.ParticipanteUsuario != null
                            ? participante.ParticipanteUsuario.Nome
                            : null,
                    EmailMascarado = participante.ParticipanteUsuario != null
                        ? ContatoDivisaoService.MascararEmail(participante.ParticipanteUsuario.Email)
                        : null,
                    TipoParticipante = participante.TipoParticipante,
                    Percentual = participante.Percentual,
                    Valor = participante.Valor,
                    ModoDefinicao = participante.ModoDefinicao,
                    Status = participante.Status,
                    VersaoConvite = participante.VersaoConvite,
                    ExpiraEm = participante.ExpiraEm,
                    TransacaoGeradaId = participante.TransacaoGeradaId,
                    CompraParceladaGeradaId = participante.CompraParceladaGeradaId,
                    Ativo = participante.Ativo
                })
                .ToList(),
            Versoes = divisao.Versoes
                .OrderBy(versao => versao.Versao)
                .Select(versao => new DivisaoVersaoResponse
                {
                    Id = versao.Id,
                    Versao = versao.Versao,
                    Status = versao.Status,
                    Escopo = versao.Escopo,
                    ValorTotalAnterior = versao.ValorTotalAnterior,
                    ValorTotalProposto = versao.ValorTotalProposto,
                    PercentualCriadorAnterior = versao.PercentualCriadorAnterior,
                    PercentualCriadorProposto = versao.PercentualCriadorProposto,
                    ValorCriadorAnterior = versao.ValorCriadorAnterior,
                    ValorCriadorProposto = versao.ValorCriadorProposto,
                    PercentualParticipanteAnterior = versao.PercentualParticipanteAnterior,
                    PercentualParticipanteProposto = versao.PercentualParticipanteProposto,
                    ValorParticipanteAnterior = versao.ValorParticipanteAnterior,
                    ValorParticipanteProposto = versao.ValorParticipanteProposto,
                    VencimentoAnterior = versao.VencimentoAnterior,
                    VencimentoProposto = versao.VencimentoProposto,
                    QuantidadeParcelasAnterior = versao.QuantidadeParcelasAnterior,
                    QuantidadeParcelasProposta = versao.QuantidadeParcelasProposta,
                    RecorrenciaAnterior = versao.RecorrenciaAnterior,
                    RecorrenciaProposta = versao.RecorrenciaProposta,
                    FrequenciaAnterior = versao.FrequenciaAnterior,
                    FrequenciaProposta = versao.FrequenciaProposta,
                    ResponsabilidadeAnterior = versao.ResponsabilidadeAnterior,
                    ResponsabilidadeProposta = versao.ResponsabilidadeProposta,
                    CriadoEm = versao.CriadoEm,
                    RespondidoEm = versao.RespondidoEm,
                    MotivoResposta = versao.MotivoResposta,
                    Participantes = versao.Participantes
                    .Where(item => podeVerTodos ||
                        item.DivisaoTransacaoParticipante.ParticipanteUsuarioId == usuarioVisualizadorId)
                    .Select(item => new DivisaoVersaoParticipanteResponse
                    {
                        Id = item.Id,
                        ParticipanteId = item.DivisaoTransacaoParticipanteId,
                        ParticipanteUsuarioId = item.DivisaoTransacaoParticipante.ParticipanteUsuarioId,
                        PercentualAnterior = item.PercentualAnterior,
                        PercentualProposto = item.PercentualProposto,
                        ValorAnterior = item.ValorAnterior,
                        ValorProposto = item.ValorProposto,
                        Status = item.Status,
                        RespondidoEm = item.RespondidoEm,
                        MotivoResposta = item.MotivoResposta
                    }).ToList()
                })
                .ToList()
        };
    }

    private static ReembolsoDivisaoResponse MapearReembolso(ReembolsoDivisao reembolso)
    {
        return new ReembolsoDivisaoResponse
        {
            Id = reembolso.Id,
            DivisaoTransacaoId = reembolso.DivisaoTransacaoId,
            ParticipanteId = reembolso.ParticipanteId,
            ParticipanteUsuarioId = reembolso.ParticipanteUsuarioId,
            ParticipanteExternoNome = reembolso.ParticipanteExternoNome,
            ValorDevido = reembolso.ValorDevido,
            ValorRecebido = reembolso.ValorRecebido,
            SaldoPendente = reembolso.SaldoPendente,
            Status = reembolso.Status
        };
    }

    private static void VerificarRateLimit(Guid usuarioId, DateTimeOffset agora)
    {
        var fila = ResolucaoEmailPorUsuario.GetOrAdd(usuarioId, _ => new Queue<DateTimeOffset>());
        lock (fila)
        {
            while (fila.Count > 0 && agora - fila.Peek() > TimeSpan.FromMinutes(1))
            {
                fila.Dequeue();
            }

            if (fila.Count >= LimiteResolucaoEmailPorMinuto)
            {
                throw new InvalidOperationException("RATE_LIMIT_RESOLUCAO_EMAIL");
            }

            fila.Enqueue(agora);
        }
    }

    private static List<CriarParticipanteUsuarioDivisaoRequest> NormalizarParticipantesUsuarios(
        CriarConviteDivisaoRequest request)
    {
        var participantes = (request.ParticipantesUsuarios ?? [])
            .Where(participante =>
                participante.ContatoId.HasValue ||
                !string.IsNullOrWhiteSpace(participante.Email))
            .ToList();

        // O contrato atual prevalece sobre os campos legados. Isso também permite
        // que clientes em atualização enviem o apelido no campo antigo junto do ContatoId.
        if (participantes.Count > 0)
        {
            return participantes;
        }

        if (!string.IsNullOrWhiteSpace(request.EmailConvidado))
        {
            if (!new EmailAddressAttribute().IsValid(request.EmailConvidado))
            {
                throw new InvalidOperationException("Informe um e-mail válido para o convidado.");
            }

            if (!request.PercentualConvidado.HasValue)
            {
                throw new InvalidOperationException("Informe o percentual do convidado.");
            }

            participantes.Add(new CriarParticipanteUsuarioDivisaoRequest
            {
                Email = request.EmailConvidado!,
                Percentual = request.PercentualConvidado.Value,
                SalvarContato = request.SalvarContato,
                ApelidoContato = request.ApelidoContato
            });
        }

        return participantes;
    }

    private static string NormalizarEmail(string email) => email.Trim().ToLowerInvariant();

    private static string? NormalizarTexto(string? texto) =>
        string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();
}
