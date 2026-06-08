using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.Notificacoes;
using SistemaFinanceiro.Api.Services.Notificacoes;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/notificacoes")]
public sealed class NotificacaoController : ControllerBase
{
    private readonly INotificacaoService _notificacaoService;

    public NotificacaoController(INotificacaoService notificacaoService)
    {
        _notificacaoService = notificacaoService;
    }

    [HttpGet("nao-lidas")]
    public async Task<ActionResult<IReadOnlyList<NotificacaoResponse>>> GetNaoLidas(
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (!usuarioId.HasValue)
        {
            return Unauthorized();
        }

        var notificacoes = await _notificacaoService.GetNaoLidasAsync(usuarioId.Value, cancellationToken);
        return Ok(notificacoes);
    }

    [HttpPut("marcar-como-lidas")]
    public async Task<IActionResult> MarcarComoLidas(CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (!usuarioId.HasValue)
        {
            return Unauthorized();
        }

        await _notificacaoService.MarcarComoLidasAsync(usuarioId.Value, cancellationToken);
        return NoContent();
    }

    [HttpGet("configuracoes")]
    public async Task<ActionResult<ConfiguracoesNotificacaoResponse>> ObterConfiguracoes(
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (!usuarioId.HasValue)
        {
            return Unauthorized();
        }

        var configuracoes = await _notificacaoService.ObterConfiguracoesAsync(usuarioId.Value, cancellationToken);
        return Ok(configuracoes);
    }

    [HttpPut("configuracoes")]
    public async Task<ActionResult<ConfiguracoesNotificacaoResponse>> AtualizarConfiguracoes(
        AtualizarConfiguracoesNotificacaoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (!usuarioId.HasValue)
        {
            return Unauthorized();
        }

        var configuracoes = await _notificacaoService.AtualizarConfiguracoesAsync(
            usuarioId.Value,
            request,
            cancellationToken);

        return Ok(configuracoes);
    }

    private Guid? ObterUsuarioId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var usuarioId) ? usuarioId : null;
    }
}
