using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Divisoes;
using SistemaFinanceiro.Api.Models;

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
            .Include(item => item.Versoes)
            .SingleOrDefaultAsync(
                item => item.Id == divisaoId &&
                    (item.UsuarioCriadorId == usuarioId ||
                        item.Participantes.Any(participante =>
                            participante.UsuarioId == usuarioId ||
                            participante.ParticipanteUsuarioId == usuarioId)),
                cancellationToken);

        return divisao is null ? null : Mapear(divisao);
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
        var email = NormalizarEmail(request.EmailConvidado);
        var convidado = await ResolverUsuarioConvidadoAsync(usuarioId, email, cancellationToken);
        var transacao = await _dbContext.Transacoes
            .SingleOrDefaultAsync(
                item => item.Id == request.TransacaoOrigemId &&
                    item.UsuarioId == usuarioId,
                cancellationToken);
        if (transacao is null)
        {
            throw new InvalidOperationException("Transação de origem não encontrada.");
        }

        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var agora = DateTimeOffset.UtcNow;
        var valorTotal = transacao.ValorTotalOriginal ?? transacao.Valor;
        var percentualCriador = 100m - request.PercentualConvidado;
        var valores = DivisaoTransacaoRules.CalcularValores(valorTotal, [percentualCriador, request.PercentualConvidado]);

        transacao.IsDividida = true;
        transacao.ValorTotalOriginal = valorTotal;
        transacao.PercentualDivisao = percentualCriador;
        transacao.Valor = valores[0];

        var divisao = new DivisaoTransacao
        {
            UsuarioId = usuarioId,
            UsuarioCriadorId = usuarioId,
            TransacaoOrigemId = transacao.Id,
            ValorTotal = valorTotal,
            Status = DivisaoTransacaoStatus.Pendente,
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
            Valor = valores[0],
            Status = DivisaoTransacaoParticipanteStatus.Aceito,
            RespondidoEm = agora,
            VersaoAceita = 1,
            VersaoConvite = 1,
            Ativo = true
        });
        divisao.Participantes.Add(new DivisaoTransacaoParticipante
        {
            UsuarioId = convidado.Id,
            ParticipanteUsuarioId = convidado.Id,
            TipoParticipante = TipoParticipanteDivisao.UsuarioSistema,
            Percentual = request.PercentualConvidado,
            Valor = valores[1],
            Status = DivisaoTransacaoParticipanteStatus.Pendente,
            ExpiraEm = DivisaoTransacaoRules.CalcularExpiracaoConvite(transacao.DataOcorrencia, agora),
            VersaoConvite = 1,
            Ativo = true
        });
        DivisaoTransacaoRules.ValidarParticipantes(valorTotal, divisao.Participantes.ToList());

        _dbContext.DivisoesTransacoes.Add(divisao);
        await SalvarContatoSeSolicitadoAsync(
            usuarioId,
            convidado.Id,
            request.SalvarContato,
            request.ApelidoContato,
            agora,
            cancellationToken);
        CriarNotificacao(
            convidado.Id,
            TipoNotificacao.DivisaoRecebida,
            "Convite de divisão recebido",
            $"{transacao.Descricao}: {valores[1]:C} aguardando sua resposta.",
            divisao,
            "ResponderDivisao",
            divisao.VersaoAtual);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
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
            return Mapear(participante.DivisaoTransacao);
        }

        if (participante.Status != DivisaoTransacaoParticipanteStatus.Pendente ||
            participante.VersaoConvite != participante.DivisaoTransacao.VersaoAtual)
        {
            throw new InvalidOperationException("Convite não está pendente na versão atual.");
        }

        await ValidarClassificacaoAsync(usuarioId, request, cancellationToken);
        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var transacaoOrigem = await ObterTransacaoOrigemAsync(participante.DivisaoTransacao, cancellationToken);
        var codigo = await ObterProximoCodigoExibicaoAsync(usuarioId, cancellationToken);
        var transacaoGerada = new Transacao
        {
            UsuarioId = usuarioId,
            CodigoExibicao = codigo,
            Tipo = TipoTransacao.Despesa,
            Descricao = $"Parte compartilhada - {transacaoOrigem?.Descricao ?? "divisão"}",
            Valor = participante.Valor,
            DataOcorrencia = transacaoOrigem?.DataOcorrencia ?? DateOnly.FromDateTime(DateTime.Today),
            CategoriaId = request?.CategoriaId,
            ContaBancariaId = request?.ContaBancariaId,
            CartaoCreditoId = request?.CartaoCreditoId,
            FormaPagamento = request?.CartaoCreditoId.HasValue == true ? "Cartão de crédito" : "Divisão compartilhada",
            IsFixa = false,
            IsPaga = false,
            OrigemTransacao = OrigemTransacao.Lancamento
        };

        _dbContext.Transacoes.Add(transacaoGerada);
        participante.Status = DivisaoTransacaoParticipanteStatus.Aceito;
        participante.RespondidoEm = DateTimeOffset.UtcNow;
        participante.VersaoAceita = participante.DivisaoTransacao.VersaoAtual;
        participante.TransacaoGerada = transacaoGerada;
        participante.DivisaoTransacao.Status = ObterStatusAposAceite(participante.DivisaoTransacao);
        participante.DivisaoTransacao.AtualizadoEm = DateTimeOffset.UtcNow;
        await CriarOuAtualizarPendenciaReembolsoAsync(
            participante.DivisaoTransacao,
            participante,
            cancellationToken);
        ResolverNotificacoesPendentes(usuarioId, participante.DivisaoTransacao.Id, TipoNotificacao.DivisaoRecebida);
        CriarNotificacao(
            participante.DivisaoTransacao.UsuarioCriadorId,
            TipoNotificacao.DivisaoAceita,
            "Divisão aceita",
            "Um convite de divisão foi aceito.",
            participante.DivisaoTransacao,
            null,
            participante.DivisaoTransacao.VersaoAtual);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
        return Mapear(participante.DivisaoTransacao);
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
        participante.DivisaoTransacao.Status = DivisaoTransacaoStatus.RecusadaAguardandoDecisao;
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
            participante.DivisaoTransacao.VersaoAtual);

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(participante.DivisaoTransacao);
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

        var recusados = divisao.Participantes
            .Where(participante =>
                participante.Ativo &&
                participante.Status is DivisaoTransacaoParticipanteStatus.Recusado or DivisaoTransacaoParticipanteStatus.Expirado)
            .ToList();
        if (recusados.Count == 0)
        {
            throw new InvalidOperationException("Não há valor recusado ou expirado para assumir.");
        }

        var criador = ObterParticipanteCriador(divisao);
        criador.Valor += recusados.Sum(participante => participante.Valor);
        criador.Percentual += recusados.Sum(participante => participante.Percentual);
        foreach (var participante in recusados)
        {
            participante.Ativo = false;
        }

        var transacaoOrigem = await ObterTransacaoOrigemAsync(divisao, cancellationToken);
        if (transacaoOrigem is not null)
        {
            transacaoOrigem.Valor = criador.Valor;
            transacaoOrigem.PercentualDivisao = criador.Percentual;
            transacaoOrigem.ValorTotalOriginal = divisao.ValorTotal;
        }

        divisao.Status = DivisaoTransacaoStatus.Aceita;
        divisao.EncerradoEm = DateTimeOffset.UtcNow;
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
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

        var anterior = divisao.Participantes
            .Where(participante =>
                participante.TipoParticipante == TipoParticipanteDivisao.UsuarioSistema &&
                participante.Status is DivisaoTransacaoParticipanteStatus.Recusado or DivisaoTransacaoParticipanteStatus.Expirado)
            .OrderByDescending(participante => participante.VersaoConvite)
            .FirstOrDefault();
        if (anterior?.ParticipanteUsuarioId is null)
        {
            throw new InvalidOperationException("Não há convidado elegível para reenviar.");
        }

        var percentualConvidado = request.PercentualConvidado ?? anterior.Percentual;
        var percentualCriador = 100m - percentualConvidado;
        var valores = DivisaoTransacaoRules.CalcularValores(divisao.ValorTotal, [percentualCriador, percentualConvidado]);
        var criador = ObterParticipanteCriador(divisao);
        criador.Percentual = percentualCriador;
        criador.Valor = valores[0];
        anterior.Ativo = false;

        divisao.VersaoAtual++;
        divisao.QuantidadeReenvios++;
        divisao.Status = DivisaoTransacaoStatus.Pendente;
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;
        divisao.Participantes.Add(new DivisaoTransacaoParticipante
        {
            UsuarioId = anterior.ParticipanteUsuarioId.Value,
            ParticipanteUsuarioId = anterior.ParticipanteUsuarioId.Value,
            TipoParticipante = TipoParticipanteDivisao.UsuarioSistema,
            Percentual = percentualConvidado,
            Valor = valores[1],
            Status = DivisaoTransacaoParticipanteStatus.Pendente,
            ExpiraEm = DivisaoTransacaoRules.CalcularExpiracaoConvite(
                (await ObterTransacaoOrigemAsync(divisao, cancellationToken))?.DataOcorrencia ??
                    DateOnly.FromDateTime(DateTime.Today),
                DateTimeOffset.UtcNow),
            VersaoConvite = divisao.VersaoAtual,
            Ativo = true
        });

        CriarNotificacao(
            anterior.ParticipanteUsuarioId.Value,
            TipoNotificacao.DivisaoRecebida,
            "Convite de divisão reenviado",
            $"Uma divisão foi reenviada para sua resposta: {valores[1]:C}.",
            divisao,
            "ResponderDivisao",
            divisao.VersaoAtual);

        await _dbContext.SaveChangesAsync(cancellationToken);
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

        divisao.Status = DivisaoTransacaoStatus.Cancelada;
        divisao.EncerradoEm = DateTimeOffset.UtcNow;
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;
        foreach (var participante in divisao.Participantes.Where(participante => participante.Ativo))
        {
            participante.Status = DivisaoTransacaoParticipanteStatus.Cancelado;
            participante.Ativo = false;
        }

        var transacaoOrigem = await ObterTransacaoOrigemAsync(divisao, cancellationToken);
        if (divisao.Status != DivisaoTransacaoStatus.Aceita &&
            transacaoOrigem is not null &&
            !transacaoOrigem.IsPaga)
        {
            _dbContext.Transacoes.Remove(transacaoOrigem);
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
        var criador = ObterParticipanteCriador(divisao);
        var participante = ObterParticipanteConvidadoAtivo(divisao);
        var valorTotalProposto = request.ValorTotal ?? divisao.ValorTotal;
        var percentualParticipanteProposto = request.PercentualConvidado ?? participante.Percentual;
        var percentualCriadorProposto = 100m - percentualParticipanteProposto;
        var valoresPropostos = DivisaoTransacaoRules.CalcularValores(
            valorTotalProposto,
            [percentualCriadorProposto, percentualParticipanteProposto]);
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
            PercentualCriadorProposto = percentualCriadorProposto,
            ValorCriadorAnterior = criador.Valor,
            ValorCriadorProposto = valoresPropostos[0],
            PercentualParticipanteAnterior = participante.Percentual,
            PercentualParticipanteProposto = percentualParticipanteProposto,
            ValorParticipanteAnterior = participante.Valor,
            ValorParticipanteProposto = valoresPropostos[1],
            VencimentoAnterior = transacaoOrigem?.DataOcorrencia,
            VencimentoProposto = request.Vencimento ?? transacaoOrigem?.DataOcorrencia,
            QuantidadeParcelasAnterior = divisao.CompraParcelada?.QuantidadeParcelas,
            QuantidadeParcelasProposta = request.QuantidadeParcelas ?? divisao.CompraParcelada?.QuantidadeParcelas,
            RecorrenciaAnterior = transacaoOrigem?.IsFixa == true ? "Fixa" : null,
            RecorrenciaProposta = NormalizarTexto(request.Recorrencia) ?? (transacaoOrigem?.IsFixa == true ? "Fixa" : null),
            FrequenciaAnterior = null,
            FrequenciaProposta = NormalizarTexto(request.Frequencia),
            ResponsabilidadeAnterior = "Participante",
            ResponsabilidadeProposta = NormalizarTexto(request.ResponsabilidadeParticipante) ?? "Participante",
            CriadoEm = DateTimeOffset.UtcNow
        };

        divisao.Versoes.Add(versao);
        divisao.Status = DivisaoTransacaoStatus.AlteracaoPendente;
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;
        CriarNotificacao(
            participante.ParticipanteUsuarioId!.Value,
            TipoNotificacao.DivisaoAlterada,
            "Alteração de divisão recebida",
            $"Uma alteração de divisão foi proposta: sua parte passaria de {participante.Valor:C} para {versao.ValorParticipanteProposto:C}.",
            divisao,
            "ResponderAlteracaoDivisao",
            versao.Versao);

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

        var participante = ObterParticipanteConvidadoAtivo(versao.DivisaoTransacao);
        if (participante.ParticipanteUsuarioId != usuarioId || participante.UsuarioId != usuarioId)
        {
            throw new InvalidOperationException("Alteração não pertence ao usuário autenticado.");
        }

        if (versao.Status != DivisaoTransacaoVersaoStatus.PropostaPendente)
        {
            throw new InvalidOperationException("Alteração não está pendente.");
        }

        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var divisao = versao.DivisaoTransacao;
        var criador = ObterParticipanteCriador(divisao);
        var transacaoOrigem = await ObterTransacaoOrigemAsync(divisao, cancellationToken);
        var transacaoGerada = participante.TransacaoGeradaId.HasValue
            ? await _dbContext.Transacoes
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(
                    transacao => transacao.Id == participante.TransacaoGeradaId.Value,
                    cancellationToken)
            : null;

        divisao.ValorTotal = versao.ValorTotalProposto;
        divisao.VersaoAtual = versao.Versao;
        divisao.Status = DivisaoTransacaoStatus.Aceita;
        divisao.AtualizadoEm = DateTimeOffset.UtcNow;
        criador.Percentual = versao.PercentualCriadorProposto;
        criador.Valor = versao.ValorCriadorProposto;
        criador.VersaoAceita = versao.Versao;
        participante.Percentual = versao.PercentualParticipanteProposto;
        participante.Valor = versao.ValorParticipanteProposto;
        participante.VersaoAceita = versao.Versao;
        participante.VersaoConvite = versao.Versao;
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

        if (transacaoGerada is not null && DeveAtualizarOcorrencia(transacaoGerada, versao.Escopo))
        {
            transacaoGerada.Valor = versao.ValorParticipanteProposto;
            if (versao.VencimentoProposto.HasValue)
            {
                transacaoGerada.DataOcorrencia = versao.VencimentoProposto.Value;
            }
        }

        await CriarOuAtualizarPendenciaReembolsoAsync(divisao, participante, cancellationToken);

        versao.Status = DivisaoTransacaoVersaoStatus.Aceita;
        versao.UsuarioRespondenteId = usuarioId;
        versao.RespondidoEm = DateTimeOffset.UtcNow;
        ResolverNotificacoesPendentes(usuarioId, divisao.Id, TipoNotificacao.DivisaoAlterada);
        CriarNotificacao(
            divisao.UsuarioCriadorId,
            TipoNotificacao.AlteracaoDivisaoAceita,
            "Alteração de divisão aceita",
            "Uma alteração de divisão foi aceita pelo participante.",
            divisao,
            null,
            versao.Versao);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
        return Mapear(divisao);
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

        var participante = ObterParticipanteConvidadoAtivo(versao.DivisaoTransacao);
        if (participante.ParticipanteUsuarioId != usuarioId || participante.UsuarioId != usuarioId)
        {
            throw new InvalidOperationException("Alteração não pertence ao usuário autenticado.");
        }

        if (versao.Status != DivisaoTransacaoVersaoStatus.PropostaPendente)
        {
            throw new InvalidOperationException("Alteração não está pendente.");
        }

        versao.Status = DivisaoTransacaoVersaoStatus.Recusada;
        versao.UsuarioRespondenteId = usuarioId;
        versao.RespondidoEm = DateTimeOffset.UtcNow;
        versao.MotivoResposta = NormalizarTexto(request.Motivo);
        versao.DivisaoTransacao.Status = DivisaoTransacaoStatus.Aceita;
        versao.DivisaoTransacao.AtualizadoEm = DateTimeOffset.UtcNow;
        ResolverNotificacoesPendentes(usuarioId, versao.DivisaoTransacao.Id, TipoNotificacao.DivisaoAlterada);
        CriarNotificacao(
            versao.DivisaoTransacao.UsuarioCriadorId,
            TipoNotificacao.AlteracaoDivisaoRecusada,
            "Alteração de divisão recusada",
            "Uma alteração de divisão foi recusada pelo participante.",
            versao.DivisaoTransacao,
            "DecidirAlteracaoDivisao",
            versao.Versao);

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(versao.DivisaoTransacao);
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
            participante.DivisaoTransacao.Status = DivisaoTransacaoStatus.Expirada;
            participante.DivisaoTransacao.AtualizadoEm = agora;
            CriarNotificacao(
                participante.DivisaoTransacao.UsuarioCriadorId,
                TipoNotificacao.DivisaoExpirada,
                "Convite de divisão expirado",
                $"Um convite de divisão expirou: {participante.Valor:C} ({participante.Percentual}%).",
                participante.DivisaoTransacao,
                "DecidirRecusaDivisao",
                participante.DivisaoTransacao.VersaoAtual);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return participantes.Count;
    }

    private async Task<Usuario> ResolverUsuarioConvidadoAsync(
        Guid usuarioId,
        string email,
        CancellationToken cancellationToken)
    {
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
            .Include(divisao => divisao.CompraParcelada)
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
            .SingleOrDefaultAsync(versao => versao.Id == versaoId, cancellationToken);
    }

    private async Task<Transacao?> ObterTransacaoOrigemAsync(
        DivisaoTransacao divisao,
        CancellationToken cancellationToken)
    {
        return divisao.TransacaoOrigemId.HasValue
            ? await _dbContext.Transacoes
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(
                    transacao => transacao.Id == divisao.TransacaoOrigemId.Value,
                    cancellationToken)
            : null;
    }

    private async Task CriarOuAtualizarPendenciaReembolsoAsync(
        DivisaoTransacao divisao,
        DivisaoTransacaoParticipante participante,
        CancellationToken cancellationToken)
    {
        if (!participante.ParticipanteUsuarioId.HasValue &&
            string.IsNullOrWhiteSpace(participante.MotivoResposta))
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
                ParticipanteExternoNome = participante.ParticipanteUsuarioId.HasValue ? null : "Participante externo",
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

    private static DivisaoTransacaoParticipante ObterParticipanteCriador(DivisaoTransacao divisao)
    {
        return divisao.Participantes.Single(participante =>
            participante.Ativo &&
            participante.TipoParticipante == TipoParticipanteDivisao.Criador);
    }

    private static DivisaoTransacaoParticipante ObterParticipanteConvidadoAtivo(DivisaoTransacao divisao)
    {
        return divisao.Participantes.Single(participante =>
            participante.Ativo &&
            participante.TipoParticipante != TipoParticipanteDivisao.Criador &&
            participante.ParticipanteUsuarioId.HasValue);
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

    private static DivisaoTransacaoStatus ObterStatusAposAceite(DivisaoTransacao divisao)
    {
        var ativos = divisao.Participantes.Where(participante => participante.Ativo).ToList();
        return ativos
            .Where(participante => participante.TipoParticipante != TipoParticipanteDivisao.Criador)
            .All(participante => participante.Status == DivisaoTransacaoParticipanteStatus.Aceito)
                ? DivisaoTransacaoStatus.Aceita
                : DivisaoTransacaoStatus.ParcialmenteAceita;
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
        int? versao)
    {
        var existe = _dbContext.Notificacoes.Local
            .Any(notificacao =>
                notificacao.UsuarioId == usuarioId &&
                notificacao.TipoNotificacao == tipo &&
                notificacao.Entidade == EntidadeDivisao &&
                notificacao.EntidadeId == divisao.Id &&
                notificacao.Versao == versao &&
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
            Versao = versao
        });
    }

    private void ResolverNotificacoesPendentes(Guid usuarioId, Guid divisaoId, TipoNotificacao tipo)
    {
        foreach (var notificacao in _dbContext.Notificacoes
            .IgnoreQueryFilters()
            .Where(notificacao =>
                notificacao.UsuarioId == usuarioId &&
                notificacao.TipoNotificacao == tipo &&
                notificacao.Entidade == EntidadeDivisao &&
                notificacao.EntidadeId == divisaoId &&
                !notificacao.Lida))
        {
            notificacao.Lida = true;
            notificacao.AcaoPendente = null;
        }
    }

    private static DivisaoTransacaoResponse Mapear(DivisaoTransacao divisao)
    {
        return new DivisaoTransacaoResponse
        {
            Id = divisao.Id,
            UsuarioCriadorId = divisao.UsuarioCriadorId,
            TransacaoOrigemId = divisao.TransacaoOrigemId,
            ValorTotal = divisao.ValorTotal,
            Status = divisao.Status,
            VersaoAtual = divisao.VersaoAtual,
            QuantidadeReenvios = divisao.QuantidadeReenvios,
            CriadoEm = divisao.CriadoEm,
            AtualizadoEm = divisao.AtualizadoEm,
            Participantes = divisao.Participantes
                .OrderBy(participante => participante.TipoParticipante)
                .ThenBy(participante => participante.VersaoConvite)
                .Select(participante => new DivisaoParticipanteResponse
                {
                    Id = participante.Id,
                    ParticipanteUsuarioId = participante.ParticipanteUsuarioId,
                    TipoParticipante = participante.TipoParticipante,
                    Percentual = participante.Percentual,
                    Valor = participante.Valor,
                    Status = participante.Status,
                    VersaoConvite = participante.VersaoConvite,
                    ExpiraEm = participante.ExpiraEm,
                    TransacaoGeradaId = participante.TransacaoGeradaId,
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
                    MotivoResposta = versao.MotivoResposta
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

    private static string NormalizarEmail(string email) => email.Trim().ToLowerInvariant();

    private static string? NormalizarTexto(string? texto) =>
        string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();
}
