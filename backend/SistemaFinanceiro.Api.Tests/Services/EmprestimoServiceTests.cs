using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Emprestimos;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Emprestimos;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class EmprestimoServiceTests
{
    [Fact]
    public async Task CriarAsync_AvistaCriaObrigacaoUnicaEmAberto()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);

        var resultado = await service.CriarAsync(
            cenario.UsuarioId,
            CriarRequest(cenario, 250m, 1));

        var parcela = Assert.Single(resultado.Parcelas);
        Assert.Equal(250m, parcela.Valor);
        Assert.Equal(StatusParcelaEmprestimo.Pendente, parcela.Status);
        Assert.Equal(StatusEmprestimo.EmAberto, resultado.Status);
        Assert.Equal(250m, resultado.SaldoReceber);
    }

    [Fact]
    public async Task CriarAsync_ParceladoGeraCronogramaMensal()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);

        var resultado = await service.CriarAsync(
            cenario.UsuarioId,
            CriarRequest(cenario, 1200m, 12, OrigemFinanceiraEmprestimo.CartaoCredito));

        Assert.Equal(12, resultado.Parcelas.Count);
        Assert.All(resultado.Parcelas, parcela => Assert.Equal(100m, parcela.Valor));
        Assert.Equal(new DateOnly(2026, 8, 20), resultado.Parcelas[0].DataVencimento);
        Assert.Equal(new DateOnly(2027, 7, 20), resultado.Parcelas[11].DataVencimento);
        Assert.Equal(1200m, resultado.Parcelas.Sum(parcela => parcela.Valor));
    }

    [Fact]
    public async Task CriarAsync_ArredondamentoAtribuiRestanteAUltimaParcela()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);

        var resultado = await service.CriarAsync(
            cenario.UsuarioId,
            CriarRequest(cenario, 100m, 3));

        Assert.Equal(new[] { 33.33m, 33.33m, 33.34m }, resultado.Parcelas.Select(parcela => parcela.Valor));
        Assert.Equal(100m, resultado.Parcelas.Sum(parcela => parcela.Valor));
    }

    [Fact]
    public async Task ListarAsync_FiltraPorContato()
    {
        using var cenario = await CriarCenarioAsync();
        var outroContato = new ContatoEmprestimo
        {
            UsuarioId = cenario.UsuarioId,
            Nome = "Joao"
        };
        cenario.Database.Context.ContatosEmprestimos.Add(outroContato);
        await cenario.Database.Context.SaveChangesAsync();
        var service = new EmprestimoService(cenario.Database.Context);

        await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 100m, 1));
        var outroRequest = CriarRequest(cenario, 200m, 1);
        outroRequest.ContatoId = outroContato.Id;
        await service.CriarAsync(cenario.UsuarioId, outroRequest);

        var resultado = await service.ListarAsync(cenario.UsuarioId, cenario.Contato.Id);

        var emprestimo = Assert.Single(resultado);
        Assert.Equal(cenario.Contato.Id, emprestimo.ContatoId);
        Assert.Equal(100m, emprestimo.ValorTotal);
    }

    [Fact]
    public async Task ObterResumoMensalAsync_ParceladoConsideraSomenteParcelaDaCompetencia()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 1200m, 12));

        var agosto = await service.ObterResumoMensalAsync(cenario.UsuarioId, 8, 2026);
        var setembro = await service.ObterResumoMensalAsync(cenario.UsuarioId, 9, 2026);

        Assert.Equal(1200m, agosto.AReceberTotal);
        Assert.Equal(100m, agosto.PrevistoNoMes);
        Assert.Equal(100m, setembro.PrevistoNoMes);
        Assert.Equal(100m, Assert.Single(setembro.Itens).ValorCompetencia);
    }

    [Fact]
    public async Task ObterResumoMensalAsync_AvistaApareceSomenteNaCompetenciaCorreta()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 250m, 1));

        var agosto = await service.ObterResumoMensalAsync(cenario.UsuarioId, 8, 2026);
        var setembro = await service.ObterResumoMensalAsync(cenario.UsuarioId, 9, 2026);

        Assert.Equal(250m, agosto.PrevistoNoMes);
        Assert.Equal(250m, Assert.Single(agosto.Itens).ValorCompetencia);
        Assert.Equal(0m, setembro.PrevistoNoMes);
        Assert.Empty(setembro.Itens);
        Assert.Equal(0, setembro.TotalItens);
        Assert.Equal(250m, setembro.AReceberTotal);
    }

    [Fact]
    public async Task ObterResumoMensalAsync_CartaoUsaVencimentoCalculadoPeloCicloDaFatura()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var request = CriarRequest(cenario, 1000m, 1, OrigemFinanceiraEmprestimo.CartaoCredito);
        request.Data = new DateOnly(2026, 8, 20);
        await service.CriarAsync(cenario.UsuarioId, request);

        var agosto = await service.ObterResumoMensalAsync(cenario.UsuarioId, 8, 2026);
        var setembro = await service.ObterResumoMensalAsync(cenario.UsuarioId, 9, 2026);

        Assert.Equal(0m, agosto.PrevistoNoMes);
        Assert.Equal(1000m, setembro.PrevistoNoMes);
        var item = Assert.Single(setembro.Itens);
        Assert.Equal(new DateOnly(2026, 9, 10), item.DataCompetencia);
        Assert.Equal("Cartao principal", item.OrigemNome);
    }

    [Fact]
    public async Task ObterResumoMensalAsync_AntecipacaoSeparaCompetenciaDeDataDoRecebimento()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 300m, 3));
        await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            new RegistrarPagamentoEmprestimoRequest
            {
                Data = new DateOnly(2026, 9, 1),
                ParcelaIds = new[] { emprestimo.Parcelas[2].Id }
            });

        var setembro = await service.ObterResumoMensalAsync(cenario.UsuarioId, 9, 2026);
        var outubro = await service.ObterResumoMensalAsync(cenario.UsuarioId, 10, 2026);

        Assert.Equal(100m, setembro.RecebidoNoMes);
        Assert.Equal(100m, setembro.PrevistoNoMes);
        Assert.Equal(0m, outubro.RecebidoNoMes);
        Assert.Equal(100m, outubro.PrevistoNoMes);
        Assert.Equal(StatusParcelaEmprestimo.Paga, Assert.Single(outubro.Itens).StatusCompetencia);
        Assert.Equal(200m, outubro.AReceberTotal);
    }

    [Fact]
    public async Task ObterResumoMensalAsync_FiltroPorContatoAfetaIndicadoresEItens()
    {
        using var cenario = await CriarCenarioAsync();
        var outroContato = new ContatoEmprestimo { UsuarioId = cenario.UsuarioId, Nome = "Joao" };
        cenario.Database.Context.ContatosEmprestimos.Add(outroContato);
        await cenario.Database.Context.SaveChangesAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 100m, 1));
        var outroRequest = CriarRequest(cenario, 250m, 1);
        outroRequest.ContatoId = outroContato.Id;
        await service.CriarAsync(cenario.UsuarioId, outroRequest);

        var resultado = await service.ObterResumoMensalAsync(
            cenario.UsuarioId,
            8,
            2026,
            outroContato.Id);

        Assert.Equal(250m, resultado.AReceberTotal);
        Assert.Equal(250m, resultado.PrevistoNoMes);
        Assert.Equal(outroContato.Id, Assert.Single(resultado.Itens).ContatoId);
    }

    [Fact]
    public async Task CriarEConsultarAsync_RecusaIdsDeOutroUsuario()
    {
        using var cenario = await CriarCenarioAsync();
        var outroUsuarioId = Guid.NewGuid();
        cenario.Database.Context.Usuarios.Add(CriarUsuario(outroUsuarioId));
        var contatoOutro = new ContatoEmprestimo { UsuarioId = outroUsuarioId, Nome = "Contato externo" };
        var contaOutro = new ContaBancaria
        {
            UsuarioId = outroUsuarioId,
            NomeCustomizado = "Conta externa",
            CodigoBanco = "999",
            SaldoInicial = 0m
        };
        var cartaoOutro = CriarCartao(outroUsuarioId, "Cartao externo");
        cenario.Database.Context.AddRange(contatoOutro, contaOutro, cartaoOutro);
        await cenario.Database.Context.SaveChangesAsync();
        var service = new EmprestimoService(cenario.Database.Context);

        var contatoInvalido = CriarRequest(cenario, 100m, 1);
        contatoInvalido.ContatoId = contatoOutro.Id;
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CriarAsync(cenario.UsuarioId, contatoInvalido));

        var contaInvalida = CriarRequest(cenario, 100m, 1);
        contaInvalida.ContaBancariaId = contaOutro.Id;
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CriarAsync(cenario.UsuarioId, contaInvalida));

        var cartaoInvalido = CriarRequest(cenario, 100m, 2, OrigemFinanceiraEmprestimo.CartaoCredito);
        cartaoInvalido.CartaoCreditoId = cartaoOutro.Id;
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CriarAsync(cenario.UsuarioId, cartaoInvalido));

        var valido = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 100m, 1));
        Assert.Null(await service.ObterAsync(outroUsuarioId, valido.Id));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.RegistrarPagamentoAsync(
                cenario.UsuarioId,
                valido.Id,
                new RegistrarPagamentoEmprestimoRequest
                {
                    Data = new DateOnly(2026, 8, 21),
                    ContaBancariaId = contaOutro.Id
                }));
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_UmaParcelaAtualizaStatusParcial()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 300m, 3));

        var pagamento = await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            CriarPagamento(emprestimo.Parcelas[0].Id));
        var detalhe = await service.ObterAsync(cenario.UsuarioId, emprestimo.Id);

        Assert.NotNull(pagamento);
        Assert.Equal(100m, pagamento.ValorTotal);
        Assert.Equal(StatusEmprestimo.ParcialmentePago, detalhe!.Status);
        Assert.Equal(100m, detalhe.ValorPago);
        Assert.Equal(200m, detalhe.SaldoReceber);
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_VariasParcelasPodeQuitarEmprestimo()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 100m, 3));

        var pagamento = await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            CriarPagamento(emprestimo.Parcelas.Select(parcela => parcela.Id).ToArray()));
        var detalhe = await service.ObterAsync(cenario.UsuarioId, emprestimo.Id);

        Assert.NotNull(pagamento);
        Assert.Equal(100m, pagamento.ValorTotal);
        Assert.Equal(StatusEmprestimo.Pago, detalhe!.Status);
        Assert.Equal(0m, detalhe.SaldoReceber);
        Assert.All(detalhe.Parcelas, parcela => Assert.Equal(StatusParcelaEmprestimo.Paga, parcela.Status));
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_PermiteAnteciparParcelaFutura()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 300m, 3));
        var futura = emprestimo.Parcelas[2];

        await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            new RegistrarPagamentoEmprestimoRequest
            {
                Data = new DateOnly(2026, 8, 21),
                ParcelaIds = new[] { futura.Id }
            });
        var detalhe = await service.ObterAsync(cenario.UsuarioId, emprestimo.Id);

        Assert.Equal(StatusParcelaEmprestimo.Paga, detalhe!.Parcelas[2].Status);
        Assert.Equal(new DateOnly(2026, 8, 21), detalhe.Parcelas[2].DataPagamento);
        Assert.Equal(StatusParcelaEmprestimo.Pendente, detalhe.Parcelas[0].Status);
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_NaoAceitaValorArbitrarioECalculaPelasParcelas()
    {
        Assert.Null(typeof(RegistrarPagamentoEmprestimoRequest).GetProperty("Valor"));
        Assert.Null(typeof(RegistrarPagamentoEmprestimoRequest).GetProperty("ValorTotal"));

        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 100m, 3));

        var pagamento = await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            CriarPagamento(emprestimo.Parcelas[2].Id));

        Assert.NotNull(pagamento);
        Assert.Equal(33.34m, pagamento.ValorTotal);
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_ImpedePagamentoDuplicado()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 300m, 3));
        var request = CriarPagamento(emprestimo.Parcelas[0].Id);
        await service.RegistrarPagamentoAsync(cenario.UsuarioId, emprestimo.Id, request);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.RegistrarPagamentoAsync(cenario.UsuarioId, emprestimo.Id, request));

        Assert.Contains("já foram pagas", exception.Message);
        Assert.Single(cenario.Database.Context.PagamentosEmprestimos);
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_AvistaSemSelecaoQuitaObrigacaoIntegral()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 180m, 1));

        var pagamento = await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            new RegistrarPagamentoEmprestimoRequest { Data = new DateOnly(2026, 8, 22) });
        var detalhe = await service.ObterAsync(cenario.UsuarioId, emprestimo.Id);

        Assert.NotNull(pagamento);
        Assert.Equal(180m, pagamento.ValorTotal);
        Assert.Equal(StatusEmprestimo.Pago, detalhe!.Status);
    }

    [Fact]
    public async Task DesfazerPagamentoAsync_ReabreParcelasERemoveRecebimento()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 300m, 3));
        var pagamento = await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            new RegistrarPagamentoEmprestimoRequest
            {
                Data = new DateOnly(2026, 9, 1),
                ContaBancariaId = cenario.Conta.Id,
                ParcelaIds = emprestimo.Parcelas.Take(2).Select(parcela => parcela.Id).ToArray()
            });

        var resultado = await service.DesfazerPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            pagamento!.Id);

        Assert.NotNull(resultado);
        Assert.Equal(StatusEmprestimo.EmAberto, resultado.Status);
        Assert.Equal(300m, resultado.SaldoReceber);
        Assert.Empty(resultado.Pagamentos);
        Assert.All(resultado.Parcelas, parcela => Assert.Equal(StatusParcelaEmprestimo.Pendente, parcela.Status));
        Assert.DoesNotContain(
            cenario.Database.Context.Transacoes,
            transacao => transacao.PagamentoEmprestimoId == pagamento.Id);
    }

    [Fact]
    public async Task DesfazerPagamentoAsync_PreservaOutrosPagamentosEIsolamentoDoUsuario()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 300m, 3));
        var primeiro = await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            CriarPagamento(emprestimo.Parcelas[0].Id));
        var segundo = await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            CriarPagamento(emprestimo.Parcelas[1].Id));

        Assert.Null(await service.DesfazerPagamentoAsync(
            Guid.NewGuid(),
            emprestimo.Id,
            segundo!.Id));

        var resultado = await service.DesfazerPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            segundo.Id);

        Assert.Equal(StatusEmprestimo.ParcialmentePago, resultado!.Status);
        Assert.Equal(100m, resultado.ValorPago);
        Assert.Equal(200m, resultado.SaldoReceber);
        Assert.Equal(primeiro!.Id, Assert.Single(resultado.Pagamentos).Id);
    }

    [Fact]
    public async Task Arquivamento_OcultaSomenteQuitadosEPodeSerDesfeito()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 100m, 1));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.DefinirArquivamentoAsync(cenario.UsuarioId, emprestimo.Id, true));

        var pagamento = await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            CriarPagamento(emprestimo.Parcelas[0].Id));
        var arquivado = await service.DefinirArquivamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            true);

        Assert.True(arquivado!.IsArquivado);
        Assert.Empty(await service.ListarAsync(cenario.UsuarioId));
        Assert.True(Assert.Single(await service.ListarAsync(
            cenario.UsuarioId,
            incluirArquivados: true)).IsArquivado);
        Assert.Null(await service.DefinirArquivamentoAsync(
            Guid.NewGuid(),
            emprestimo.Id,
            false));

        var restaurado = await service.DefinirArquivamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            false);
        Assert.False(restaurado!.IsArquivado);
        Assert.Single(await service.ListarAsync(cenario.UsuarioId));

        await service.DesfazerPagamentoAsync(cenario.UsuarioId, emprestimo.Id, pagamento!.Id);
    }

    [Fact]
    public async Task CancelarAsync_PreservaHistoricoERecusaEmprestimoComPagamento()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var cancelavel = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 100m, 2));
        var pago = await service.CriarAsync(cenario.UsuarioId, CriarRequest(cenario, 100m, 2));

        Assert.True(await service.CancelarAsync(cenario.UsuarioId, cancelavel.Id));
        var cancelado = await service.ObterAsync(cenario.UsuarioId, cancelavel.Id);
        Assert.Equal(StatusEmprestimo.Cancelado, cancelado!.Status);
        Assert.All(cancelado.Parcelas, parcela => Assert.Equal(StatusParcelaEmprestimo.Cancelada, parcela.Status));

        await service.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            pago.Id,
            CriarPagamento(pago.Parcelas[0].Id));
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CancelarAsync(cenario.UsuarioId, pago.Id));
    }

    [Fact]
    public async Task Contatos_ListagemERemocaoSaoIsoladasPorUsuario()
    {
        using var cenario = await CriarCenarioAsync();
        var outroUsuarioId = Guid.NewGuid();
        cenario.Database.Context.Usuarios.Add(CriarUsuario(outroUsuarioId));
        cenario.Database.Context.ContatosEmprestimos.Add(new ContatoEmprestimo
        {
            UsuarioId = outroUsuarioId,
            Nome = "Contato de outro usuário"
        });
        await cenario.Database.Context.SaveChangesAsync();
        var service = new ContatoEmprestimoService(cenario.Database.Context);

        var criado = await service.CriarAsync(
            cenario.UsuarioId,
            new CriarContatoEmprestimoRequest { Nome = "João" });
        var contatos = await service.ListarAsync(cenario.UsuarioId);

        Assert.Equal(2, contatos.Count);
        Assert.DoesNotContain(contatos, contato => contato.Nome == "Contato de outro usuário");
        Assert.True(await service.RemoverAsync(cenario.UsuarioId, criado.Id));
        Assert.Single(await service.ListarAsync(cenario.UsuarioId));
        Assert.False(await service.RemoverAsync(outroUsuarioId, cenario.Contato.Id));
    }

    [Fact]
    public async Task Fixo_ProjetaMesesSemMaterializarCronogramaInfinito()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var request = CriarRequest(cenario, 119.90m, 1);
        request.Tipo = TipoEmprestimo.Fixo;

        var criado = await service.CriarAsync(cenario.UsuarioId, request);
        var setembro = await service.ObterResumoMensalAsync(cenario.UsuarioId, 9, 2026);
        var outubro = await service.ObterResumoMensalAsync(cenario.UsuarioId, 10, 2026);

        Assert.Single(cenario.Database.Context.ParcelasEmprestimos.Where(item => item.EmprestimoId == criado.Id));
        Assert.Equal(119.90m, setembro.PrevistoNoMes);
        Assert.Equal(119.90m, outubro.PrevistoNoMes);
        Assert.Equal(TipoEmprestimo.Fixo, setembro.Itens.Single().Tipo);
    }

    [Fact]
    public async Task Fixo_AlteracaoPontualNaoAlteraMesSeguinte()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var request = CriarRequest(cenario, 119.90m, 1);
        request.Tipo = TipoEmprestimo.Fixo;
        var criado = await service.CriarAsync(cenario.UsuarioId, request);

        await service.AlterarRecorrenciaAsync(cenario.UsuarioId, criado.Id, new AlteracaoRecorrenciaEmprestimoRequest
        {
            Competencia = new DateOnly(2026, 12, 1),
            Valor = 139.90m,
            Escopo = EscopoAlteracaoRecorrenciaEmprestimo.SomenteCompetencia
        });

        Assert.Equal(139.90m, (await service.ObterResumoMensalAsync(cenario.UsuarioId, 12, 2026)).PrevistoNoMes);
        Assert.Equal(119.90m, (await service.ObterResumoMensalAsync(cenario.UsuarioId, 1, 2027)).PrevistoNoMes);
    }

    [Fact]
    public async Task Fixo_AlteracaoFuturaEEncerramentoPreservamHistorico()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var request = CriarRequest(cenario, 119.90m, 1);
        request.Tipo = TipoEmprestimo.Fixo;
        var criado = await service.CriarAsync(cenario.UsuarioId, request);

        await service.AlterarRecorrenciaAsync(cenario.UsuarioId, criado.Id, new AlteracaoRecorrenciaEmprestimoRequest
        {
            Competencia = new DateOnly(2026, 10, 1),
            Valor = 129.90m,
            Escopo = EscopoAlteracaoRecorrenciaEmprestimo.DestaCompetenciaEmDiante
        });
        await service.EncerrarRecorrenciaAsync(cenario.UsuarioId, criado.Id, new EncerrarRecorrenciaEmprestimoRequest
        {
            UltimaCompetencia = new DateOnly(2026, 12, 1)
        });

        Assert.Equal(119.90m, (await service.ObterResumoMensalAsync(cenario.UsuarioId, 9, 2026)).PrevistoNoMes);
        Assert.Equal(129.90m, (await service.ObterResumoMensalAsync(cenario.UsuarioId, 11, 2026)).PrevistoNoMes);
        Assert.Equal(0m, (await service.ObterResumoMensalAsync(cenario.UsuarioId, 1, 2027)).PrevistoNoMes);
    }

    [Fact]
    public async Task Fixo_PagamentoDeCompetenciaVirtualCalculaValorSemEntradaLivre()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var request = CriarRequest(cenario, 119.90m, 1);
        request.Tipo = TipoEmprestimo.Fixo;
        var criado = await service.CriarAsync(cenario.UsuarioId, request);

        var pagamento = await service.RegistrarPagamentoAsync(cenario.UsuarioId, criado.Id, new RegistrarPagamentoEmprestimoRequest
        {
            Data = new DateOnly(2026, 9, 1),
            Competencias = new[] { new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 1) }
        });

        Assert.NotNull(pagamento);
        Assert.Equal(239.80m, pagamento!.ValorTotal);
        Assert.Equal(2, pagamento.ParcelaIds.Count);
        Assert.Equal(
            StatusParcelaEmprestimo.Paga,
            (await service.ObterResumoMensalAsync(cenario.UsuarioId, 9, 2026)).Itens.Single().StatusCompetencia);
    }

    [Fact]
    public async Task FixoNoCartao_UsaVencimentoCentralDaFatura()
    {
        using var cenario = await CriarCenarioAsync();
        var service = new EmprestimoService(cenario.Database.Context);
        var request = CriarRequest(cenario, 100m, 1, OrigemFinanceiraEmprestimo.CartaoCredito);
        request.Tipo = TipoEmprestimo.Fixo;
        request.Data = new DateOnly(2026, 8, 20);

        await service.CriarAsync(cenario.UsuarioId, request);

        Assert.Equal(0m, (await service.ObterResumoMensalAsync(cenario.UsuarioId, 8, 2026)).PrevistoNoMes);
        Assert.Equal(100m, (await service.ObterResumoMensalAsync(cenario.UsuarioId, 9, 2026)).PrevistoNoMes);
    }

    private static async Task<Cenario> CriarCenarioAsync()
    {
        var usuarioId = Guid.NewGuid();
        var database = new SqliteTestDatabase(usuarioId);
        var usuario = CriarUsuario(usuarioId);
        var contato = new ContatoEmprestimo { UsuarioId = usuarioId, Nome = "Maria" };
        var conta = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Conta principal",
            CodigoBanco = "001",
            SaldoInicial = 0m
        };
        var cartao = CriarCartao(usuarioId, "Cartao principal");
        database.Context.AddRange(usuario, contato, conta, cartao);
        await database.Context.SaveChangesAsync();
        return new Cenario(database, usuarioId, contato, conta, cartao);
    }

    private static CriarEmprestimoRequest CriarRequest(
        Cenario cenario,
        decimal valor,
        int parcelas,
        OrigemFinanceiraEmprestimo origem = OrigemFinanceiraEmprestimo.ContaBancaria)
    {
        return new CriarEmprestimoRequest
        {
            ContatoId = cenario.Contato.Id,
            Descricao = "Valor pago para terceiro",
            ValorTotal = valor,
            Data = new DateOnly(2026, 8, 20),
            OrigemFinanceira = origem,
            ContaBancariaId = origem == OrigemFinanceiraEmprestimo.ContaBancaria ? cenario.Conta.Id : null,
            CartaoCreditoId = origem == OrigemFinanceiraEmprestimo.CartaoCredito ? cenario.Cartao.Id : null,
            QuantidadeParcelas = parcelas
        };
    }

    private static RegistrarPagamentoEmprestimoRequest CriarPagamento(params Guid[] parcelaIds) => new()
    {
        Data = new DateOnly(2026, 9, 1),
        ParcelaIds = parcelaIds
    };

    private static Usuario CriarUsuario(Guid id) => new()
    {
        Id = id,
        Nome = "Usuario Teste",
        Email = $"{id:N}@teste.local",
        SenhaHash = "hash"
    };

    private static CartaoCredito CriarCartao(Guid usuarioId, string nome) => new()
    {
        UsuarioId = usuarioId,
        ApelidoCartao = nome,
        Banco = "Banco teste",
        DiaVencimento = 10,
        MelhorDiaCompra = 5,
        LimiteTotal = 5000m
    };

    private sealed record Cenario(
        SqliteTestDatabase Database,
        Guid UsuarioId,
        ContatoEmprestimo Contato,
        ContaBancaria Conta,
        CartaoCredito Cartao) : IDisposable
    {
        public void Dispose() => Database.Dispose();
    }
}
