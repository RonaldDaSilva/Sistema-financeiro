using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.ComprasParceladas;
using SistemaFinanceiro.Api.Services.ComprasParceladas;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/compras-parceladas")]
public sealed class CompraParceladaController : ControllerBase
{
    private readonly ICompraParceladaService _compraParceladaService;

    public CompraParceladaController(ICompraParceladaService compraParceladaService)
    {
        _compraParceladaService = compraParceladaService;
    }

    [HttpPost]
    public async Task<ActionResult<CompraParceladaResponse>> Criar(
        CriarCompraParceladaRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var compra = await _compraParceladaService.CriarAsync(request, usuarioId.Value, cancellationToken);
            return CreatedAtAction(nameof(Criar), new { id = compra.Id }, compra);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CompraParceladaResponse>> AtualizarProjecao(
        Guid id,
        [FromQuery] int numeroParcela,
        [FromQuery] DateOnly dataOcorrencia,
        CriarCompraParceladaRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var compra = await _compraParceladaService.AtualizarProjecaoAsync(
                id,
                numeroParcela,
                dataOcorrencia,
                request,
                usuarioId.Value,
                cancellationToken);

            return compra is null ? NotFound() : Ok(compra);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> ExcluirProjecao(
        Guid id,
        [FromQuery] int numeroParcela,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var excluiu = await _compraParceladaService.ExcluirProjecaoAsync(
                id,
                numeroParcela,
                usuarioId.Value,
                cancellationToken);

            return excluiu ? NoContent() : NotFound();
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
