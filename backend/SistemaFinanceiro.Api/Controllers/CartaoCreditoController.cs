using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Dtos.CartoesCredito;
using SistemaFinanceiro.Api.Services.CartoesCredito;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/cartoes-credito")]
public sealed class CartaoCreditoController : ControllerBase
{
    private readonly ICartaoCreditoService _cartaoCreditoService;

    public CartaoCreditoController(ICartaoCreditoService cartaoCreditoService)
    {
        _cartaoCreditoService = cartaoCreditoService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CartaoCreditoResponse>>> Listar(CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        return Ok(await _cartaoCreditoService.ListarAsync(usuarioId.Value, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CartaoCreditoResponse>> ObterPorId(Guid id, CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        var cartao = await _cartaoCreditoService.ObterPorIdAsync(id, usuarioId.Value, cancellationToken);
        return cartao is null ? NotFound() : Ok(cartao);
    }

    [HttpPost]
    public async Task<ActionResult<CartaoCreditoResponse>> Criar(
        CartaoCreditoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var cartao = await _cartaoCreditoService.CriarAsync(request, usuarioId.Value, cancellationToken);
            return CreatedAtAction(nameof(ObterPorId), new { id = cartao.Id }, cartao);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CartaoCreditoResponse>> Atualizar(
        Guid id,
        CartaoCreditoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var cartao = await _cartaoCreditoService.AtualizarAsync(id, request, usuarioId.Value, cancellationToken);
            return cartao is null ? NotFound() : Ok(cartao);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
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
            var excluiu = await _cartaoCreditoService.ExcluirAsync(id, usuarioId.Value, cancellationToken);
            return excluiu ? NoContent() : NotFound();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Cartão não pode ser excluído porque possui vínculos." });
        }
    }

    private Guid? ObterUsuarioId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var usuarioId) ? usuarioId : null;
    }
}
