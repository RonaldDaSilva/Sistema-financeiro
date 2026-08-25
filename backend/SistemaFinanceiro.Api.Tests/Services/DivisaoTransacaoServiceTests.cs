using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.ComprasParceladas;
using SistemaFinanceiro.Api.Dtos.Divisoes;
using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.ComprasParceladas;
using SistemaFinanceiro.Api.Services.Divisoes;
using SistemaFinanceiro.Api.Services.Transacoes;
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
    public async Task CriarConviteAsync_TransacaoJaVinculada_BloqueiaDuplicidade()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        await CriarConvitePadraoAsync(service, criador, convidado, transacao);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CriarConviteAsync(
                criador.Id,
                new CriarConviteDivisaoRequest
                {
                    TransacaoOrigemId = transacao.Id,
                    EmailConvidado = convidado.Email,
                    PercentualConvidado = 40m
                }));

        Assert.Equal("Esta transação já possui uma divisão vinculada.", exception.Message);
    }

    [Fact]
    public async Task GetExtratoMensalAsync_TransacaoComDivisaoVinculada_RetornaIdentificadorDaDivisao()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var divisaoService = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(divisaoService, criador, convidado, transacao);
        var transacaoService = new TransacaoService(database.Context);

        var extrato = await transacaoService.GetExtratoMensalAsync(
            transacao.DataOcorrencia.Month,
            transacao.DataOcorrencia.Year,
            criador.Id);

        var item = Assert.Single(extrato.Itens, item => item.Id == transacao.Id);
        Assert.Equal(divisao.Id, item.DivisaoTransacaoId);
        Assert.Equal(DivisaoTransacaoStatus.Pendente, item.StatusDivisao);
    }

    [Fact]
    public async Task CriarConviteAsync_UsuarioEExterno_CriaParticipantesEReembolsoExterno()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);

        var divisao = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                TransacaoOrigemId = transacao.Id,
                ParticipantesUsuarios =
                [
                    new CriarParticipanteUsuarioDivisaoRequest
                    {
                        Email = convidado.Email,
                        Percentual = 30m,
                        SalvarContato = true
                    }
                ],
                ParticipantesExternos =
                [
                    new CriarParticipanteExternoDivisaoRequest
                    {
                        Percentual = 10m
                    }
                ]
            });

        Assert.Equal(DivisaoTransacaoStatus.Pendente, divisao.Status);
        Assert.Equal(3, divisao.Participantes.Count);
        Assert.Equal(60m, transacao.PercentualDivisao);
        Assert.Equal(600m, transacao.Valor);
        Assert.Equal(1000m, transacao.ValorTotalOriginal);

        var externo = database.Context.DivisoesTransacoesParticipantes
            .IgnoreQueryFilters()
            .Single(item => item.DivisaoTransacaoId == divisao.Id && item.TipoParticipante == TipoParticipanteDivisao.Externo);
        Assert.Equal(criador.Id, externo.UsuarioId);
        Assert.Null(externo.ParticipanteUsuarioId);
        Assert.Equal(DivisaoTransacaoParticipanteStatus.Aceito, externo.Status);
        Assert.Equal(100m, externo.Valor);

        var reembolso = Assert.Single(database.Context.ReembolsosDivisao.IgnoreQueryFilters());
        Assert.Equal(externo.Id, reembolso.ParticipanteId);
        Assert.Null(reembolso.ParticipanteUsuarioId);
        Assert.Equal(100m, reembolso.ValorDevido);
        Assert.Equal(ReembolsoDivisaoStatus.Pendente, reembolso.Status);
        Assert.Single(database.Context.Notificacoes.IgnoreQueryFilters()
            .Where(notificacao => notificacao.TipoNotificacao == TipoNotificacao.DivisaoRecebida));
    }

    [Fact]
    public async Task CriarConviteAsync_MultiplosParticipantes_NaoPerdeCentavos()
    {
        var (database, criador, convidado, transacao, outro) = await CriarCenarioAsync();
        transacao.Valor = 100m;
        var service = new DivisaoTransacaoService(database.Context);

        var divisao = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                TransacaoOrigemId = transacao.Id,
                ParticipantesUsuarios =
                [
                    new CriarParticipanteUsuarioDivisaoRequest
                    {
                        Email = convidado.Email,
                        Percentual = 33.33m
                    },
                    new CriarParticipanteUsuarioDivisaoRequest
                    {
                        Email = outro.Email,
                        Percentual = 33.33m
                    }
                ]
            });

        var participantes = database.Context.DivisoesTransacoesParticipantes
            .IgnoreQueryFilters()
            .Where(item => item.DivisaoTransacaoId == divisao.Id && item.Ativo)
            .ToList();
        Assert.Equal(100m, participantes.Sum(item => item.Valor));
        Assert.Equal(33.34m, participantes.Single(item => item.TipoParticipante == TipoParticipanteDivisao.Criador).Valor);
        Assert.All(
            participantes.Where(item => item.TipoParticipante == TipoParticipanteDivisao.UsuarioSistema),
            participante => Assert.Equal(33.33m, participante.Valor));
        Assert.Equal(2, database.Context.Notificacoes.IgnoreQueryFilters()
            .Count(notificacao => notificacao.TipoNotificacao == TipoNotificacao.DivisaoRecebida));
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
    public async Task CriarConviteAsync_ContatoSalvo_ResolveSemExigirEmailCompleto()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var contato = await new ContatoDivisaoService(database.Context).CriarAsync(
            criador.Id,
            new CriarContatoDivisaoRequest
            {
                UsuarioContatoId = convidado.Id,
                Apelido = "Maria"
            });
        var service = new DivisaoTransacaoService(database.Context);

        var divisao = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                TransacaoOrigemId = transacao.Id,
                ParticipantesUsuarios =
                [
                    new CriarParticipanteUsuarioDivisaoRequest
                    {
                        ContatoId = contato.Id,
                        Percentual = 40m,
                        SalvarContato = true
                    }
                ]
            });

        Assert.Contains(divisao.Participantes, participante =>
            participante.ParticipanteUsuarioId == convidado.Id);
        Assert.Contains(database.Context.Notificacoes.IgnoreQueryFilters(), notificacao =>
            notificacao.UsuarioId == convidado.Id &&
            notificacao.TipoNotificacao == TipoNotificacao.DivisaoRecebida);
    }

    [Fact]
    public async Task CriarConviteAsync_ContatoIdIgnoraApelidoEnviadoNoCampoLegado()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var contato = await new ContatoDivisaoService(database.Context).CriarAsync(
            criador.Id,
            new CriarContatoDivisaoRequest
            {
                UsuarioContatoId = convidado.Id,
                Apelido = "Amor"
            });
        var service = new DivisaoTransacaoService(database.Context);

        var divisao = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                TransacaoOrigemId = transacao.Id,
                EmailConvidado = "Amor",
                ParticipantesUsuarios =
                [
                    new CriarParticipanteUsuarioDivisaoRequest
                    {
                        ContatoId = contato.Id,
                        Percentual = 40m
                    }
                ]
            });

        Assert.Equal(2, divisao.Participantes.Count);
        Assert.Contains(divisao.Participantes, participante =>
            participante.ParticipanteUsuarioId == convidado.Id);
    }

    [Fact]
    public async Task CriarConviteAsync_EmailLegadoInvalidoContinuaBloqueado()
    {
        var (database, criador, _, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);

        var erro = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CriarConviteAsync(
                criador.Id,
                new CriarConviteDivisaoRequest
                {
                    TransacaoOrigemId = transacao.Id,
                    EmailConvidado = "Amor",
                    PercentualConvidado = 40m
                }));

        Assert.Equal("Informe um e-mail válido para o convidado.", erro.Message);
    }

    [Fact]
    public void CriarConviteRequest_ComContatoId_PassaValidacaoSemEmailLegado()
    {
        var request = new CriarConviteDivisaoRequest
        {
            TransacaoOrigemId = Guid.NewGuid(),
            ParticipantesUsuarios =
            [
                new CriarParticipanteUsuarioDivisaoRequest
                {
                    ContatoId = Guid.NewGuid(),
                    Percentual = 40m
                }
            ]
        };
        var resultados = new List<ValidationResult>();

        var valido = Validator.TryValidateObject(
            request,
            new ValidationContext(request),
            resultados,
            validateAllProperties: true);

        Assert.True(valido);
        Assert.Empty(resultados);
    }

    [Fact]
    public async Task CriarConviteAsync_ContatoDeOutroUsuario_NaoPermiteAcesso()
    {
        var (database, criador, convidado, transacao, outro) = await CriarCenarioAsync();
        var contato = await new ContatoDivisaoService(database.Context).CriarAsync(
            outro.Id,
            new CriarContatoDivisaoRequest { UsuarioContatoId = convidado.Id });
        var service = new DivisaoTransacaoService(database.Context);

        var erro = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CriarConviteAsync(
                criador.Id,
                new CriarConviteDivisaoRequest
                {
                    TransacaoOrigemId = transacao.Id,
                    ParticipantesUsuarios =
                    [
                        new CriarParticipanteUsuarioDivisaoRequest
                        {
                            ContatoId = contato.Id,
                            Percentual = 40m
                        }
                    ]
                }));

        Assert.Equal("Contato convidado não encontrado.", erro.Message);
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
    public async Task ManterParteCriadorAsync_PreservaPartePessoalETotalOriginal()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await service.CriarConviteAsync(criador.Id, new CriarConviteDivisaoRequest
        {
            TransacaoOrigemId = transacao.Id,
            ParticipantesUsuarios = [new() { Email = convidado.Email, Percentual = 60m }]
        });
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        await service.RecusarAsync(convidado.Id, participante.Id, new RecusarDivisaoRequest());

        var mantida = await service.ManterParteCriadorAsync(criador.Id, participante.Id);

        var parteCriador = mantida!.Participantes.Single(item =>
            item.TipoParticipante == TipoParticipanteDivisao.Criador);
        Assert.Equal(40m, parteCriador.Percentual);
        Assert.Equal(400m, parteCriador.Valor);
        Assert.Equal(1000m, mantida.ValorTotal);
        Assert.Equal(400m, transacao.Valor);
        Assert.Equal(1000m, transacao.ValorTotalOriginal);
        Assert.Contains(mantida.Participantes, item =>
            item.Id == participante.Id && !item.Ativo &&
            item.Status == DivisaoTransacaoParticipanteStatus.Recusado);
        Assert.DoesNotContain(database.Context.Notificacoes.IgnoreQueryFilters(), item =>
            !item.Lida && item.ParticipanteDivisaoId == participante.Id &&
            item.AcaoPendente == "DecidirRecusaDivisao");
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
        var aceitaCriador = await service.ObterAsync(criador.Id, divisao.Id);
        Assert.Equal(900m, aceitaCriador!.Participantes.Single(item =>
            item.TipoParticipante == TipoParticipanteDivisao.Criador).Valor);
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
    public async Task ExcluirAsync_AposAceitePendente_PreservaTransacaoOrigem()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);

        var excluida = await service.ExcluirAsync(
            criador.Id,
            divisao.Id,
            new ExcluirDivisaoRequest { Escopo = "EstaOcorrencia" });

        Assert.True(excluida);
        Assert.Contains(database.Context.Transacoes.IgnoreQueryFilters(), item => item.Id == transacao.Id);
        Assert.Equal(DivisaoTransacaoStatus.Cancelada, database.Context.DivisoesTransacoes.IgnoreQueryFilters().Single().Status);
        Assert.Contains(database.Context.Notificacoes.IgnoreQueryFilters(), notificacao =>
            notificacao.UsuarioId == convidado.Id &&
            notificacao.TipoNotificacao == TipoNotificacao.DivisaoCancelada);
    }

    [Fact]
    public async Task Reembolso_AceiteCriaPendencia()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);

        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);

        var reembolso = Assert.Single(database.Context.ReembolsosDivisao.IgnoreQueryFilters());
        Assert.Equal(criador.Id, reembolso.UsuarioId);
        Assert.Equal(divisao.Id, reembolso.DivisaoTransacaoId);
        Assert.Equal(convidado.Id, reembolso.ParticipanteUsuarioId);
        Assert.Equal(400m, reembolso.ValorDevido);
        Assert.Equal(0m, reembolso.ValorRecebido);
        Assert.Equal(400m, reembolso.SaldoPendente);
        Assert.Equal(ReembolsoDivisaoStatus.Pendente, reembolso.Status);
    }

    [Fact]
    public async Task Reembolso_ReceitaParcialAtualizaSaldoPendente()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var conta = await CriarContaAsync(database.Context, criador.Id);
        var reembolso = database.Context.ReembolsosDivisao.IgnoreQueryFilters().Single();
        var transacaoService = new TransacaoService(database.Context);

        await transacaoService.CriarAsync(
            new CriarTransacaoRequest
            {
                Tipo = TipoTransacao.Receita,
                Descricao = "Reembolso Maria",
                Valor = 30m,
                DataOcorrencia = DateOnly.FromDateTime(DateTime.Today).AddDays(-1),
                FormaPagamento = "Pix",
                ContaBancariaId = conta.Id,
                ReembolsoDivisaoId = reembolso.Id
            },
            criador.Id);

        Assert.Equal(30m, reembolso.ValorRecebido);
        Assert.Equal(370m, reembolso.SaldoPendente);
        Assert.Equal(ReembolsoDivisaoStatus.Parcial, reembolso.Status);
    }

    [Fact]
    public async Task Reembolso_ReceitaIntegralMarcaRecebido()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var conta = await CriarContaAsync(database.Context, criador.Id);
        var reembolso = database.Context.ReembolsosDivisao.IgnoreQueryFilters().Single();
        var transacaoService = new TransacaoService(database.Context);

        await transacaoService.CriarAsync(
            new CriarTransacaoRequest
            {
                Tipo = TipoTransacao.Receita,
                Descricao = "Reembolso integral",
                Valor = 400m,
                DataOcorrencia = DateOnly.FromDateTime(DateTime.Today).AddDays(-1),
                FormaPagamento = "Pix",
                ContaBancariaId = conta.Id,
                ReembolsoDivisaoId = reembolso.Id
            },
            criador.Id);

        Assert.Equal(400m, reembolso.ValorRecebido);
        Assert.Equal(0m, reembolso.SaldoPendente);
        Assert.Equal(ReembolsoDivisaoStatus.Recebido, reembolso.Status);
    }

    [Fact]
    public async Task Reembolso_ReceitaDesvinculadaNaoAtualizaPendencia()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var conta = await CriarContaAsync(database.Context, criador.Id);
        var reembolso = database.Context.ReembolsosDivisao.IgnoreQueryFilters().Single();
        var transacaoService = new TransacaoService(database.Context);

        await transacaoService.CriarAsync(
            new CriarTransacaoRequest
            {
                Tipo = TipoTransacao.Receita,
                Descricao = "Receita normal",
                Valor = 50m,
                DataOcorrencia = DateOnly.FromDateTime(DateTime.Today),
                FormaPagamento = "Pix",
                ContaBancariaId = conta.Id
            },
            criador.Id);

        Assert.Equal(0m, reembolso.ValorRecebido);
        Assert.Equal(ReembolsoDivisaoStatus.Pendente, reembolso.Status);
    }

    [Fact]
    public async Task Reembolso_ExcessoBloqueiaVinculo()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var conta = await CriarContaAsync(database.Context, criador.Id);
        var reembolso = database.Context.ReembolsosDivisao.IgnoreQueryFilters().Single();
        var transacaoService = new TransacaoService(database.Context);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            transacaoService.CriarAsync(
                new CriarTransacaoRequest
                {
                    Tipo = TipoTransacao.Receita,
                    Descricao = "Reembolso acima",
                    Valor = 401m,
                    DataOcorrencia = DateOnly.FromDateTime(DateTime.Today),
                    FormaPagamento = "Pix",
                    ContaBancariaId = conta.Id,
                    ReembolsoDivisaoId = reembolso.Id
                },
                criador.Id));
    }

    [Fact]
    public async Task Reembolso_ReceitaRecorrenteBloqueiaRendaRecorrente()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var conta = await CriarContaAsync(database.Context, criador.Id);
        var reembolso = database.Context.ReembolsosDivisao.IgnoreQueryFilters().Single();
        var transacaoService = new TransacaoService(database.Context);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            transacaoService.CriarAsync(
                new CriarTransacaoRequest
                {
                    Tipo = TipoTransacao.Receita,
                    Descricao = "Reembolso fixo indevido",
                    Valor = 30m,
                    DataOcorrencia = DateOnly.FromDateTime(DateTime.Today),
                    FormaPagamento = "Pix",
                    ContaBancariaId = conta.Id,
                    IsFixa = true,
                    ReembolsoDivisaoId = reembolso.Id
                },
                criador.Id));
    }

    [Fact]
    public async Task Reembolso_DesfazerRecebimentoReabrePendencia()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var conta = await CriarContaAsync(database.Context, criador.Id);
        var reembolso = database.Context.ReembolsosDivisao.IgnoreQueryFilters().Single();
        var transacaoService = new TransacaoService(database.Context);
        var transacaoId = await transacaoService.CriarAsync(
            new CriarTransacaoRequest
            {
                Tipo = TipoTransacao.Receita,
                Descricao = "Reembolso",
                Valor = 30m,
                DataOcorrencia = DateOnly.FromDateTime(DateTime.Today).AddDays(-1),
                FormaPagamento = "Pix",
                ContaBancariaId = conta.Id,
                ReembolsoDivisaoId = reembolso.Id
            },
            criador.Id);

        await transacaoService.AlternarStatusPagamentoAsync(
            transacaoId,
            criador.Id,
            request: new AlterarStatusPagamentoRequest { IsPaga = false });

        Assert.Equal(0m, reembolso.ValorRecebido);
        Assert.Equal(400m, reembolso.SaldoPendente);
        Assert.Equal(ReembolsoDivisaoStatus.Pendente, reembolso.Status);
    }

    [Fact]
    public async Task Reembolso_CancelamentoDispensaPendenciaAberta()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(service, criador, convidado, transacao);
        var reembolso = database.Context.ReembolsosDivisao.IgnoreQueryFilters().Single();

        await service.ExcluirAsync(
            criador.Id,
            divisao.Id,
            new ExcluirDivisaoRequest { Escopo = "EstaOcorrencia" });

        Assert.Equal(ReembolsoDivisaoStatus.Dispensado, reembolso.Status);
    }

    [Fact]
    public async Task Reembolso_ParticipanteExternoPermiteReceitaVinculada()
    {
        var (database, criador, _, transacao, _) = await CriarCenarioAsync();
        var divisao = new DivisaoTransacao
        {
            UsuarioId = criador.Id,
            UsuarioCriadorId = criador.Id,
            TransacaoOrigemId = transacao.Id,
            ValorTotal = 100m,
            Status = DivisaoTransacaoStatus.Aceita
        };
        var participanteExterno = new DivisaoTransacaoParticipante
        {
            UsuarioId = criador.Id,
            DivisaoTransacao = divisao,
            TipoParticipante = TipoParticipanteDivisao.Externo,
            Percentual = 50m,
            Valor = 50m,
            Status = DivisaoTransacaoParticipanteStatus.Aceito,
            Ativo = true,
            MotivoResposta = "Joao"
        };
        var reembolso = new ReembolsoDivisao
        {
            UsuarioId = criador.Id,
            DivisaoTransacao = divisao,
            Participante = participanteExterno,
            ParticipanteExternoNome = "Joao",
            ValorDevido = 50m,
            ValorRecebido = 0m,
            Status = ReembolsoDivisaoStatus.Pendente
        };
        database.Context.AddRange(divisao, participanteExterno, reembolso);
        var conta = await CriarContaAsync(database.Context, criador.Id);
        await database.Context.SaveChangesAsync();
        var transacaoService = new TransacaoService(database.Context);

        await transacaoService.CriarAsync(
            new CriarTransacaoRequest
            {
                Tipo = TipoTransacao.Receita,
                Descricao = "Reembolso externo",
                Valor = 50m,
                DataOcorrencia = DateOnly.FromDateTime(DateTime.Today).AddDays(-1),
                FormaPagamento = "Pix",
                ContaBancariaId = conta.Id,
                ReembolsoDivisaoId = reembolso.Id
            },
            criador.Id);

        Assert.Equal(ReembolsoDivisaoStatus.Recebido, reembolso.Status);
        Assert.Equal(50m, reembolso.ValorRecebido);
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
        var restaurada = Assert.Single(
            database.Context.Transacoes.IgnoreQueryFilters().Where(item => item.Id == transacao.Id));
        Assert.False(restaurada.IsDividida);
        Assert.Equal(1000m, restaurada.Valor);
        Assert.Null(restaurada.ValorTotalOriginal);
        Assert.Null(restaurada.PercentualDivisao);
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

    [Fact]
    public async Task CompraParceladaCartao_AceiteCriaSerieDoConvidadoSemCartaoDoCriador()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var categoria = await CriarCategoriaGlobalAsync(database.Context);
        var cartao = await CriarCartaoAsync(database.Context, criador.Id);
        var divisaoService = new DivisaoTransacaoService(database.Context);
        var compraService = new CompraParceladaService(database.Context, divisaoService);
        var inicio = new DateOnly(2026, 9, 10);
        var primeiroVencimento = new DateOnly(2026, 10, 12);

        var compra = await compraService.CriarAsync(
            new CriarCompraParceladaRequest
            {
                Descricao = "Notebook",
                ValorTotal = 600m,
                QuantidadeParcelas = 12,
                CategoriaId = categoria.Id,
                CartaoCreditoId = cartao.Id,
                DataCompra = inicio,
                FormaPagamento = FormaPagamentoCompraParcelada.CartaoCredito,
                IsDividida = true,
                ValorTotalOriginal = 1200m,
                PercentualDivisao = 50m,
                DivisaoVinculada = new CriarDivisaoCompraParceladaRequest
                {
                    ParticipantesUsuarios =
                    [
                        new CriarParticipanteUsuarioDivisaoRequest
                        {
                            Email = convidado.Email,
                            Percentual = 50m
                        }
                    ]
                }
            },
            criador.Id);

        Assert.Equal(600m, compra.ValorTotal);
        Assert.Equal(1200m, compra.ValorTotalOriginal);
        Assert.NotNull(compra.DivisaoTransacaoId);
        var divisao = await divisaoService.ObterAsync(criador.Id, compra.DivisaoTransacaoId!.Value);
        var convite = Assert.Single(divisao!.Participantes, item => item.ParticipanteUsuarioId == convidado.Id);
        Assert.Equal(600m, convite.Valor);

        var aceita = await divisaoService.AceitarAsync(convidado.Id, convite.Id);
        var obrigacao = Assert.Single(database.Context.ComprasParceladas.IgnoreQueryFilters(), item =>
            item.UsuarioId == convidado.Id);
        Assert.Equal(600m, obrigacao.ValorTotal);
        Assert.Equal(12, obrigacao.QuantidadeParcelas);
        Assert.Equal(primeiroVencimento, obrigacao.DataPrimeiroVencimento);
        Assert.Null(obrigacao.CartaoCreditoId);
        Assert.Equal(obrigacao.Id, aceita!.Participantes.Single(item => item.Id == convite.Id).CompraParceladaGeradaId);

        var transacaoService = new TransacaoService(database.Context);
        using var contextoConvidado = database.CreateContext(convidado.Id);
        var transacaoServiceConvidado = new TransacaoService(contextoConvidado);
        decimal totalCriador = 0m;
        decimal totalConvidado = 0m;
        for (var indice = 0; indice < 12; indice++)
        {
            var competencia = primeiroVencimento.AddMonths(indice);
            var faturasCriador = await transacaoService.GetFaturasDoMesAsync(
                competencia.Month,
                competencia.Year,
                criador.Id);
            var extratoConvidado = await transacaoServiceConvidado.GetExtratoMensalAsync(
                competencia.Month,
                competencia.Year,
                convidado.Id);
            var fatura = Assert.Single(faturasCriador, item => item.CartaoCreditoId == cartao.Id);
            totalCriador += Assert.Single(fatura.Detalhes, item => item.CompraParceladaId == compra.Id).Valor;
            totalConvidado += Assert.Single(extratoConvidado.Itens, item => item.CompraParceladaId == obrigacao.Id).Valor;
        }

        Assert.Equal(600m, totalCriador);
        Assert.Equal(600m, totalConvidado);
    }

    [Fact]
    public async Task CompraParceladaVinculadaPendente_EdicaoLocalPreservaRegraEconomica()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var categoria = await CriarCategoriaGlobalAsync(database.Context);
        var cartao = await CriarCartaoAsync(database.Context, criador.Id);
        var divisaoService = new DivisaoTransacaoService(database.Context);
        var compraService = new CompraParceladaService(database.Context, divisaoService);
        var compra = await compraService.CriarAsync(
            new CriarCompraParceladaRequest
            {
                Descricao = "Teste divisão",
                ValorTotal = 600m,
                QuantidadeParcelas = 10,
                CategoriaId = categoria.Id,
                CartaoCreditoId = cartao.Id,
                DataCompra = new DateOnly(2026, 8, 19),
                FormaPagamento = FormaPagamentoCompraParcelada.CartaoCredito,
                IsDividida = true,
                ValorTotalOriginal = 1000m,
                PercentualDivisao = 60m,
                DivisaoVinculada = new CriarDivisaoCompraParceladaRequest
                {
                    ParticipantesUsuarios =
                    [
                        new CriarParticipanteUsuarioDivisaoRequest
                        {
                            Email = convidado.Email,
                            Percentual = 40m
                        }
                    ]
                }
            },
            criador.Id);

        var atualizada = await compraService.AtualizarProjecaoAsync(
            compra.Id,
            1,
            new DateOnly(2026, 8, 20),
            new CriarCompraParceladaRequest
            {
                Descricao = "Teste divisão editado",
                ValorTotal = 1m,
                QuantidadeParcelas = 1,
                CategoriaId = categoria.Id,
                CartaoCreditoId = cartao.Id,
                DataCompra = new DateOnly(2026, 8, 20),
                FormaPagamento = FormaPagamentoCompraParcelada.CartaoCredito,
                IsDividida = true,
                ValorTotalOriginal = 2m,
                PercentualDivisao = 50m
            },
            criador.Id);

        Assert.NotNull(atualizada);
        Assert.Equal("Teste divisão editado", atualizada.Descricao);
        Assert.Equal(600m, atualizada.ValorTotal);
        Assert.Equal(1000m, atualizada.ValorTotalOriginal);
        Assert.Equal(60m, atualizada.PercentualDivisao);
        Assert.Equal(10, atualizada.QuantidadeParcelas);
        Assert.NotNull(atualizada.DivisaoTransacaoId);
    }

    [Fact]
    public async Task CompraParceladaCarne_DivisaoDesigual_PreservaCalendarioEFechaCentavos()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var categoria = await CriarCategoriaGlobalAsync(database.Context);
        var primeiroVencimento = new DateOnly(2026, 10, 20);
        var compra = await CriarCompraParceladaAsync(
            database.Context,
            criador.Id,
            categoria.Id,
            1000m,
            3,
            primeiroVencimento);
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                CompraParceladaId = compra.Id,
                EmailConvidado = convidado.Email,
                PercentualConvidado = 67m
            });
        var convite = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        await service.AceitarAsync(convidado.Id, convite.Id);

        var gerada = Assert.Single(database.Context.ComprasParceladas.IgnoreQueryFilters(), item =>
            item.UsuarioId == convidado.Id);
        Assert.Equal(330m, compra.ValorTotal);
        Assert.Equal(670m, gerada.ValorTotal);
        Assert.Equal(1000m, compra.ValorTotal + gerada.ValorTotal);
        Assert.Equal(primeiroVencimento, gerada.DataPrimeiroVencimento);
        Assert.Equal(compra.ValorTotal, SomarParcelas(compra.ValorTotal, compra.QuantidadeParcelas));
        Assert.Equal(gerada.ValorTotal, SomarParcelas(gerada.ValorTotal, gerada.QuantidadeParcelas));
    }

    [Fact]
    public async Task CompraParcelada_RecusaAssumirEAceiteRepetido_NaoDuplicamObrigacoes()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var categoria = await CriarCategoriaGlobalAsync(database.Context);
        var service = new DivisaoTransacaoService(database.Context);
        var compraRecusada = await CriarCompraParceladaAsync(
            database.Context,
            criador.Id,
            categoria.Id,
            1000m,
            5,
            new DateOnly(2026, 9, 15));
        var recusada = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                CompraParceladaId = compraRecusada.Id,
                EmailConvidado = convidado.Email,
                PercentualConvidado = 50m
            });
        var conviteRecusado = recusada.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        await service.RecusarAsync(convidado.Id, conviteRecusado.Id, new RecusarDivisaoRequest());
        await service.AssumirValorAsync(criador.Id, recusada.Id);
        Assert.Equal(1000m, compraRecusada.ValorTotal);
        Assert.Equal(100m, compraRecusada.PercentualDivisao);

        var compraAceita = await CriarCompraParceladaAsync(
            database.Context,
            criador.Id,
            categoria.Id,
            900m,
            3,
            new DateOnly(2027, 3, 10));
        var aceita = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                CompraParceladaId = compraAceita.Id,
                EmailConvidado = convidado.Email,
                PercentualConvidado = 50m
            });
        var conviteAceito = aceita.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        await service.AceitarAsync(convidado.Id, conviteAceito.Id);
        await service.AceitarAsync(convidado.Id, conviteAceito.Id);

        Assert.Single(database.Context.ComprasParceladas.IgnoreQueryFilters(), item => item.UsuarioId == convidado.Id);
        Assert.Empty(database.Context.Transacoes.IgnoreQueryFilters().Where(item => item.UsuarioId == convidado.Id));
    }

    [Fact]
    public async Task CriarCompraParcelada_DivisaoInvalida_ReverteOperacaoCompleta()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var categoria = await CriarCategoriaGlobalAsync(database.Context);
        var divisaoService = new DivisaoTransacaoService(database.Context);
        var compraService = new CompraParceladaService(database.Context, divisaoService);

        await Assert.ThrowsAsync<InvalidOperationException>(() => compraService.CriarAsync(
            new CriarCompraParceladaRequest
            {
                Descricao = "Compra inválida",
                ValorTotal = 200m,
                QuantidadeParcelas = 4,
                CategoriaId = categoria.Id,
                DataCompra = new DateOnly(2026, 9, 10),
                DataPrimeiroVencimento = new DateOnly(2026, 9, 10),
                FormaPagamento = FormaPagamentoCompraParcelada.Carne,
                IsDividida = true,
                ValorTotalOriginal = 1000m,
                PercentualDivisao = 20m,
                DivisaoVinculada = new CriarDivisaoCompraParceladaRequest
                {
                    ParticipantesUsuarios =
                    [
                        new CriarParticipanteUsuarioDivisaoRequest
                        {
                            Email = convidado.Email,
                            Percentual = 110m
                        }
                    ]
                }
            },
            criador.Id));

        database.Context.ChangeTracker.Clear();
        Assert.Empty(database.Context.ComprasParceladas.IgnoreQueryFilters());
        Assert.Empty(database.Context.DivisoesTransacoes.IgnoreQueryFilters());
        Assert.Empty(database.Context.Notificacoes.IgnoreQueryFilters());
    }

    [Fact]
    public async Task CompraParcelada_UsuarioEParteExterna_DistribuiCemPorCento()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var categoria = await CriarCategoriaGlobalAsync(database.Context);
        var compra = await CriarCompraParceladaAsync(
            database.Context,
            criador.Id,
            categoria.Id,
            1000m,
            10,
            new DateOnly(2026, 9, 10));
        var service = new DivisaoTransacaoService(database.Context);

        var divisao = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                CompraParceladaId = compra.Id,
                ParticipantesUsuarios =
                [
                    new CriarParticipanteUsuarioDivisaoRequest
                    {
                        Email = convidado.Email,
                        Percentual = 40m
                    }
                ],
                ParticipantesExternos =
                [
                    new CriarParticipanteExternoDivisaoRequest { Percentual = 20m }
                ]
            });

        Assert.Equal(400m, compra.ValorTotal);
        Assert.Equal(1000m, compra.ValorTotalOriginal);
        Assert.Equal(100m, divisao.Participantes.Sum(item => item.Percentual));
        Assert.Equal(1000m, divisao.Participantes.Sum(item => item.Valor));
        Assert.Contains(divisao.Participantes, item =>
            item.TipoParticipante == TipoParticipanteDivisao.Externo && item.Valor == 200m);
        Assert.Contains(database.Context.ReembolsosDivisao.IgnoreQueryFilters(), item =>
            item.ParticipanteUsuarioId == null && item.ValorDevido == 200m);
    }

    [Fact]
    public async Task CompraParcelada_AlteracaoAceita_AtualizaAcordoEAsDuasSeries()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var categoria = await CriarCategoriaGlobalAsync(database.Context);
        var compra = await CriarCompraParceladaAsync(
            database.Context,
            criador.Id,
            categoria.Id,
            1000m,
            5,
            new DateOnly(2027, 1, 10));
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                CompraParceladaId = compra.Id,
                EmailConvidado = convidado.Email,
                PercentualConvidado = 40m
            });
        var convite = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        await service.AceitarAsync(convidado.Id, convite.Id);
        var novaData = new DateOnly(2027, 2, 15);

        var proposta = await service.ProporAlteracaoAsync(
            criador.Id,
            divisao.Id,
            new ProporAlteracaoDivisaoRequest
            {
                ValorTotal = 1200m,
                PercentualConvidado = 25m,
                QuantidadeParcelas = 6,
                Vencimento = novaData,
                Escopo = "TodaSerie"
            });
        var versao = Assert.Single(proposta!.Versoes, item =>
            item.Status == DivisaoTransacaoVersaoStatus.PropostaPendente);
        await service.AceitarAlteracaoAsync(convidado.Id, versao.Id);

        var gerada = Assert.Single(database.Context.ComprasParceladas.IgnoreQueryFilters(), item =>
            item.UsuarioId == convidado.Id);
        Assert.Equal(900m, compra.ValorTotal);
        Assert.Equal(300m, gerada.ValorTotal);
        Assert.Equal(6, compra.QuantidadeParcelas);
        Assert.Equal(6, gerada.QuantidadeParcelas);
        Assert.Equal(novaData, compra.DataPrimeiroVencimento);
        Assert.Equal(novaData, gerada.DataPrimeiroVencimento);
    }

    [Fact]
    public async Task MultiplosUsuarios_CriaConvitesIndependentesEFechaDistribuicao()
    {
        var (database, criador, maria, transacao, pedro) = await CriarCenarioAsync();
        var joao = new Usuario
        {
            Nome = "João",
            Email = "joao@teste.local",
            SenhaHash = "hash"
        };
        database.Context.Usuarios.Add(joao);
        await database.Context.SaveChangesAsync();
        var service = new DivisaoTransacaoService(database.Context);

        var divisao = await service.CriarConviteAsync(criador.Id, new CriarConviteDivisaoRequest
        {
            TransacaoOrigemId = transacao.Id,
            ParticipantesUsuarios =
            [
                new() { Email = joao.Email, Percentual = 20m },
                new() { Email = maria.Email, Percentual = 25m },
                new() { Email = pedro.Email, Percentual = 10m }
            ],
            ParticipantesExternos = [new() { Percentual = 5m }]
        });

        Assert.Equal(5, divisao.Participantes.Count);
        Assert.Equal(100m, divisao.Participantes.Sum(item => item.Percentual));
        Assert.Equal(1000m, divisao.Participantes.Sum(item => item.Valor));
        Assert.Equal(400m, divisao.Participantes.Single(item =>
            item.TipoParticipante == TipoParticipanteDivisao.Criador).Valor);
        Assert.Equal(3, database.Context.Notificacoes.IgnoreQueryFilters().Count(item =>
            item.TipoNotificacao == TipoNotificacao.DivisaoRecebida));
        var visaoMaria = await service.ObterAsync(maria.Id, divisao.Id);
        var participanteVisivel = Assert.Single(visaoMaria!.Participantes);
        Assert.Equal(maria.Id, participanteVisivel.ParticipanteUsuarioId);
    }

    [Fact]
    public async Task RecusaEReenvio_MultiplosUsuarios_AlteraSomenteParticipanteAlvo()
    {
        var (database, criador, maria, transacao, pedro) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await service.CriarConviteAsync(criador.Id, new CriarConviteDivisaoRequest
        {
            TransacaoOrigemId = transacao.Id,
            ParticipantesUsuarios =
            [
                new() { Email = maria.Email, Percentual = 30m },
                new() { Email = pedro.Email, Percentual = 30m }
            ]
        });
        var conviteMaria = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == maria.Id);
        var convitePedro = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == pedro.Id);

        var parcial = await service.AceitarAsync(pedro.Id, convitePedro.Id);
        Assert.Equal(DivisaoTransacaoStatus.ParcialmenteAceita, parcial!.Status);
        await service.RecusarAsync(maria.Id, conviteMaria.Id, new RecusarDivisaoRequest());

        var notificacao = Assert.Single(database.Context.Notificacoes.IgnoreQueryFilters().Where(item =>
            item.TipoNotificacao == TipoNotificacao.DivisaoRecusada));
        Assert.Equal(conviteMaria.Id, notificacao.ParticipanteDivisaoId);
        var reenviada = await service.ReenviarAsync(criador.Id, divisao.Id, new ReenviarDivisaoRequest
        {
            ParticipanteId = conviteMaria.Id
        });

        Assert.Single(reenviada!.Participantes, item =>
            item.ParticipanteUsuarioId == pedro.Id && item.Ativo &&
            item.Status == DivisaoTransacaoParticipanteStatus.Aceito);
        Assert.Single(reenviada.Participantes, item =>
            item.ParticipanteUsuarioId == maria.Id && item.Ativo &&
            item.Status == DivisaoTransacaoParticipanteStatus.Pendente);
    }

    [Fact]
    public async Task AssumirValorParticipante_MantemOutrosConvidadosIntactos()
    {
        var (database, criador, maria, transacao, pedro) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await service.CriarConviteAsync(criador.Id, new CriarConviteDivisaoRequest
        {
            TransacaoOrigemId = transacao.Id,
            ParticipantesUsuarios =
            [
                new() { Email = maria.Email, Percentual = 30m },
                new() { Email = pedro.Email, Percentual = 30m }
            ]
        });
        var mariaParte = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == maria.Id);
        var pedroParte = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == pedro.Id);
        await service.RecusarAsync(maria.Id, mariaParte.Id, new RecusarDivisaoRequest());

        var assumida = await service.AssumirValorParticipanteAsync(criador.Id, mariaParte.Id);

        Assert.Equal(70m, assumida!.Participantes.Single(item =>
            item.TipoParticipante == TipoParticipanteDivisao.Criador).Percentual);
        Assert.Contains(assumida.Participantes, item => item.Id == pedroParte.Id && item.Ativo &&
            item.Status == DivisaoTransacaoParticipanteStatus.Pendente && item.Percentual == 30m);
    }

    [Fact]
    public async Task ManterParteCriador_MultiplosUsuarios_EncerraSomenteParticipanteAlvo()
    {
        var (database, criador, maria, transacao, pedro) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await service.CriarConviteAsync(criador.Id, new CriarConviteDivisaoRequest
        {
            TransacaoOrigemId = transacao.Id,
            ParticipantesUsuarios =
            [
                new() { Email = maria.Email, Percentual = 30m },
                new() { Email = pedro.Email, Percentual = 30m }
            ]
        });
        var mariaParte = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == maria.Id);
        var pedroParte = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == pedro.Id);
        await service.RecusarAsync(maria.Id, mariaParte.Id, new RecusarDivisaoRequest());

        var mantida = await service.ManterParteCriadorAsync(criador.Id, mariaParte.Id);

        Assert.Equal(40m, mantida!.Participantes.Single(item =>
            item.TipoParticipante == TipoParticipanteDivisao.Criador).Percentual);
        Assert.Contains(mantida.Participantes, item => item.Id == mariaParte.Id && !item.Ativo);
        Assert.Contains(mantida.Participantes, item => item.Id == pedroParte.Id && item.Ativo &&
            item.Status == DivisaoTransacaoParticipanteStatus.Pendente && item.Percentual == 30m);
        Assert.Equal(DivisaoTransacaoStatus.Pendente, mantida.Status);
    }

    [Fact]
    public async Task ParteExternaEmReais_PreservaValorExato()
    {
        var (database, criador, _, transacao, _) = await CriarCenarioAsync();
        transacao.Valor = 437.80m;
        var service = new DivisaoTransacaoService(database.Context);

        var divisao = await service.CriarConviteAsync(criador.Id, new CriarConviteDivisaoRequest
        {
            TransacaoOrigemId = transacao.Id,
            ParticipantesExternos =
            [
                new()
                {
                    ModoDefinicao = ModoDefinicaoParticipacaoDivisao.Valor,
                    Valor = 83.47m
                }
            ]
        });

        var externo = divisao.Participantes.Single(item =>
            item.TipoParticipante == TipoParticipanteDivisao.Externo);
        Assert.Equal(83.47m, externo.Valor);
        Assert.Equal(ModoDefinicaoParticipacaoDivisao.Valor, externo.ModoDefinicao);
        Assert.Equal(437.80m, divisao.Participantes.Sum(item => item.Valor));
        Assert.Equal(100m, divisao.Participantes.Sum(item => item.Percentual));
    }

    [Fact]
    public async Task AceitarTransacaoNoCartao_UsaVencimentoDaFaturaSemCopiarCartao()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var cartao = await CriarCartaoAsync(database.Context, criador.Id);
        cartao.MelhorDiaCompra = 2;
        cartao.DiaVencimento = 8;
        transacao.DataOcorrencia = new DateOnly(2026, 8, 15);
        transacao.CartaoCreditoId = cartao.Id;
        transacao.CartaoCredito = cartao;
        await database.Context.SaveChangesAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);
        var convite = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);

        await service.AceitarAsync(convidado.Id, convite.Id);

        var gerada = Assert.Single(database.Context.Transacoes.IgnoreQueryFilters().Where(item =>
            item.UsuarioId == convidado.Id));
        Assert.Equal(new DateOnly(2026, 9, 8), gerada.DataOcorrencia);
        Assert.Null(gerada.CartaoCreditoId);
    }

    [Fact]
    public async Task AlteracaoEconomicaMultiplosUsuarios_AplicaSomenteAposTodosAceitarem()
    {
        var (database, criador, maria, transacao, pedro) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await service.CriarConviteAsync(criador.Id, new CriarConviteDivisaoRequest
        {
            TransacaoOrigemId = transacao.Id,
            ParticipantesUsuarios =
            [
                new() { Email = maria.Email, Percentual = 30m },
                new() { Email = pedro.Email, Percentual = 30m }
            ]
        });
        var mariaParte = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == maria.Id);
        var pedroParte = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == pedro.Id);
        await service.AceitarAsync(maria.Id, mariaParte.Id);
        await service.AceitarAsync(pedro.Id, pedroParte.Id);

        var proposta = await service.ProporAlteracaoAsync(criador.Id, divisao.Id,
            new ProporAlteracaoDivisaoRequest { ValorTotal = 1200m });
        var versao = Assert.Single(proposta!.Versoes);
        Assert.Equal(2, versao.Participantes.Count(item =>
            item.Status == DivisaoTransacaoVersaoParticipanteStatus.Pendente));

        var parcial = await service.AceitarAlteracaoAsync(maria.Id, versao.Id);
        Assert.Equal(DivisaoTransacaoStatus.AlteracaoPendente, parcial!.Status);
        Assert.Equal(1000m, transacao.ValorTotalOriginal);

        var aplicada = await service.AceitarAlteracaoAsync(pedro.Id, versao.Id);
        Assert.Equal(DivisaoTransacaoStatus.Aceita, aplicada!.Status);
        Assert.Equal(1200m, aplicada.ValorTotal);
        Assert.Equal(480m, transacao.Valor);
        Assert.Equal(360m, database.Context.Transacoes.IgnoreQueryFilters().Single(item =>
            item.UsuarioId == maria.Id).Valor);
        Assert.Equal(360m, database.Context.Transacoes.IgnoreQueryFilters().Single(item =>
            item.UsuarioId == pedro.Id).Valor);
    }

    [Fact]
    public async Task EdicaoLocalConvidado_PermiteDataEMantemValorEconomico()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var divisaoService = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(
            divisaoService,
            criador,
            convidado,
            transacao);
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        var gerada = database.Context.Transacoes.IgnoreQueryFilters().Single(item =>
            item.Id == participante.TransacaoGeradaId);
        var novaData = gerada.DataOcorrencia.AddDays(-3);
        var transacaoService = new TransacaoService(database.Context, divisaoService);

        await transacaoService.AtualizarAsync(gerada.Id, new CriarTransacaoRequest
        {
            Tipo = TipoTransacao.Despesa,
            Descricao = "Descrição local",
            Valor = participante.Valor,
            DataOcorrencia = novaData,
            FormaPagamento = "Divisão compartilhada",
            IsFixa = false,
            IsDividida = false
        }, convidado.Id);

        Assert.Equal(novaData, gerada.DataOcorrencia);
        Assert.Equal("Descrição local", gerada.Descricao);
        Assert.Equal(600m, transacao.Valor);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            transacaoService.AtualizarAsync(gerada.Id, new CriarTransacaoRequest
            {
                Tipo = TipoTransacao.Despesa,
                Descricao = gerada.Descricao,
                Valor = participante.Valor + 1m,
                DataOcorrencia = gerada.DataOcorrencia,
                FormaPagamento = gerada.FormaPagamento,
                IsFixa = false,
                IsDividida = false
            }, convidado.Id));
    }

    [Fact]
    public async Task ExcluirLancamentoConvidado_PreservaOrigemENotificaCriador()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var divisaoService = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarDivisaoAceitaPadraoAsync(
            divisaoService,
            criador,
            convidado,
            transacao);
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        var transacaoService = new TransacaoService(database.Context, divisaoService);

        var excluida = await transacaoService.ExcluirAsync(
            participante.TransacaoGeradaId!.Value,
            convidado.Id);

        Assert.True(excluida);
        Assert.DoesNotContain(database.Context.Transacoes.IgnoreQueryFilters(), item =>
            item.Id == participante.TransacaoGeradaId);
        Assert.Contains(database.Context.Transacoes.IgnoreQueryFilters(), item => item.Id == transacao.Id);
        Assert.Contains(database.Context.Notificacoes.IgnoreQueryFilters(), item =>
            item.UsuarioId == criador.Id &&
            item.TipoNotificacao == TipoNotificacao.DivisaoRecusada &&
            item.ParticipanteDivisaoId == participante.Id);
    }

    [Fact]
    public async Task CompraParceladaCancelada_PermiteRevincularEExcluirPrimeiraParcela()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var categoria = await CriarCategoriaGlobalAsync(database.Context);
        var cartao = await CriarCartaoAsync(database.Context, criador.Id);
        var divisaoService = new DivisaoTransacaoService(database.Context);
        var compraService = new CompraParceladaService(database.Context, divisaoService);
        var request = new CriarCompraParceladaRequest
        {
            Descricao = "Compra compartilhada",
            ValorTotal = 600m,
            QuantidadeParcelas = 2,
            CategoriaId = categoria.Id,
            CartaoCreditoId = cartao.Id,
            DataCompra = new DateOnly(2026, 8, 20),
            FormaPagamento = FormaPagamentoCompraParcelada.CartaoCredito,
            IsDividida = true,
            ValorTotalOriginal = 1000m,
            PercentualDivisao = 60m,
            DivisaoVinculada = new CriarDivisaoCompraParceladaRequest
            {
                ParticipantesUsuarios =
                [
                    new CriarParticipanteUsuarioDivisaoRequest
                    {
                        Email = convidado.Email,
                        Percentual = 40m
                    }
                ]
            }
        };
        var compra = await compraService.CriarAsync(request, criador.Id);
        var primeiraDivisaoId = compra.DivisaoTransacaoId!.Value;

        await divisaoService.ExcluirAsync(
            criador.Id,
            primeiraDivisaoId,
            new ExcluirDivisaoRequest { Escopo = "EstaOcorrencia" });

        var revinculada = await compraService.AtualizarProjecaoAsync(
            compra.Id,
            1,
            request.DataCompra,
            request,
            criador.Id);

        Assert.NotNull(revinculada);
        Assert.Equal(compra.Id, revinculada.Id);
        Assert.NotNull(revinculada.DivisaoTransacaoId);
        Assert.NotEqual(primeiraDivisaoId, revinculada.DivisaoTransacaoId);

        await divisaoService.ExcluirAsync(
            criador.Id,
            revinculada.DivisaoTransacaoId!.Value,
            new ExcluirDivisaoRequest { Escopo = "EstaOcorrencia" });
        var excluida = await compraService.ExcluirProjecaoAsync(compra.Id, 1, criador.Id);

        Assert.True(excluida);
        Assert.Empty(database.Context.ComprasParceladas.IgnoreQueryFilters());
        Assert.All(
            database.Context.DivisoesTransacoes.IgnoreQueryFilters(),
            divisao => Assert.Null(divisao.CompraParceladaId));
    }

    [Fact]
    public async Task TransacaoFixaCancelada_PermiteEditarRevincularEExcluir()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var categoria = await CriarCategoriaGlobalAsync(database.Context);
        transacao.CategoriaId = categoria.Id;
        transacao.IsFixa = true;
        await database.Context.SaveChangesAsync();
        var divisaoService = new DivisaoTransacaoService(database.Context);
        var transacaoService = new TransacaoService(database.Context, divisaoService);
        var primeiraDivisao = await CriarConvitePadraoAsync(
            divisaoService,
            criador,
            convidado,
            transacao);

        await divisaoService.ExcluirAsync(
            criador.Id,
            primeiraDivisao.Id,
            new ExcluirDivisaoRequest { Escopo = "EstaOcorrencia" });
        await transacaoService.AtualizarAsync(
            transacao.Id,
            new CriarTransacaoRequest
            {
                Tipo = TipoTransacao.Despesa,
                Descricao = "Fixa editada",
                Valor = 1000m,
                DataOcorrencia = transacao.DataOcorrencia,
                CategoriaId = categoria.Id,
                FormaPagamento = "Pix",
                IsFixa = true,
                IsDividida = false
            },
            criador.Id);

        var segundaDivisao = await CriarConvitePadraoAsync(
            divisaoService,
            criador,
            convidado,
            transacao);
        await divisaoService.ExcluirAsync(
            criador.Id,
            segundaDivisao.Id,
            new ExcluirDivisaoRequest { Escopo = "EstaOcorrencia" });
        var excluida = await transacaoService.ExcluirAsync(
            transacao.Id,
            criador.Id,
            transacao.DataOcorrencia,
            replicarFuturas: true);

        Assert.True(excluida);
        Assert.DoesNotContain(
            database.Context.Transacoes.IgnoreQueryFilters(),
            item => item.Id == transacao.Id);
        Assert.All(
            database.Context.DivisoesTransacoes.IgnoreQueryFilters(),
            divisao => Assert.Null(divisao.TransacaoOrigemId));
    }

    [Fact]
    public async Task ListarCompartilhadasAsync_BilateralRetornaMesmoEventoComPerspectivaDeCadaUsuario()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        transacao.Valor = 600m;
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                TransacaoOrigemId = transacao.Id,
                EmailConvidado = convidado.Email,
                PercentualConvidado = 50m
            });
        var participante = divisao.Participantes.Single(item => item.ParticipanteUsuarioId == convidado.Id);
        await service.AceitarAsync(convidado.Id, participante.Id);
        var request = CriarFiltroCompartilhadas(transacao.DataOcorrencia);

        var visaoCriador = await service.ListarCompartilhadasAsync(criador.Id, request);
        var visaoConvidado = await service.ListarCompartilhadasAsync(convidado.Id, request);

        var itemCriador = Assert.Single(visaoCriador.Itens);
        var itemConvidado = Assert.Single(visaoConvidado.Itens);
        Assert.Equal(divisao.Id, itemCriador.DivisaoId);
        Assert.Equal(divisao.Id, itemConvidado.DivisaoId);
        Assert.Equal(600m, itemCriador.ValorTotal);
        Assert.Equal(300m, itemCriador.MinhaParte);
        Assert.Equal(300m, itemConvidado.MinhaParte);
        Assert.Equal("Criador", itemCriador.MeuPapel);
        Assert.Equal("Convidado", itemConvidado.MeuPapel);
        Assert.NotEqual(transacao.Id, itemConvidado.TransacaoLocalId);
    }

    [Fact]
    public async Task ListarCompartilhadasAsync_FiltroPessoaFuncionaNasDuasDirecoesEComTerceiro()
    {
        var (database, ronald, ana, transacaoRonald, joao) = await CriarCenarioAsync();
        ana.Nome = "Ana";
        joao.Nome = "João";
        transacaoRonald.Valor = 1000m;
        var service = new DivisaoTransacaoService(database.Context);
        await service.CriarConviteAsync(
            ronald.Id,
            new CriarConviteDivisaoRequest
            {
                TransacaoOrigemId = transacaoRonald.Id,
                ParticipantesUsuarios =
                [
                    new() { Email = ana.Email, Percentual = 30m },
                    new() { Email = joao.Email, Percentual = 30m }
                ]
            });
        var transacaoAna = new Transacao
        {
            UsuarioId = ana.Id,
            CodigoExibicao = 2,
            Tipo = TipoTransacao.Despesa,
            Descricao = "Criada por Ana",
            Valor = 600m,
            DataOcorrencia = transacaoRonald.DataOcorrencia,
            FormaPagamento = "Pix"
        };
        database.Context.Transacoes.Add(transacaoAna);
        await database.Context.SaveChangesAsync();
        using var contextoAna = database.CreateContext(ana.Id);
        var serviceAna = new DivisaoTransacaoService(contextoAna);
        await serviceAna.CriarConviteAsync(
            ana.Id,
            new CriarConviteDivisaoRequest
            {
                TransacaoOrigemId = transacaoAna.Id,
                EmailConvidado = ronald.Email,
                PercentualConvidado = 50m
            });
        var request = CriarFiltroCompartilhadas(transacaoRonald.DataOcorrencia);
        request.ParticipanteUsuarioId = ana.Id;

        var response = await service.ListarCompartilhadasAsync(ronald.Id, request);

        Assert.Equal(2, response.TotalItens);
        var tresParticipantes = response.Itens.Single(item => item.ValorTotal == 1000m);
        Assert.Equal(400m, tresParticipantes.MinhaParte);
        Assert.Equal(300m, tresParticipantes.Participantes.Single(item => item.UsuarioId == ana.Id).Valor);
        Assert.Equal(300m, tresParticipantes.Participantes.Single(item => item.UsuarioId == joao.Id).Valor);
        Assert.Equal(600m, response.Resumo.PartePessoaSelecionada);
        Assert.True(response.Resumo.PossuiOutrosParticipantes);
    }

    [Fact]
    public async Task ListarCompartilhadasAsync_CompraParceladaRetornaUmaLinhaESomenteCompetenciaDoPeriodo()
    {
        var (database, criador, convidado, _, _) = await CriarCenarioAsync();
        var categoria = await CriarCategoriaGlobalAsync(database.Context);
        var compra = await CriarCompraParceladaAsync(
            database.Context,
            criador.Id,
            categoria.Id,
            1200m,
            12,
            new DateOnly(2026, 8, 10));
        var service = new DivisaoTransacaoService(database.Context);
        await service.CriarConviteAsync(
            criador.Id,
            new CriarConviteDivisaoRequest
            {
                CompraParceladaId = compra.Id,
                EmailConvidado = convidado.Email,
                PercentualConvidado = 40m
            });

        var response = await service.ListarCompartilhadasAsync(
            criador.Id,
            CriarFiltroCompartilhadas(new DateOnly(2026, 9, 10)));

        var item = Assert.Single(response.Itens);
        Assert.Equal(100m, item.ValorTotal);
        Assert.Equal(60m, item.MinhaParte);
        Assert.Equal(2, item.ParcelaInicial);
        Assert.Equal(2, item.ParcelaFinal);
        Assert.Equal(1200m, item.ValorTotalSerie);
    }

    [Fact]
    public async Task ListarCompartilhadasAsync_CartaoUsaVencimentoDaFaturaSemExporInstrumento()
    {
        var (database, criador, convidado, transacao, _) = await CriarCenarioAsync();
        var cartao = await CriarCartaoAsync(database.Context, criador.Id);
        cartao.MelhorDiaCompra = 20;
        cartao.DiaVencimento = 8;
        transacao.DataOcorrencia = new DateOnly(2026, 8, 15);
        transacao.CartaoCreditoId = cartao.Id;
        transacao.FormaPagamento = "Cartão de crédito";
        await database.Context.SaveChangesAsync();
        var service = new DivisaoTransacaoService(database.Context);
        await CriarConvitePadraoAsync(service, criador, convidado, transacao);

        var agosto = await service.ListarCompartilhadasAsync(
            convidado.Id,
            CriarFiltroCompartilhadas(new DateOnly(2026, 8, 1)));
        var setembro = await service.ListarCompartilhadasAsync(
            convidado.Id,
            CriarFiltroCompartilhadas(new DateOnly(2026, 9, 1)));

        Assert.Empty(agosto.Itens);
        var item = Assert.Single(setembro.Itens);
        Assert.Equal(new DateOnly(2026, 9, 8), item.DataReferencia);
        Assert.Equal("CartaoCredito", item.Origem);
        Assert.Null(item.TransacaoLocalId);
    }

    [Fact]
    public async Task ListarCompartilhadasAsync_UsuarioAlheioNaoVisualizaDivisao()
    {
        var (database, criador, convidado, transacao, outro) = await CriarCenarioAsync();
        var service = new DivisaoTransacaoService(database.Context);
        var divisao = await CriarConvitePadraoAsync(service, criador, convidado, transacao);

        var lista = await service.ListarCompartilhadasAsync(
            outro.Id,
            CriarFiltroCompartilhadas(transacao.DataOcorrencia));
        var detalhe = await service.ObterAsync(outro.Id, divisao.Id);

        Assert.Empty(lista.Itens);
        Assert.Null(detalhe);
    }

    private static ListarDivisoesCompartilhadasRequest CriarFiltroCompartilhadas(DateOnly data)
    {
        return new ListarDivisoesCompartilhadasRequest
        {
            DataInicial = new DateOnly(data.Year, data.Month, 1),
            DataFinal = new DateOnly(data.Year, data.Month, DateTime.DaysInMonth(data.Year, data.Month)),
            Pagina = 1,
            TamanhoPagina = 25
        };
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

    private static async Task<Categoria> CriarCategoriaGlobalAsync(AppDbContext context)
    {
        var categoria = new Categoria
        {
            Nome = "Compras",
            CorHexa = "#2563EB",
            UsuarioId = null
        };
        context.Categorias.Add(categoria);
        await context.SaveChangesAsync();
        return categoria;
    }

    private static async Task<CartaoCredito> CriarCartaoAsync(AppDbContext context, Guid usuarioId)
    {
        var cartao = new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = "Cartão do criador",
            Banco = "Banco",
            LimiteTotal = 5000m,
            MelhorDiaCompra = 5,
            DiaVencimento = 12
        };
        context.CartoesCredito.Add(cartao);
        await context.SaveChangesAsync();
        return cartao;
    }

    private static async Task<CompraParcelada> CriarCompraParceladaAsync(
        AppDbContext context,
        Guid usuarioId,
        Guid categoriaId,
        decimal valorTotal,
        int quantidadeParcelas,
        DateOnly primeiroVencimento)
    {
        var compra = new CompraParcelada
        {
            UsuarioId = usuarioId,
            CategoriaId = categoriaId,
            Descricao = "Compra compartilhada",
            QuantidadeParcelas = quantidadeParcelas,
            ValorTotal = valorTotal,
            DataCompra = primeiroVencimento,
            DataPrimeiroVencimento = primeiroVencimento,
            FormaPagamento = FormaPagamentoCompraParcelada.Carne
        };
        context.ComprasParceladas.Add(compra);
        await context.SaveChangesAsync();
        return compra;
    }

    private static decimal SomarParcelas(decimal valorTotal, int quantidadeParcelas)
    {
        var valorBase = Math.Round(valorTotal / quantidadeParcelas, 2, MidpointRounding.AwayFromZero);
        return Enumerable.Range(1, quantidadeParcelas)
            .Sum(numero => numero == quantidadeParcelas
                ? valorTotal - (valorBase * (quantidadeParcelas - 1))
                : valorBase);
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

    private static async Task<ContaBancaria> CriarContaAsync(AppDbContext context, Guid usuarioId)
    {
        var conta = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Conta reembolso",
            CodigoBanco = "001",
            SaldoInicial = 0m
        };
        context.ContasBancarias.Add(conta);
        await context.SaveChangesAsync();
        return conta;
    }
}
