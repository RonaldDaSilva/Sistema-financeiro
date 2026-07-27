using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.Divisoes;
using SistemaFinanceiro.Api.Services.Divisoes;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/divisoes-transacoes")]
public sealed class DivisaoTransacaoController : ControllerBase
{
    private readonly IDivisaoTransacaoService _service;

    public DivisaoTransacaoController(IDivisaoTransacaoService service)
    {
        _service = service;
    }

    [HttpPost("resolver-convidado")]
    public async Task<ActionResult<ResolverConvidadoDivisaoResponse>> ResolverConvidado(
        ResolverConvidadoDivisaoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            return Ok(await _service.ResolverConvidadoAsync(usuarioId.Value, request, cancellationToken));
        }
        catch (InvalidOperationException exception) when (exception.Message == "RATE_LIMIT_RESOLUCAO_EMAIL")
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new { message = "Muitas tentativas de resolução de e-mail." });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<DivisaoTransacaoResponse>> CriarConvite(
        CriarConviteDivisaoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var divisao = await _service.CriarConviteAsync(usuarioId.Value, request, cancellationToken);
            return CreatedAtAction(nameof(CriarConvite), new { id = divisao.Id }, divisao);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("participantes/{participanteId:guid}/aceitar")]
    public async Task<ActionResult<DivisaoTransacaoResponse>> Aceitar(
        Guid participanteId,
        CancellationToken cancellationToken)
    {
        return await AceitarInterno(participanteId, null, cancellationToken);
    }

    [HttpPost("participantes/{participanteId:guid}/aceitar-classificar")]
    public async Task<ActionResult<DivisaoTransacaoResponse>> AceitarClassificar(
        Guid participanteId,
        ClassificarAceiteDivisaoRequest request,
        CancellationToken cancellationToken)
    {
        return await AceitarInterno(participanteId, request, cancellationToken);
    }

    [HttpPost("participantes/{participanteId:guid}/recusar")]
    public async Task<ActionResult<DivisaoTransacaoResponse>> Recusar(
        Guid participanteId,
        RecusarDivisaoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var divisao = await _service.RecusarAsync(usuarioId.Value, participanteId, request, cancellationToken);
            return divisao is null ? NotFound() : Ok(divisao);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("{divisaoId:guid}/assumir-valor")]
    public async Task<ActionResult<DivisaoTransacaoResponse>> AssumirValor(
        Guid divisaoId,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var divisao = await _service.AssumirValorAsync(usuarioId.Value, divisaoId, cancellationToken);
            return divisao is null ? NotFound() : Ok(divisao);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("{divisaoId:guid}/reenviar")]
    public async Task<ActionResult<DivisaoTransacaoResponse>> Reenviar(
        Guid divisaoId,
        ReenviarDivisaoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var divisao = await _service.ReenviarAsync(usuarioId.Value, divisaoId, request, cancellationToken);
            return divisao is null ? NotFound() : Ok(divisao);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpDelete("{divisaoId:guid}")]
    public async Task<IActionResult> Excluir(
        Guid divisaoId,
        [FromQuery] string escopo,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            return await _service.ExcluirAsync(
                usuarioId.Value,
                divisaoId,
                new ExcluirDivisaoRequest { Escopo = escopo },
                cancellationToken)
                    ? NoContent()
                    : NotFound();
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    private async Task<ActionResult<DivisaoTransacaoResponse>> AceitarInterno(
        Guid participanteId,
        ClassificarAceiteDivisaoRequest? request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var divisao = await _service.AceitarAsync(usuarioId.Value, participanteId, request, cancellationToken);
            return divisao is null ? NotFound() : Ok(divisao);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    private Guid? ObterUsuarioId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var usuarioId) ? usuarioId : null;
    }
}
