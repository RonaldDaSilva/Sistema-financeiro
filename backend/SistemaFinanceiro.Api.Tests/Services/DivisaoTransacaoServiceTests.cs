using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Divisoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Divisoes;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class DivisaoTransacaoServiceTests
{
    [Fact]
    public async Task ResolverConvidadoAsync_UsuarioExistente_RetornaDadosMinimosMascarados()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);

        var response = await service.ResolverConvidadoAsync(
            criador.Id,
            new ResolverConvidadoDivisaoRequest { Email = " MARIA@teste.local " });

        Assert.True(response.Encontrado);
        Assert.Equal(convidado.Id, response.Identificador);
        Assert.Equal("Maria", response.NomeExibicao);
        Assert.Equal("ma***@teste.local", response.EmailMascarado);
    }

    [Fact]
    public async Task ResolverConvidadoAsync_UsuarioInexistente_RetornaNaoEncontrado()
    {
        var (database, criador, _, _, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);

        var response = await service.ResolverConvidadoAsync(
            criador.Id,
            new ResolverConvidadoDivisaoRequest { Email = "ninguem@teste.local" });

        Assert.False(response.Encontrado);
        Assert.Null(response.Identificador);
    }

    [Fact]
    public async Task ResolverConvidadoAsync_ProprioEmail_Bloqueia()
    {
        var (database, criador, _, _, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.ResolverConvidadoAsync(
                criador.Id,
                new ResolverConvidadoDivisaoRequest { Email = criador.Email }));
    }

    [Fact]
    public async Task ResolverConvidadoAsync_RateLimit_BloqueiaAposLimite()
    {
        var (database, criador, _, _, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);

        for (var tentativa = 0; tentativa < 10; tentativa++)
        {
            await service.ResolverConvidadoAsync(
                criador.Id,
                new ResolverConvidadoDivisaoRequest { Email = $"x{tentativa}@teste.local" });
        }

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.ResolverConvidadoAsync(
                criador.Id,
                new ResolverConvidadoDivisaoRequest { Email = "extra@teste.local" }));
        Assert.Equal("RATE_LIMIT_RESOLUCAO_EMAIL", exception.Message);
    }

    [Fact]
    public async Task CriarConviteAsync_CriaAcordoParticipantesNotificacaoEContato()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);

        var divisao = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                TransacaoOrigemId = transacao.Id,
                EmailConvidado = convidado.Email,
                PercentualConvidado = 40m,
                SalvarContato = true,
                ApelidoContato = "Maria casa"
            });

        Assert.Equal(DivisaoTransacaoStatus.Pendente, divisao.Status);
        Assert.Equal(2, divisao.Participantes.Count);
        Assert.Equal(60m, transacao.PercentualDivisao);
        Assert.Equal(600m, transacao.Valor);
        Assert.Equal(1000m, transacao.ValorTotalOriginal);
        Assert.Single(database.Context.ContatosDivisao.IgnoreQueryFilters());
        Assert.Contains(database.Context.Notificacoes.IgnoreQueryFilters(), notificacao =>
            notificacao.UsuarioId == convidado.Id &&
            notificacao.TipoNotificacao == TipoNotificacao.DivisaoRecebida &&
            notificacao.AcaoPendente == "ResponderDivisao");
    }

    [Fact]
    public async Task Contatos_CriarAtualizarRemover_MantemVinculoUnilateral()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var service = new ContatoDivisaoService(database.Context);

        var contato = await service.CriarAsync(
            criador.Id,
            new CriarContatoDivisaoRequest
            {
                UsuarioContatoId = convidado.Id,
                Apelido = "M"
            });
        var atualizado = await service.AtualizarAsync(
            criador.Id,
            contato.Id,
            new AtualizarContatoDivisaoRequest { Apelido = "Maria" });
        var removido = await service.RemoverAsync(criador.Id, contato.Id);

        Assert.Equal("Maria", atualizado!.Apelido);
        Assert.True(removido);
        Assert.Empty(await service.ListarAsync(criador.Id));
        Assert.Empty(database.Context.ContatosDivisao.IgnoreQueryFilters().Where(item => item.UsuarioId == convidado.Id));
    }

    [Fact]
    public async Task AceitarAsync_CriaLancamentoPendenteNoTenantConvidado()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);

        var aceita = await service.AceitarAsync(convidado.Id, participante.Id);

        Assert.Equal(DivisaoTransacaoStatus.Aceita, aceita!.Status);
        var gerada = Assert.Single(database.Context.Transacoes.IgnoreQueryFilters()
            .Where(item => item.UsuarioId == convidado.Id));
        Assert.Equal(TipoTransacao.Despesa, gerada.Tipo);
        Assert.Equal(400m, gerada.Valor);
        Assert.False(gerada.IsPaga);
        Assert.Null(gerada.CategoriaId);
        Assert.Null(gerada.ContaBancariaId);
        Assert.Null(gerada.CartaoCreditoId);
        Assert.Contains(database.Context.Notificacoes.IgnoreQueryFilters(), notificacao =>
            notificacao.UsuarioId == criador.Id &&
            notificacao.TipoNotificacao == TipoNotificacao.DivisaoAceita);
    }

    [Fact]
    public async Task AceitarAsync_Duplicado_NaoCriaSegundoLancamento()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);

        await service.AceitarAsync(convidado.Id, participante.Id);
        await service.AceitarAsync(convidado.Id, participante.Id);

        Assert.Single(database.Context.Transacoes.IgnoreQueryFilters()
            .Where(item => item.UsuarioId == convidado.Id));
    }

    [Fact]
    public async Task AceitarAsync_DeOutroUsuario_Bloqueia()
    {
        var (database, criador, convidado, transacao, outro) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.AceitarAsync(outro.Id, participante.Id));
    }

    [Fact]
    public async Task AceitarEClassificarAsync_IdsDeOutroTenant_BloqueiaCategoriaContaECartao()
    {
        var (database, criador, convidado, transacao, outro) = await CriarCenarioAsync();
        var categoriaOutro = new Categoria
        {
            UsuarioId = outro.Id,
            Nome = "Outro",
            CorHexa = "#000000"
        };
        var contaOutro = new ContaBancaria
        {
            UsuarioId = outro.Id,
            NomeCustomizado = "Conta outro",
            CodigoBanco = "001",
            SaldoInicial = 0m
        };
        var cartaoOutro = new CartaoCredito
        {
            UsuarioId = outro.Id,
            ApelidoCartao = "Cartao outro",
            Banco = "Banco",
            LimiteTotal = 1000m,
            DiaVencimento = 10,
            MelhorDiaCompra = 5
        };
        database.Context.AddRange(categoriaOutro, contaOutro, cartaoOutro);
        await database.Context.SaveChangesAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.AceitarAsync(
                convidado.Id,
                participante.Id,
                new ClassificarAceiteDivisaoRequest { CategoriaId = categoriaOutro.Id }));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.AceitarAsync(
                convidado.Id,
                participante.Id,
                new ClassificarAceiteDivisaoRequest { ContaBancariaId = contaOutro.Id }));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.AceitarAsync(
                convidado.Id,
                participante.Id,
                new ClassificarAceiteDivisaoRequest { CartaoCreditoId = cartaoOutro.Id }));
    }

    [Fact]
    public async Task RecusarAsync_NotificaCriadorESemLancamentoNoConvidado()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);

        var recusada = await service.RecusarAsync(
            convidado.Id,
            participante.Id,
            new RecusarDivisaoRequest { Motivo = "Nao reconheco" });

        Assert.Equal(DivisaoTransacaoStatus.RecusadaAguardandoDecisao, recusada!.Status);
        Assert.Empty(database.Context.Transacoes.IgnoreQueryFilters().Where(item => item.UsuarioId == convidado.Id));
        Assert.Contains(database.Context.Notificacoes.IgnoreQueryFilters(), notificacao =>
            notificacao.UsuarioId == criador.Id &&
            notificacao.TipoNotificacao == TipoNotificacao.DivisaoRecusada &&
            notificacao.AcaoPendente == "DecidirRecusaDivisao");
    }

    [Fact]
    public async Task AssumirValorAsync_IncorporaParteRecusadaAoCriador()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        await service.RecusarAsync(convidado.Id, participante.Id, new RecusarDivisaoRequest());

        var assumida = await service.AssumirValorAsync(criador.Id, divisao.Id);

        var criadorParte = assumida!.Participantes.Single(item => item.TipoParticipante == TipoParticipanteDivisao.Criador);
        Assert.Equal(100m, criadorParte.Percentual);
        Assert.Equal(1000m, criadorParte.Valor);
        Assert.Equal(1000m, transacao.Valor);
        Assert.Equal(DivisaoTransacaoStatus.Aceita, assumida.Status);
    }

    [Fact]
    public async Task ReenviarAsync_PreservaHistoricoECriaNovaVersao()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        await service.RecusarAsync(convidado.Id, participante.Id, new RecusarDivisaoRequest());

        var reenviada = await service.ReenviarAsync(criador.Id, divisao.Id, new ReenviarDivisaoRequest());

        Assert.Equal(2, reenviada!.VersaoAtual);
        Assert.Equal(1, reenviada.QuantidadeReenvios);
        Assert.Equal(3, reenviada.Participantes.Count);
        Assert.Contains(reenviada.Participantes, item =>
            item.Status == DivisaoTransacaoParticipanteStatus.Recusado &&
            !item.Ativo);
        Assert.Contains(reenviada.Participantes, item =>
            item.Status == DivisaoTransacaoParticipanteStatus.Pendente &&
            item.Ativo &&
            item.VersaoConvite == 2);
    }

    [Fact]
    public async Task ProporAlteracaoAsync_MantemVersaoAnteriorVigente()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);

        var alterada = await service.ProporAlteracaoAsync(
            criador.Id,
            divisao.Id,
            new ProporAlteracaoDivisaoRequest
            {
                ValorTotal = 1200m,
                PercentualConvidado = 25m
            });

        Assert.Equal(DivisaoTransacaoStatus.AlteracaoPendente, alterada!.Status);
        Assert.Equal(1, alterada.VersaoAtual);
        Assert.Equal(600m, transacao.Valor);
        Assert.Equal(400m, database.Context.Transacoes.IgnoreQueryFilters().Single(item => item.UsuarioId == convidado.Id).Valor);
        var proposta = Assert.Single(alterada.Versoes);
        Assert.Equal(2, proposta.Versao);
        Assert.Equal(DivisaoTransacaoVersaoStatus.PropostaPendente, proposta.Status);
        Assert.Equal(1000m, proposta.ValorTotalAnterior);
        Assert.Equal(1200m, proposta.ValorTotalProposto);
        Assert.Equal(400m, proposta.ValorParticipanteAnterior);
        Assert.Equal(300m, proposta.ValorParticipanteProposto);
    }

    [Fact]
    public async Task AceitarAlteracaoAsync_SubstituiVersaoVigenteEAtualizaLancamentoPendente()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var novoVencimento = transacao.DataOcorrencia.AddDays(5);
        var alterada = await service.ProporAlteracaoAsync(
            criador.Id,
            divisao.Id,
            new ProporAlteracaoDivisaoRequest
            {
                ValorTotal = 1200m,
                PercentualConvidado = 25m,
                Vencimento = novoVencimento
            });
        var proposta = alterada!.Versoes.Single();

        var aceita = await service.AceitarAlteracaoAsync(convidado.Id, proposta.Id);

        Assert.Equal(DivisaoTransacaoStatus.Aceita, aceita!.Status);
        Assert.Equal(2, aceita.VersaoAtual);
        Assert.Equal(1200m, aceita.ValorTotal);
        Assert.Equal(900m, aceita.Participantes.Single(item => item.TipoParticipante == TipoParticipanteDivisao.Criador).Valor);
        Assert.Equal(300m, aceita.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id).Valor);
        Assert.Equal(900m, transacao.Valor);
        Assert.Equal(novoVencimento, transacao.DataOcorrencia);
        var gerada = database.Context.Transacoes.IgnoreQueryFilters().Single(item => item.UsuarioId == convidado.Id);
        Assert.Equal(300m, gerada.Valor);
        Assert.Equal(novoVencimento, gerada.DataOcorrencia);
        Assert.Equal(DivisaoTransacaoVersaoStatus.Aceita, aceita.Versoes.Single().Status);
    }

    [Fact]
    public async Task RecusarAlteracaoAsync_PreservaVersaoAnteriorENotificaCriador()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var alterada = await service.ProporAlteracaoAsync(
            criador.Id,
            divisao.Id,
            new ProporAlteracaoDivisaoRequest
            {
                ValorTotal = 1200m,
                PercentualConvidado = 25m
            });
        var proposta = alterada!.Versoes.Single();

        var recusada = await service.RecusarAlteracaoAsync(
            convidado.Id,
            proposta.Id,
            new ResponderAlteracaoDivisaoRequest { Motivo = "Prefiro manter o combinado" });

        Assert.Equal(DivisaoTransacaoStatus.Aceita, recusada!.Status);
        Assert.Equal(1, recusada.VersaoAtual);
        Assert.Equal(600m, transacao.Valor);
        Assert.Equal(400m, database.Context.Transacoes.IgnoreQueryFilters().Single(item => item.UsuarioId == convidado.Id).Valor);
        Assert.Equal(DivisaoTransacaoVersaoStatus.Recusada, recusada.Versoes.Single().Status);
        Assert.Contains(database.Context.Notificacoes.IgnoreQueryFilters(), notificacao =>
            notificacao.UsuarioId == criador.Id &&
            notificacao.TipoNotificacao == TipoNotificacao.AlteracaoDivisaoRecusada &&
            notificacao.AcaoPendente == "DecidirAlteracaoDivisao");
    }

    [Fact]
    public async Task ManterVersaoAnteriorAsync_EncerraDecisaoDaAlteracaoRecusada()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var alterada = await service.ProporAlteracaoAsync(
            criador.Id,
            divisao.Id,
            new ProporAlteracaoDivisaoRequest { ValorTotal = 1200m });
        var proposta = alterada!.Versoes.Single();
        await service.RecusarAlteracaoAsync(convidado.Id, proposta.Id, new ResponderAlteracaoDivisaoRequest());

        var mantida = await service.ManterVersaoAnteriorAsync(criador.Id, proposta.Id);

        Assert.Equal(DivisaoTransacaoStatus.Aceita, mantida!.Status);
        Assert.Equal(1, mantida.VersaoAtual);
        Assert.Equal(1000m, mantida.ValorTotal);
    }

    [Fact]
    public async Task ReenviarAlteracaoAsync_CriaNovaPropostaPreservandoHistorico()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var alterada = await service.ProporAlteracaoAsync(
            criador.Id,
            divisao.Id,
            new ProporAlteracaoDivisaoRequest { ValorTotal = 1200m, PercentualConvidado = 25m });
        var proposta = alterada!.Versoes.Single();
        await service.RecusarAlteracaoAsync(convidado.Id, proposta.Id, new ResponderAlteracaoDivisaoRequest());

        var reenviada = await service.ReenviarAlteracaoAsync(
            criador.Id,
            proposta.Id,
            new ReenviarAlteracaoDivisaoRequest
            {
                ValorTotal = 1300m,
                PercentualConvidado = 30m,
                Escopo = "EstaEProximas"
            });

        Assert.Equal(DivisaoTransacaoStatus.AlteracaoPendente, reenviada!.Status);
        Assert.Equal(2, reenviada.Versoes.Count);
        Assert.Contains(reenviada.Versoes, item => item.Status == DivisaoTransacaoVersaoStatus.Recusada);
        Assert.Contains(reenviada.Versoes, item =>
            item.Status == DivisaoTransacaoVersaoStatus.PropostaPendente &&
            item.ValorTotalProposto == 1300m &&
            item.Escopo == "EstaEProximas");
    }

    [Fact]
    public async Task ProporAlteracaoAsync_RegistraEscopoSerieParcelaResponsabilidadeNoHistorico()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);

        var alterada = await service.ProporAlteracaoAsync(
            criador.Id,
            divisao.Id,
            new ProporAlteracaoDivisaoRequest
            {
                Escopo = "TodaSerie",
                QuantidadeParcelas = 6,
                Recorrencia = "Mensal",
                Frequencia = "Mensal",
                ResponsabilidadeParticipante = "Participante responde pelas proximas ocorrencias"
            });

        var historico = alterada!.Versoes.Single();
        Assert.Equal("TodaSerie", historico.Escopo);
        Assert.Equal(6, historico.QuantidadeParcelasProposta);
        Assert.Equal("Mensal", historico.RecorrenciaProposta);
        Assert.Equal("Mensal", historico.FrequenciaProposta);
        Assert.Equal("Participante responde pelas proximas ocorrencias", historico.ResponsabilidadeProposta);
    }

    [Fact]
    public async Task AceitarAlteracaoAsync_PreservaOcorrenciaPassadaRealizada()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        transacao.IsPaga = true;
        transacao.DataOcorrencia = DateOnly.FromDateTime(DateTime.Today).AddDays(-10);
        var gerada = database.Context.Transacoes.IgnoreQueryFilters().Single(item => item.UsuarioId == convidado.Id);
        gerada.IsPaga = true;
        gerada.DataOcorrencia = transacao.DataOcorrencia;
        await database.Context.SaveChangesAsync();
        var alterada = await service.ProporAlteracaoAsync(
            criador.Id,
            divisao.Id,
            new ProporAlteracaoDivisaoRequest
            {
                ValorTotal = 1200m,
                PercentualConvidado = 25m,
                Escopo = "EstaEProximas"
            });
        var proposta = alterada!.Versoes.Single();

        var aceita = await service.AceitarAlteracaoAsync(convidado.Id, proposta.Id);

        Assert.Equal(2, aceita!.VersaoAtual);
        Assert.Equal(600m, transacao.Valor);
        Assert.Equal(400m, gerada.Valor);
    }

    [Fact]
    public async Task ExcluirAsync_AposAceite_PreservaMovimentacaoRealizadaENotificaConvidado()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        transacao.IsPaga = true;
        var gerada = database.Context.Transacoes.IgnoreQueryFilters().Single(item => item.UsuarioId == convidado.Id);
        gerada.IsPaga = true;
        await database.Context.SaveChangesAsync();

        var excluida = await service.ExcluirAsync(
            criador.Id,
            divisao.Id,
            new ExcluirDivisaoRequest { Escopo = "EstaOcorrencia" });

        Assert.True(excluida);
        Assert.Contains(database.Context.Transacoes.IgnoreQueryFilters(), item => item.Id == transacao.Id);
        Assert.Contains(database.Context.Transacoes.IgnoreQueryFilters(), item => item.Id == gerada.Id);
        Assert.Equal(DivisaoTransacaoStatus.Cancelada, database.Context.DivisoesTransacoes.IgnoreQueryFilters().Single().Status);
        Assert.Contains(database.Context.Notificacoes.IgnoreQueryFilters(), notificacao =>
            notificacao.UsuarioId == convidado.Id &&
            notificacao.TipoNotificacao == TipoNotificacao.DivisaoCancelada);
    }

    [Fact]
    public async Task ExcluirAsync_CancelaDivisaoETransacaoAvulsaPendente()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);

        var excluida = await service.ExcluirAsync(
            criador.Id,
            divisao.Id,
            new ExcluirDivisaoRequest { Escopo = "EstaOcorrencia" });

        Assert.True(excluida);
        Assert.Empty(database.Context.Transacoes.IgnoreQueryFilters().Where(item => item.Id == transacao.Id));
        Assert.Equal(DivisaoTransacaoStatus.Cancelada, database.Context.DivisoesTransacoes.IgnoreQueryFilters().Single().Status);
    }

    [Fact]
    public async Task ProcessarExpiracoesAsync_MarcaExpiradoENotificaCriador()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);
        var participante = database.Context.DivisoesTransacoesParticipantes
            .IgnoreQueryFilters()
            .Single(item => item.DivisaoTransacaoId == divisao.Id && item.ParticipanteUsuarioId == convidado.Id);
        participante.ExpiraEm = DateTimeOffset.UtcNow.AddMinutes(-1);
        await database.Context.SaveChangesAsync();

        var expirados = await service.ProcessarExpiracoesAsync(DateTimeOffset.UtcNow);

        Assert.Equal(1, expirados);
        Assert.Equal(DivisaoTransacaoStatus.Expirada, database.Context.DivisoesTransacoes.IgnoreQueryFilters().Single().Status);
        Assert.Contains(database.Context.Notificacoes.IgnoreQueryFilters(), notificacao =>
            notificacao.UsuarioId == criador.Id &&
            notificacao.TipoNotificacao == TipoNotificacao.DivisaoExpirada);
    }

    private static async Task<DivisaoTransacaoResponse> CriarConvitePadraoAsync(
        DivisaoTransacaoService service,
        Usuario criador,
        Usuario convidado,
        Transacao transacao)
    {
        return await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                TransacaoOrigemId = transacao.Id,
                EmailConvidado = convidado.Email,
                PercentualConvidado = 40m
            });
    }

    private static async Task<DivisaoTransacaoResponse> CriarDivisaoAceitaPadraoAsync(
        DivisaoTransacaoService service,
        Usuario criador,
        Usuario convidado,
        Transacao transacao)
    {
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        return await service.AceitarAsync(convidado.Id, participante.Id) ??
            throw new InvalidOperationException("Divisão aceita não foi criada no teste.");
    }

    private static async Task<(SqliteTestDatabase Database, Usuario Criador, Usuario Convidado, Transacao Transacao, Usuario Outro)>
        CriarCenarioAsync()
    {
        var criador = new Usuario
        {
            Id = Guid.NewGuid(),
            Nome = "Ronald",
            Email = "ronald@teste.local",
            SenhaHash = "hash"
        };
        var convidado = new Usuario
        {
            Id = Guid.NewGuid(),
            Nome = "Maria",
            Email = "maria@teste.local",
            SenhaHash = "hash"
        };
        var outro = new Usuario
        {
            Id = Guid.NewGuid(),
            Nome = "Outro",
            Email = "outro@teste.local",
            SenhaHash = "hash"
        };
        var database = new SqliteTestDatabase(criador.Id);
        var transacao = new Transacao
        {
            UsuarioId = criador.Id,
            CodigoExibicao = 1,
            Tipo = TipoTransacao.Despesa,
            Descricao = "Mercado compartilhado",
            Valor = 1000m,
            DataOcorrencia = DateOnly.FromDateTime(DateTime.Today).AddDays(1),
            FormaPagamento = "Pix",
            IsPaga = false
        };

        database.Context.Usuarios.AddRange(criador, convidado, outro);
        database.Context.Transacoes.Add(transacao);
        await database.Context.SaveChangesAsync();
        return (database, criador, convidado, transacao, outro);
    }
}
