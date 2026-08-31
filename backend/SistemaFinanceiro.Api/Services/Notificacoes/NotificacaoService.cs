using System.Linq.Expressions;
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

    public async Task<NotificacoesPaginadasResponse> ListarAsync(
        Guid usuarioId,
        ListarNotificacoesRequest request,
        CancellationToken cancellationToken = default)
    {
        var filtro = NormalizarFiltro(request.Filtro);
        var categoria = NormalizarCategoria(request.Categoria);
        var query = _dbContext.Notificacoes
            .AsNoTracking()
            .Where(notificacao => notificacao.UsuarioId == usuarioId);

        query = filtro switch
        {
            "NaoLidas" => query.Where(notificacao => !notificacao.Lida),
            "Pendentes" => query.Where(notificacao => notificacao.AcaoPendente != null),
            "Concluidas" => query.Where(notificacao =>
                notificacao.AcaoPendente == null && notificacao.Entidade != null),
            _ => query
        };

        query = categoria switch
        {
            "Divisoes" => query.Where(notificacao =>
                notificacao.TipoNotificacao == TipoNotificacao.DivisaoRecebida ||
                notificacao.TipoNotificacao == TipoNotificacao.DivisaoAceita ||
                notificacao.TipoNotificacao == TipoNotificacao.DivisaoRecusada ||
                notificacao.TipoNotificacao == TipoNotificacao.DivisaoExpirada ||
                notificacao.TipoNotificacao == TipoNotificacao.DivisaoCancelada ||
                notificacao.TipoNotificacao == TipoNotificacao.DivisaoAlterada ||
                notificacao.TipoNotificacao == TipoNotificacao.AlteracaoDivisaoAceita ||
                notificacao.TipoNotificacao == TipoNotificacao.AlteracaoDivisaoRecusada),
            "Sistema" => query.Where(notificacao =>
                notificacao.TipoNotificacao == TipoNotificacao.Vencimento ||
                notificacao.TipoNotificacao == TipoNotificacao.MelhorDiaCompra),
            "Emprestimos" => query.Where(_ => false),
            _ => query
        };

        var totalItens = await query.CountAsync(cancellationToken);
        var itens = await OrdenarPorMaisRecentes(query)
            .Skip((request.Pagina - 1) * request.TamanhoPagina)
            .Take(request.TamanhoPagina)
            .Select(Projecao)
            .ToListAsync(cancellationToken);

        return new NotificacoesPaginadasResponse
        {
            Itens = itens,
            Pagina = request.Pagina,
            TamanhoPagina = request.TamanhoPagina,
            TotalItens = totalItens,
            TotalPaginas = totalItens == 0
                ? 0
                : (int)Math.Ceiling(totalItens / (double)request.TamanhoPagina)
        };
    }

    public async Task<IReadOnlyList<NotificacaoResponse>> GetNaoLidasAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Notificacoes
            .AsNoTracking()
            .Where(notificacao => notificacao.UsuarioId == usuarioId && !notificacao.Lida)
            .AsQueryable();

        return await OrdenarPorMaisRecentes(query)
            .Take(10)
            .Select(Projecao)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> MarcarComoLidaAsync(
        Guid usuarioId,
        Guid notificacaoId,
        CancellationToken cancellationToken = default)
    {
        var atualizadas = await _dbContext.Notificacoes
            .Where(notificacao =>
                notificacao.Id == notificacaoId &&
                notificacao.UsuarioId == usuarioId &&
                !notificacao.Lida)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(notificacao => notificacao.Lida, true),
                cancellationToken);

        if (atualizadas > 0)
        {
            return true;
        }

        return await _dbContext.Notificacoes
            .AsNoTracking()
            .AnyAsync(notificacao =>
                notificacao.Id == notificacaoId && notificacao.UsuarioId == usuarioId,
                cancellationToken);
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

    private static readonly Expression<Func<Notificacao, NotificacaoResponse>> Projecao =
        notificacao => new NotificacaoResponse
        {
            Id = notificacao.Id,
            Titulo = notificacao.Titulo,
            Mensagem = notificacao.Mensagem,
            Lida = notificacao.Lida,
            DataCriacao = notificacao.DataCriacao,
            TipoNotificacao = notificacao.TipoNotificacao,
            Entidade = notificacao.Entidade,
            EntidadeId = notificacao.EntidadeId,
            ParticipanteDivisaoId = notificacao.ParticipanteDivisaoId,
            Rota = notificacao.Rota,
            AcaoPendente = notificacao.AcaoPendente,
            Versao = notificacao.Versao,
            StatusAcao = notificacao.AcaoPendente != null
                ? "Pendente"
                : notificacao.Entidade != null
                    ? "Concluida"
                    : null
        };

    private static string NormalizarFiltro(string? filtro)
    {
        var normalizado = filtro?.Trim() ?? "Todas";
        return normalizado is "Todas" or "NaoLidas" or "Pendentes" or "Concluidas"
            ? normalizado
            : throw new InvalidOperationException("Filtro de notificações inválido.");
    }

    private static string? NormalizarCategoria(string? categoria)
    {
        var normalizada = string.IsNullOrWhiteSpace(categoria) ? null : categoria.Trim();
        return normalizada is null or "Divisoes" or "Emprestimos" or "Sistema"
            ? normalizada
            : throw new InvalidOperationException("Categoria de notificações inválida.");
    }

    private IOrderedQueryable<Notificacao> OrdenarPorMaisRecentes(IQueryable<Notificacao> query)
    {
        return _dbContext.Database.ProviderName?.Contains("Sqlite", StringComparison.Ordinal) == true
            ? query.OrderByDescending(notificacao => notificacao.Id)
            : query.OrderByDescending(notificacao => notificacao.DataCriacao)
                .ThenByDescending(notificacao => notificacao.Id);
    }
}
