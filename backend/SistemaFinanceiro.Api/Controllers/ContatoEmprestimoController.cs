using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.Emprestimos;
using SistemaFinanceiro.Api.Services.Emprestimos;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/emprestimos/contatos")]
public sealed class ContatoEmprestimoController : ControllerBase
{
    private readonly IContatoEmprestimoService _service;

    public ContatoEmprestimoController(IContatoEmprestimoService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ContatoEmprestimoResponse>>> Listar(
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        return usuarioId is null
            ? Unauthorized()
            : Ok(await _service.ListarAsync(usuarioId.Value, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<ContatoEmprestimoResponse>> Criar(
        CriarContatoEmprestimoRequest request,
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
    public async Task<ActionResult<ContatoEmprestimoResponse>> Atualizar(
        Guid id,
        AtualizarContatoEmprestimoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var contato = await _service.AtualizarAsync(usuarioId.Value, id, request, cancellationToken);
            return contato is null ? NotFound() : Ok(contato);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
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
