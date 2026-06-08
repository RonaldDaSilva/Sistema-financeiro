using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Notificacoes;

public sealed class NotificacaoBackgroundService : BackgroundService
{
    private static readonly TimeOnly HorarioExecucao = new(1, 0);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificacaoBackgroundService> _logger;

    public NotificacaoBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<NotificacaoBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = CalcularDelayAteProximaExecucao();
            await Task.Delay(delay, stoppingToken);

            try
            {
                await ProcessarNotificacoesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falha ao processar notificações automáticas.");
            }
        }
    }

    private async Task ProcessarNotificacoesAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hoje = DateOnly.FromDateTime(DateTime.Today);

        var usuarios = await dbContext.Usuarios
            .AsNoTracking()
            .OrderBy(usuario => usuario.Nome)
            .ToListAsync(cancellationToken);

        foreach (var usuario in usuarios)
        {
            var configuracao = await ObterOuCriarConfiguracaoAsync(
                dbContext,
                usuario.Id,
                cancellationToken);

            if (!configuracao.ReceberNotificacoes)
            {
                continue;
            }

            if (configuracao.AvisarMelhorDia)
            {
                await GerarAvisosMelhorDiaAsync(dbContext, usuario.Id, hoje, cancellationToken);
            }

            if (configuracao.AvisarVencimento)
            {
                await GerarAvisosVencimentoAsync(
                    dbContext,
                    usuario.Id,
                    hoje,
                    Math.Max(0, configuracao.DiasAntecedenciaVencimento),
                    cancellationToken);
            }
        }
    }

    private static async Task<ConfiguracoesUsuario> ObterOuCriarConfiguracaoAsync(
        AppDbContext dbContext,
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var configuracao = await dbContext.ConfiguracoesUsuarios
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.UsuarioId == usuarioId, cancellationToken);

        if (configuracao is not null)
        {
            return configuracao;
        }

        configuracao = new ConfiguracoesUsuario { UsuarioId = usuarioId };
        dbContext.ConfiguracoesUsuarios.Add(configuracao);
        await dbContext.SaveChangesAsync(cancellationToken);
        return configuracao;
    }

    private static async Task GerarAvisosMelhorDiaAsync(
        AppDbContext dbContext,
        Guid usuarioId,
        DateOnly hoje,
        CancellationToken cancellationToken)
    {
        var cartoes = await dbContext.CartoesCredito
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(cartao =>
                cartao.UsuarioId == usuarioId &&
                cartao.MelhorDiaCompra == hoje.Day)
            .ToListAsync(cancellationToken);

        foreach (var cartao in cartoes)
        {
            await CriarNotificacaoSeNaoExistirAsync(
                dbContext,
                usuarioId,
                TipoNotificacao.MelhorDiaCompra,
                $"Melhor dia para compra - {cartao.ApelidoCartao}",
                $"Hoje é o melhor dia para comprar no cartão {cartao.ApelidoCartao}.",
                hoje,
                cancellationToken);
        }
    }

    private static async Task GerarAvisosVencimentoAsync(
        AppDbContext dbContext,
        Guid usuarioId,
        DateOnly hoje,
        int diasAntecedencia,
        CancellationToken cancellationToken)
    {
        var datasAlvo = new[] { hoje, hoje.AddDays(diasAntecedencia) }
            .Distinct()
            .ToList();

        await GerarAvisosContasFixasAsync(dbContext, usuarioId, hoje, datasAlvo, cancellationToken);
        await GerarAvisosCarneAsync(dbContext, usuarioId, hoje, datasAlvo, cancellationToken);
        await GerarAvisosFaturasAsync(dbContext, usuarioId, hoje, datasAlvo, cancellationToken);
    }

    private static async Task GerarAvisosContasFixasAsync(
        AppDbContext dbContext,
        Guid usuarioId,
        DateOnly hoje,
        IReadOnlyList<DateOnly> datasAlvo,
        CancellationToken cancellationToken)
    {
        var contasFixas = await dbContext.Transacoes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(transacao =>
                transacao.UsuarioId == usuarioId &&
                transacao.IsFixa &&
                transacao.Tipo == TipoTransacao.Despesa &&
                transacao.CartaoCreditoId == null)
            .ToListAsync(cancellationToken);

        foreach (var conta in contasFixas)
        {
            foreach (var dataVencimento in datasAlvo)
            {
                if (conta.DataOcorrencia > dataVencimento)
                {
                    continue;
                }

                var dataProjetada = CriarDataNoMes(dataVencimento.Year, dataVencimento.Month, conta.DataOcorrencia.Day);
                if (dataProjetada != dataVencimento)
                {
                    continue;
                }

                var existePagamento = await dbContext.Transacoes
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .AnyAsync(transacao =>
                        transacao.UsuarioId == usuarioId &&
                        !transacao.IsFixa &&
                        transacao.Tipo == TipoTransacao.Despesa &&
                        transacao.DataOcorrencia == dataVencimento &&
                        transacao.Descricao == conta.Descricao &&
                        transacao.Valor == conta.Valor,
                        cancellationToken);

                if (existePagamento)
                {
                    continue;
                }

                await CriarNotificacaoSeNaoExistirAsync(
                    dbContext,
                    usuarioId,
                    TipoNotificacao.Vencimento,
                    $"Vencimento - {conta.Descricao}",
                    CriarMensagemVencimento(conta.Descricao, dataVencimento, hoje),
                    hoje,
                    cancellationToken);
            }
        }
    }

    private static async Task GerarAvisosCarneAsync(
        AppDbContext dbContext,
        Guid usuarioId,
        DateOnly hoje,
        IReadOnlyList<DateOnly> datasAlvo,
        CancellationToken cancellationToken)
    {
        var comprasCarne = await dbContext.ComprasParceladas
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(compra =>
                compra.UsuarioId == usuarioId &&
                compra.FormaPagamento == FormaPagamentoCompraParcelada.Carne &&
                compra.DataPrimeiroVencimento.HasValue)
            .ToListAsync(cancellationToken);

        foreach (var compra in comprasCarne)
        {
            var primeiroVencimento = compra.DataPrimeiroVencimento!.Value;

            for (var numeroParcela = 1; numeroParcela <= compra.QuantidadeParcelas; numeroParcela++)
            {
                var dataVencimento = primeiroVencimento.AddMonths(numeroParcela - 1);
                if (!datasAlvo.Contains(dataVencimento))
                {
                    continue;
                }

                var parcelaQuitada = await dbContext.Transacoes
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .AnyAsync(transacao =>
                        transacao.UsuarioId == usuarioId &&
                        transacao.CompraParceladaId == compra.Id &&
                        transacao.NumeroParcelaQuitada == numeroParcela,
                        cancellationToken);

                if (parcelaQuitada)
                {
                    continue;
                }

                await CriarNotificacaoSeNaoExistirAsync(
                    dbContext,
                    usuarioId,
                    TipoNotificacao.Vencimento,
                    $"Vencimento carnê - {compra.Descricao}",
                    CriarMensagemVencimento(
                        $"{compra.Descricao} ({numeroParcela}/{compra.QuantidadeParcelas})",
                        dataVencimento,
                        hoje),
                    hoje,
                    cancellationToken);
            }
        }
    }

    private static async Task GerarAvisosFaturasAsync(
        AppDbContext dbContext,
        Guid usuarioId,
        DateOnly hoje,
        IReadOnlyList<DateOnly> datasAlvo,
        CancellationToken cancellationToken)
    {
        var cartoes = await dbContext.CartoesCredito
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(cartao => cartao.UsuarioId == usuarioId)
            .ToListAsync(cancellationToken);

        foreach (var cartao in cartoes)
        {
            foreach (var dataVencimento in datasAlvo)
            {
                var vencimentoCartao = CriarDataNoMes(dataVencimento.Year, dataVencimento.Month, cartao.DiaVencimento);
                if (vencimentoCartao != dataVencimento)
                {
                    continue;
                }

                var faturaPaga = await dbContext.Transacoes
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .AnyAsync(transacao =>
                        transacao.UsuarioId == usuarioId &&
                        transacao.CartaoCreditoId == cartao.Id &&
                        transacao.DataOcorrencia == dataVencimento &&
                        transacao.FormaPagamento == "Fatura de cartão",
                        cancellationToken);

                if (faturaPaga)
                {
                    continue;
                }

                await CriarNotificacaoSeNaoExistirAsync(
                    dbContext,
                    usuarioId,
                    TipoNotificacao.Vencimento,
                    $"Vencimento fatura - {cartao.ApelidoCartao}",
                    CriarMensagemVencimento($"Fatura do cartão {cartao.ApelidoCartao}", dataVencimento, hoje),
                    hoje,
                    cancellationToken);
            }
        }
    }

    private static async Task CriarNotificacaoSeNaoExistirAsync(
        AppDbContext dbContext,
        Guid usuarioId,
        TipoNotificacao tipo,
        string titulo,
        string mensagem,
        DateOnly dataReferencia,
        CancellationToken cancellationToken)
    {
        var inicioDia = dataReferencia.ToDateTime(TimeOnly.MinValue);
        var fimDia = dataReferencia.ToDateTime(TimeOnly.MaxValue);

        var jaExiste = await dbContext.Notificacoes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(notificacao =>
                notificacao.UsuarioId == usuarioId &&
                notificacao.TipoNotificacao == tipo &&
                notificacao.Titulo == titulo &&
                notificacao.Mensagem == mensagem &&
                notificacao.DataCriacao >= inicioDia &&
                notificacao.DataCriacao <= fimDia,
                cancellationToken);

        if (jaExiste)
        {
            return;
        }

        dbContext.Notificacoes.Add(new Notificacao
        {
            UsuarioId = usuarioId,
            TipoNotificacao = tipo,
            Titulo = titulo,
            Mensagem = mensagem,
            DataCriacao = DateTimeOffset.UtcNow,
            Lida = false
        });

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string CriarMensagemVencimento(string descricao, DateOnly dataVencimento, DateOnly hoje)
    {
        return dataVencimento == hoje
            ? $"{descricao} vence hoje."
            : $"{descricao} vence em {dataVencimento:dd/MM/yyyy}.";
    }

    private static DateOnly CriarDataNoMes(int ano, int mes, int dia)
    {
        var ultimoDia = DateTime.DaysInMonth(ano, mes);
        return new DateOnly(ano, mes, Math.Min(dia, ultimoDia));
    }

    private static TimeSpan CalcularDelayAteProximaExecucao()
    {
        var agora = DateTimeOffset.Now;
        var proximaExecucao = new DateTimeOffset(
            agora.Year,
            agora.Month,
            agora.Day,
            HorarioExecucao.Hour,
            HorarioExecucao.Minute,
            0,
            agora.Offset);

        if (proximaExecucao <= agora)
        {
            proximaExecucao = proximaExecucao.AddDays(1);
        }

        return proximaExecucao - agora;
    }
}
