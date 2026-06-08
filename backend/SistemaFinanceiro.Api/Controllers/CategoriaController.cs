using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Dtos.Categorias;
using SistemaFinanceiro.Api.Services.Categorias;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/categorias")]
public sealed class CategoriaController : ControllerBase
{
    private readonly ICategoriaService _categoriaService;

    public CategoriaController(ICategoriaService categoriaService)
    {
        _categoriaService = categoriaService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoriaResponse>>> Listar(CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        return Ok(await _categoriaService.ListarAsync(usuarioId.Value, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CategoriaResponse>> ObterPorId(Guid id, CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        var categoria = await _categoriaService.ObterPorIdAsync(id, usuarioId.Value, cancellationToken);
        return categoria is null ? NotFound() : Ok(categoria);
    }

    [HttpPost]
    public async Task<ActionResult<CategoriaResponse>> Criar(
        CategoriaRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var categoria = await _categoriaService.CriarAsync(request, usuarioId.Value, cancellationToken);
            return CreatedAtAction(nameof(ObterPorId), new { id = categoria.Id }, categoria);
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Já existe uma categoria com esse nome para este usuário." });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CategoriaResponse>> Atualizar(
        Guid id,
        CategoriaRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var categoria = await _categoriaService.AtualizarAsync(id, request, usuarioId.Value, cancellationToken);
            return categoria is null ? NotFound() : Ok(categoria);
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Já existe uma categoria com esse nome para este usuário." });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Excluir(Guid id, CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var excluiu = await _categoriaService.ExcluirAsync(id, usuarioId.Value, cancellationToken);
            return excluiu ? NoContent() : NotFound();
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Categoria não pode ser excluída porque possui vínculos." });
        }
    }

    private Guid? ObterUsuarioId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var usuarioId) ? usuarioId : null;
    }
}
