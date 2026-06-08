using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.Usuarios;
using SistemaFinanceiro.Api.Services.Usuarios;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/usuarios")]
public sealed class UsuarioController : ControllerBase
{
    private readonly IUsuarioService _usuarioService;

    public UsuarioController(IUsuarioService usuarioService)
    {
        _usuarioService = usuarioService;
    }

    [HttpGet("me")]
    [HttpGet("perfil")]
    public async Task<ActionResult<UsuarioPerfilResponse>> ObterPerfil(CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (!usuarioId.HasValue)
        {
            return Unauthorized();
        }

        var perfil = await _usuarioService.ObterPerfilAsync(usuarioId.Value, cancellationToken);
        return perfil is null ? NotFound() : Ok(perfil);
    }

    [HttpPut("me")]
    [HttpPut("perfil")]
    public async Task<ActionResult<UsuarioPerfilResponse>> AtualizarPerfil(
        AtualizarUsuarioRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (!usuarioId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var perfil = await _usuarioService.AtualizarPerfilAsync(usuarioId.Value, request, cancellationToken);
            return perfil is null ? NotFound() : Ok(perfil);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("me/senha")]
    public async Task<IActionResult> AlterarSenha(
        AlterarSenhaRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (!usuarioId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var alterou = await _usuarioService.AlterarSenhaAsync(usuarioId.Value, request, cancellationToken);
            return alterou ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("me")]
    public async Task<IActionResult> ExcluirConta(
        ExcluirContaRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (!usuarioId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var excluiu = await _usuarioService.ExcluirContaAsync(usuarioId.Value, request, cancellationToken);
            return excluiu ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private Guid? ObterUsuarioId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var usuarioId) ? usuarioId : null;
    }
}
