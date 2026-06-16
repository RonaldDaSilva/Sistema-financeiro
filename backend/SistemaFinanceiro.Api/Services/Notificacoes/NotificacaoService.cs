using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Notificacoes;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Notificacoes;

public sealed class NotificacaoService : INotificacaoService
{
    private readonly AppDbContext _dbContext;

    public NotificacaoService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<NotificacaoResponse>> GetNaoLidasAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.Notificacoes
            .AsNoTracking()
            .Where(notificacao => notificacao.UsuarioId == usuarioId && !notificacao.Lida)
            .OrderByDescending(notificacao => notificacao.DataCriacao)
            .Take(50)
            .Select(notificacao => new NotificacaoResponse
            {
                Id = notificacao.Id,
                Titulo = notificacao.Titulo,
                Mensagem = notificacao.Mensagem,
                Lida = notificacao.Lida,
                DataCriacao = notificacao.DataCriacao,
                TipoNotificacao = notificacao.TipoNotificacao
            })
            .ToListAsync(cancellationToken);
    }

    public async Task MarcarComoLidasAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        await _dbContext.Notificacoes
            .Where(notificacao => notificacao.UsuarioId == usuarioId && !notificacao.Lida)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(notificacao => notificacao.Lida, true),
                cancellationToken);
    }

    public async Task<ConfiguracoesNotificacaoResponse> ObterConfiguracoesAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var configuracao = await ObterOuCriarConfiguracaoAsync(usuarioId, cancellationToken);
        return MapearConfiguracao(configuracao);
    }

    public async Task<ConfiguracoesNotificacaoResponse> AtualizarConfiguracoesAsync(
        Guid usuarioId,
        AtualizarConfiguracoesNotificacaoRequest request,
        CancellationToken cancellationToken = default)
    {
        var configuracao = await ObterOuCriarConfiguracaoAsync(usuarioId, cancellationToken);

        configuracao.ReceberNotificacoes = request.ReceberNotificacoes;
        configuracao.AvisarVencimento = request.AvisarVencimento;
        configuracao.AvisarMelhorDia = request.AvisarMelhorDia;
        configuracao.DiasAntecedenciaVencimento = request.DiasAntecedenciaVencimento;
        configuracao.PercentualPadraoDivisao = request.PercentualPadraoDivisao;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapearConfiguracao(configuracao);
    }

    private async Task<ConfiguracoesUsuario> ObterOuCriarConfiguracaoAsync(
        Guid usuarioId,
        CancellationToken cancellationToken)
    {
        var configuracao = await _dbContext.ConfiguracoesUsuarios
            .SingleOrDefaultAsync(item => item.UsuarioId == usuarioId, cancellationToken);

        if (configuracao is not null)
        {
            return configuracao;
        }

        configuracao = new ConfiguracoesUsuario { UsuarioId = usuarioId };
        _dbContext.ConfiguracoesUsuarios.Add(configuracao);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return configuracao;
    }

    private static ConfiguracoesNotificacaoResponse MapearConfiguracao(ConfiguracoesUsuario configuracao)
    {
        return new ConfiguracoesNotificacaoResponse
        {
            ReceberNotificacoes = configuracao.ReceberNotificacoes,
            AvisarVencimento = configuracao.AvisarVencimento,
            AvisarMelhorDia = configuracao.AvisarMelhorDia,
            DiasAntecedenciaVencimento = configuracao.DiasAntecedenciaVencimento,
            PercentualPadraoDivisao = configuracao.PercentualPadraoDivisao
        };
    }
}
