using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.Divisoes;
using SistemaFinanceiro.Api.Services.Divisoes;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/contatos-divisao")]
public sealed class ContatoDivisaoController : ControllerBase
{
    private readonly IContatoDivisaoService _service;

    public ContatoDivisaoController(IContatoDivisaoService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ContatoDivisaoResponse>>> Listar(
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        return usuarioId is null
            ? Unauthorized()
            : Ok(await _service.ListarAsync(usuarioId.Value, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<ContatoDivisaoResponse>> Criar(
        CriarContatoDivisaoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var contato = await _service.CriarAsync(usuarioId.Value, request, cancellationToken);
            return CreatedAtAction(nameof(Listar), new { id = contato.Id }, contato);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<ContatoDivisaoResponse>> Atualizar(
        Guid id,
        AtualizarContatoDivisaoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        var contato = await _service.AtualizarAsync(usuarioId.Value, id, request, cancellationToken);
        return contato is null ? NotFound() : Ok(contato);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remover(Guid id, CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        return usuarioId is null
            ? Unauthorized()
            : await _service.RemoverAsync(usuarioId.Value, id, cancellationToken)
                ? NoContent()
                : NotFound();
    }

    private Guid? ObterUsuarioId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var usuarioId) ? usuarioId : null;
    }
}
