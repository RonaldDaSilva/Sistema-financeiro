using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Emprestimos;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.CartoesCredito;
using SistemaFinanceiro.Api.Services.ContasBancarias;
using SistemaFinanceiro.Api.Services.Emprestimos;
using SistemaFinanceiro.Api.Services.Relatorios;
using SistemaFinanceiro.Api.Services.Transacoes;
using SistemaFinanceiro.Api.Tests.Infrastructure;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class EmprestimoIntegracaoFinanceiraTests
{
    [Fact]
    public async Task CartaoAvista_EntraNaFaturaELimiteMasNaoNoConsumoPessoal()
    {
        using var cenario = await CriarCenarioAsync();
        var transacaoService = new TransacaoService(cenario.Database.Context);
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        var relatorioService = CriarRelatorioService(cenario.Database.Context, transacaoService);
        var cartaoService = new CartaoCreditoService(cenario.Database.Context, transacaoService);
        cenario.Database.Context.Transacoes.Add(new Transacao
        {
            CodigoExibicao = 1,
            UsuarioId = cenario.UsuarioId,
            Tipo = TipoTransacao.Despesa,
            Descricao = "Compra pessoal",
            Valor = 2000m,
            DataOcorrencia = new DateOnly(2026, 8, 20),
            Categoria = cenario.Categoria,
            CartaoCredito = cenario.Cartao,
            FormaPagamento = "Cartão de crédito"
        });
        await cenario.Database.Context.SaveChangesAsync();

        var emprestimo = await emprestimoService.CriarAsync(
            cenario.UsuarioId,
            CriarEmprestimoCartao(cenario, 1000m, 1));

        var fatura = (await transacaoService.GetFaturasDoMesAsync(8, 2026, cenario.UsuarioId))
            .Single(item => item.CartaoCreditoId == cenario.Cartao.Id);
        var cartao = await cartaoService.ObterPorIdAsync(cenario.Cartao.Id, cenario.UsuarioId);
        var resumo = await relatorioService.GetResumoMensalAsync(8, 2026, cenario.UsuarioId);

        Assert.Equal(3000m, fatura.ValorTotal);
        var detalheEmprestimo = Assert.Single(
            fatura.Detalhes,
            item => item.EmprestimoId == emprestimo.Id);
        Assert.Equal(OrigemTransacao.EmprestimoConcedido, detalheEmprestimo.OrigemTransacao);
        Assert.Equal(1000m, detalheEmprestimo.Valor);
        Assert.Equal(3000m, cartao!.ValorUtilizado);
        Assert.Equal(7000m, cartao.LimiteDisponivel);
        Assert.Equal(2000m, resumo.DespesasPrevistas);
        Assert.Equal(2000m, Assert.Single(resumo.DespesasPorCategoria).Valor);
        Assert.Equal(1000m, emprestimo.SaldoReceber);
    }

    [Fact]
    public async Task CartaoParcelado_UsaDozeCompetenciasSemAlterarResumoPessoal()
    {
        using var cenario = await CriarCenarioAsync();
        var transacaoService = new TransacaoService(cenario.Database.Context);
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        var relatorioService = CriarRelatorioService(cenario.Database.Context, transacaoService);

        var emprestimo = await emprestimoService.CriarAsync(
            cenario.UsuarioId,
            CriarEmprestimoCartao(cenario, 1200m, 12));

        var valoresFaturas = new List<decimal>();
        for (var indice = 0; indice < 12; indice++)
        {
            var referencia = new DateOnly(2026, 8, 1).AddMonths(indice);
            var fatura = (await transacaoService.GetFaturasDoMesAsync(
                    referencia.Month,
                    referencia.Year,
                    cenario.UsuarioId))
                .Single(item => item.CartaoCreditoId == cenario.Cartao.Id);
            valoresFaturas.Add(fatura.Detalhes
                .Where(item => item.EmprestimoId == emprestimo.Id)
                .Sum(item => item.Valor));
        }

        var agosto = await relatorioService.GetResumoMensalAsync(8, 2026, cenario.UsuarioId);

        Assert.Equal(12, emprestimo.Parcelas.Count);
        Assert.All(valoresFaturas, valor => Assert.Equal(100m, valor));
        Assert.Equal(1200m, valoresFaturas.Sum());
        Assert.Equal(0m, agosto.DespesasPrevistas);
        Assert.Equal(0m, agosto.SobraPrevista);
        Assert.Empty(agosto.DespesasPorCategoria);
    }

    [Fact]
    public async Task ContaERecebimento_MovemSaldoSemVirarDespesaOuReceitaPessoal()
    {
        using var cenario = await CriarCenarioAsync(saldoInicial: 5000m);
        var transacaoService = new TransacaoService(cenario.Database.Context);
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        var contaService = new ContaBancariaService(cenario.Database.Context);
        var relatorioService = CriarRelatorioService(cenario.Database.Context, transacaoService);

        var emprestimo = await emprestimoService.CriarAsync(
            cenario.UsuarioId,
            CriarEmprestimoConta(cenario, 500m, 5));
        var saldoAposConcessao = Assert.Single(await contaService.ObterDistribuicaoAsync(cenario.UsuarioId));
        var resumoConcessao = await relatorioService.GetResumoMensalAsync(8, 2026, cenario.UsuarioId);

        var pagamento = await emprestimoService.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            new RegistrarPagamentoEmprestimoRequest
            {
                Data = new DateOnly(2026, 9, 1),
                ContaBancariaId = cenario.Conta.Id,
                ParcelaIds = new[] { emprestimo.Parcelas[0].Id }
            });
        var saldoAposRecebimento = Assert.Single(await contaService.ObterDistribuicaoAsync(cenario.UsuarioId));
        var resumoRecebimento = await relatorioService.GetResumoMensalAsync(9, 2026, cenario.UsuarioId);
        var detalhe = await emprestimoService.ObterAsync(cenario.UsuarioId, emprestimo.Id);

        Assert.Equal(4500m, saldoAposConcessao.SaldoAtual);
        Assert.Equal(0m, resumoConcessao.DespesasPrevistas);
        Assert.Empty(resumoConcessao.DespesasPorCategoria);
        Assert.Equal(100m, pagamento!.ValorTotal);
        Assert.Equal(4600m, saldoAposRecebimento.SaldoAtual);
        Assert.Equal(0m, resumoRecebimento.ReceitasRealizadas);
        Assert.Equal(0m, resumoRecebimento.ReceitasPrevistas);
        Assert.Equal(400m, detalhe!.SaldoReceber);
    }

    [Fact]
    public async Task PagamentoTotal_ZeraAReceberERestauraSaldoReal()
    {
        using var cenario = await CriarCenarioAsync(saldoInicial: 5000m);
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        var contaService = new ContaBancariaService(cenario.Database.Context);
        var emprestimo = await emprestimoService.CriarAsync(
            cenario.UsuarioId,
            CriarEmprestimoConta(cenario, 500m, 5));

        await emprestimoService.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            new RegistrarPagamentoEmprestimoRequest
            {
                Data = new DateOnly(2026, 9, 1),
                ContaBancariaId = cenario.Conta.Id,
                ParcelaIds = emprestimo.Parcelas.Select(item => item.Id).ToList()
            });

        var detalhe = await emprestimoService.ObterAsync(cenario.UsuarioId, emprestimo.Id);
        var conta = Assert.Single(await contaService.ObterDistribuicaoAsync(cenario.UsuarioId));
        Assert.Equal(StatusEmprestimo.Pago, detalhe!.Status);
        Assert.Equal(0m, detalhe.SaldoReceber);
        Assert.Equal(5000m, conta.SaldoAtual);
    }

    [Fact]
    public async Task DesfazerPagamento_ReabreValorAReceberERemoveEntradaDaConta()
    {
        using var cenario = await CriarCenarioAsync(saldoInicial: 5000m);
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        var contaService = new ContaBancariaService(cenario.Database.Context);
        var emprestimo = await emprestimoService.CriarAsync(
            cenario.UsuarioId,
            CriarEmprestimoConta(cenario, 500m, 5));
        var pagamento = await emprestimoService.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            new RegistrarPagamentoEmprestimoRequest
            {
                Data = new DateOnly(2026, 9, 1),
                ContaBancariaId = cenario.Conta.Id,
                ParcelaIds = new[] { emprestimo.Parcelas[0].Id }
            });

        var antes = Assert.Single(await contaService.ObterDistribuicaoAsync(cenario.UsuarioId));
        var detalhe = await emprestimoService.DesfazerPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            pagamento!.Id);
        var depois = Assert.Single(await contaService.ObterDistribuicaoAsync(cenario.UsuarioId));

        Assert.Equal(4600m, antes.SaldoAtual);
        Assert.Equal(4500m, depois.SaldoAtual);
        Assert.Equal(500m, detalhe!.SaldoReceber);
        Assert.Equal(StatusEmprestimo.EmAberto, detalhe.Status);
    }

    [Fact]
    public async Task ResumoMensal_EmprestimoEPagamentoFaturaNaoAlteramKpisPessoais()
    {
        using var cenario = await CriarCenarioAsync(saldoInicial: 10000m);
        var transacaoService = new TransacaoService(cenario.Database.Context);
        var relatorioService = CriarRelatorioService(cenario.Database.Context, transacaoService);
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        cenario.Database.Context.Transacoes.AddRange(
            new Transacao
            {
                CodigoExibicao = 1,
                UsuarioId = cenario.UsuarioId,
                Tipo = TipoTransacao.Receita,
                Descricao = "Salário",
                Valor = 5000m,
                DataOcorrencia = new DateOnly(2026, 8, 5),
                ContaBancaria = cenario.Conta,
                FormaPagamento = "Pix",
                IsPaga = true
            },
            new Transacao
            {
                CodigoExibicao = 2,
                UsuarioId = cenario.UsuarioId,
                Tipo = TipoTransacao.Despesa,
                Descricao = "Despesa pessoal no cartão",
                Valor = 2000m,
                DataOcorrencia = new DateOnly(2026, 8, 20),
                Categoria = cenario.Categoria,
                CartaoCredito = cenario.Cartao,
                FormaPagamento = "Cartão de crédito",
                IsPaga = true
            },
            new Transacao
            {
                CodigoExibicao = 3,
                UsuarioId = cenario.UsuarioId,
                Tipo = TipoTransacao.Despesa,
                Descricao = "Despesa pessoal na conta",
                Valor = 2000m,
                DataOcorrencia = new DateOnly(2026, 8, 10),
                Categoria = cenario.Categoria,
                ContaBancaria = cenario.Conta,
                FormaPagamento = "Pix",
                IsPaga = true
            });
        await cenario.Database.Context.SaveChangesAsync();
        var antes = await relatorioService.GetResumoMensalAsync(8, 2026, cenario.UsuarioId);

        await emprestimoService.CriarAsync(
            cenario.UsuarioId,
            CriarEmprestimoCartao(cenario, 600m, 1));
        cenario.Database.Context.Transacoes.Add(new Transacao
        {
            CodigoExibicao = 5,
            UsuarioId = cenario.UsuarioId,
            Tipo = TipoTransacao.Despesa,
            Descricao = "Pagamento da fatura",
            Valor = 2600m,
            DataOcorrencia = new DateOnly(2026, 8, 30),
            ContaBancaria = cenario.Conta,
            CartaoCredito = cenario.Cartao,
            FormaPagamento = "Pagamento de fatura",
            IsPaga = true
        });
        await cenario.Database.Context.SaveChangesAsync();

        var depois = await relatorioService.GetResumoMensalAsync(8, 2026, cenario.UsuarioId);
        var fatura = (await transacaoService.GetFaturasDoMesAsync(8, 2026, cenario.UsuarioId))
            .Single(item => item.CartaoCreditoId == cenario.Cartao.Id);

        Assert.Equal(2600m, fatura.ValorTotal);
        Assert.Equal(antes.ReceitasRealizadas, depois.ReceitasRealizadas);
        Assert.Equal(antes.DespesasRealizadas, depois.DespesasRealizadas);
        Assert.Equal(antes.DespesasPrevistas, depois.DespesasPrevistas);
        Assert.Equal(antes.SobraPrevista, depois.SobraPrevista);
        Assert.Equal(5000m, depois.ReceitasRealizadas);
        Assert.Equal(4000m, depois.DespesasPrevistas);
        Assert.Equal(1000m, depois.SobraPrevista);
        Assert.Equal(4000m, Assert.Single(depois.DespesasPorCategoria).Valor);
    }

    [Fact]
    public async Task Excluir_CartaoAvista_RestauraFaturaELimiteSemAlterarOutraCompra()
    {
        using var cenario = await CriarCenarioAsync();
        var transacaoService = new TransacaoService(cenario.Database.Context);
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        var cartaoService = new CartaoCreditoService(cenario.Database.Context, transacaoService);
        cenario.Database.Context.Transacoes.Add(new Transacao
        {
            CodigoExibicao = 1,
            UsuarioId = cenario.UsuarioId,
            Tipo = TipoTransacao.Despesa,
            Descricao = "Compra pessoal preservada",
            Valor = 200m,
            DataOcorrencia = new DateOnly(2026, 8, 20),
            Categoria = cenario.Categoria,
            CartaoCredito = cenario.Cartao,
            FormaPagamento = "Cartão de crédito"
        });
        await cenario.Database.Context.SaveChangesAsync();
        var emprestimo = await emprestimoService.CriarAsync(
            cenario.UsuarioId,
            CriarEmprestimoCartao(cenario, 1000m, 1));

        Assert.True(await emprestimoService.ExcluirAsync(cenario.UsuarioId, emprestimo.Id));

        var fatura = (await transacaoService.GetFaturasDoMesAsync(8, 2026, cenario.UsuarioId))
            .Single(item => item.CartaoCreditoId == cenario.Cartao.Id);
        var cartao = await cartaoService.ObterPorIdAsync(cenario.Cartao.Id, cenario.UsuarioId);
        Assert.Equal(200m, fatura.ValorTotal);
        Assert.DoesNotContain(fatura.Detalhes, item => item.EmprestimoId == emprestimo.Id);
        Assert.Equal(200m, cartao!.ValorUtilizado);
        Assert.Equal(9800m, cartao.LimiteDisponivel);
        Assert.Null(await emprestimoService.ObterAsync(cenario.UsuarioId, emprestimo.Id));
    }

    [Fact]
    public async Task Excluir_CartaoParcelado_RemoveTodasAsCompetenciasDoEmprestimo()
    {
        using var cenario = await CriarCenarioAsync();
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        var emprestimo = await emprestimoService.CriarAsync(
            cenario.UsuarioId,
            CriarEmprestimoCartao(cenario, 1200m, 12));

        Assert.Equal(12, cenario.Database.Context.Transacoes.Count(item => item.EmprestimoId == emprestimo.Id));
        Assert.True(await emprestimoService.ExcluirAsync(cenario.UsuarioId, emprestimo.Id));

        Assert.Empty(cenario.Database.Context.Transacoes.Where(item => item.EmprestimoId == emprestimo.Id));
        Assert.Empty(cenario.Database.Context.ParcelasEmprestimos.Where(item => item.EmprestimoId == emprestimo.Id));
        Assert.Null(await emprestimoService.ObterAsync(cenario.UsuarioId, emprestimo.Id));
    }

    [Fact]
    public async Task Excluir_Conta_RestauraSaldoRemovendoSomenteSaidaDoEmprestimo()
    {
        using var cenario = await CriarCenarioAsync(saldoInicial: 5000m);
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        var contaService = new ContaBancariaService(cenario.Database.Context);
        var emprestimo = await emprestimoService.CriarAsync(
            cenario.UsuarioId,
            CriarEmprestimoConta(cenario, 500m, 1));
        Assert.Equal(4500m, Assert.Single(await contaService.ObterDistribuicaoAsync(cenario.UsuarioId)).SaldoAtual);

        Assert.True(await emprestimoService.ExcluirAsync(cenario.UsuarioId, emprestimo.Id));

        Assert.Equal(5000m, Assert.Single(await contaService.ObterDistribuicaoAsync(cenario.UsuarioId)).SaldoAtual);
        Assert.Empty(cenario.Database.Context.Transacoes.Where(item => item.EmprestimoId == emprestimo.Id));
    }

    [Fact]
    public async Task Excluir_ComRecebimento_BloqueiaEPreservaEntradaNaConta()
    {
        using var cenario = await CriarCenarioAsync(saldoInicial: 5000m);
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        var contaService = new ContaBancariaService(cenario.Database.Context);
        var emprestimo = await emprestimoService.CriarAsync(
            cenario.UsuarioId,
            CriarEmprestimoConta(cenario, 500m, 5));
        var pagamento = await emprestimoService.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            emprestimo.Id,
            new RegistrarPagamentoEmprestimoRequest
            {
                Data = new DateOnly(2026, 9, 1),
                ContaBancariaId = cenario.Conta.Id,
                ParcelaIds = new[] { emprestimo.Parcelas[0].Id }
            });

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => emprestimoService.ExcluirAsync(cenario.UsuarioId, emprestimo.Id));

        Assert.Contains("pagamentos registrados", exception.Message);
        Assert.NotNull(await emprestimoService.ObterAsync(cenario.UsuarioId, emprestimo.Id));
        Assert.Contains(
            cenario.Database.Context.Transacoes,
            item => item.PagamentoEmprestimoId == pagamento!.Id);
        Assert.Equal(4600m, Assert.Single(await contaService.ObterDistribuicaoAsync(cenario.UsuarioId)).SaldoAtual);
    }

    [Fact]
    public async Task Excluir_FixoSemHistorico_RemoveProjecoesEFixoComHistoricoPermanece()
    {
        using var cenario = await CriarCenarioAsync();
        var emprestimoService = new EmprestimoService(cenario.Database.Context);
        var requestSemHistorico = CriarEmprestimoConta(cenario, 100m, 1);
        requestSemHistorico.Tipo = TipoEmprestimo.Fixo;
        var semHistorico = await emprestimoService.CriarAsync(cenario.UsuarioId, requestSemHistorico);
        Assert.True(await emprestimoService.ExcluirAsync(cenario.UsuarioId, semHistorico.Id));
        Assert.Equal(0m, (await emprestimoService.ObterResumoMensalAsync(cenario.UsuarioId, 10, 2026)).PrevistoNoMes);

        var requestComHistorico = CriarEmprestimoConta(cenario, 100m, 1);
        requestComHistorico.Tipo = TipoEmprestimo.Fixo;
        var comHistorico = await emprestimoService.CriarAsync(cenario.UsuarioId, requestComHistorico);
        await emprestimoService.RegistrarPagamentoAsync(
            cenario.UsuarioId,
            comHistorico.Id,
            new RegistrarPagamentoEmprestimoRequest
            {
                Data = new DateOnly(2026, 8, 25),
                Competencias = new[] { new DateOnly(2026, 8, 1) }
            });

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => emprestimoService.ExcluirAsync(cenario.UsuarioId, comHistorico.Id));
        Assert.NotNull(await emprestimoService.ObterAsync(cenario.UsuarioId, comHistorico.Id));
    }

    private static RelatorioService CriarRelatorioService(AppDbContext context, TransacaoService transacaoService) =>
        new(context, new ContaBancariaService(context), transacaoService);

    private static CriarEmprestimoRequest CriarEmprestimoCartao(Cenario cenario, decimal valor, int parcelas) => new()
    {
        ContatoId = cenario.Contato.Id,
        Descricao = "Empréstimo no cartão",
        ValorTotal = valor,
        Data = new DateOnly(2026, 8, 20),
        OrigemFinanceira = OrigemFinanceiraEmprestimo.CartaoCredito,
        CartaoCreditoId = cenario.Cartao.Id,
        QuantidadeParcelas = parcelas
    };

    private static CriarEmprestimoRequest CriarEmprestimoConta(Cenario cenario, decimal valor, int parcelas) => new()
    {
        ContatoId = cenario.Contato.Id,
        Descricao = "Empréstimo via conta",
        ValorTotal = valor,
        Data = new DateOnly(2026, 8, 20),
        OrigemFinanceira = OrigemFinanceiraEmprestimo.ContaBancaria,
        ContaBancariaId = cenario.Conta.Id,
        QuantidadeParcelas = parcelas
    };

    private static async Task<Cenario> CriarCenarioAsync(decimal saldoInicial = 0m)
    {
        var usuarioId = Guid.NewGuid();
        var database = new SqliteTestDatabase(usuarioId);
        var usuario = new Usuario
        {
            Id = usuarioId,
            Nome = "Usuário teste",
            Email = $"{usuarioId:N}@teste.local",
            SenhaHash = "hash"
        };
        var contato = new ContatoEmprestimo { UsuarioId = usuarioId, Nome = "Maria" };
        var conta = new ContaBancaria
        {
            UsuarioId = usuarioId,
            NomeCustomizado = "Conta principal",
            CodigoBanco = "001",
            SaldoInicial = saldoInicial
        };
        var cartao = new CartaoCredito
        {
            UsuarioId = usuarioId,
            ApelidoCartao = "Cartão principal",
            Banco = "Banco teste",
            DiaVencimento = 30,
            MelhorDiaCompra = 25,
            LimiteTotal = 10000m
        };
        var categoria = new Categoria
        {
            UsuarioId = usuarioId,
            Nome = "Pessoal",
            CorHexa = "#2563EB"
        };
        database.Context.AddRange(usuario, contato, conta, cartao, categoria);
        await database.Context.SaveChangesAsync();
        return new Cenario(database, usuarioId, contato, conta, cartao, categoria);
    }

    private sealed record Cenario(
        SqliteTestDatabase Database,
        Guid UsuarioId,
        ContatoEmprestimo Contato,
        ContaBancaria Conta,
        CartaoCredito Cartao,
        Categoria Categoria) : IDisposable
    {
        public void Dispose() => Database.Dispose();
    }
}
