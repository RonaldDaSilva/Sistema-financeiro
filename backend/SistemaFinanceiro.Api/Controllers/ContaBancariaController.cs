using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.ContasBancarias;
using SistemaFinanceiro.Api.Services.ContasBancarias;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/contas")]
public sealed class ContaBancariaController : ControllerBase
{
    private readonly IContaBancariaService _service;

    public ContaBancariaController(IContaBancariaService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ContaBancariaResponse>>> Listar(
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        return usuarioId is null
            ? Unauthorized()
            : Ok(await _service.ListarAsync(usuarioId.Value, cancellationToken));
    }

    [HttpGet("distribuicao")]
    public async Task<ActionResult<IReadOnlyList<ContaDistribuicaoResponse>>> Distribuicao(
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        return usuarioId is null
            ? Unauthorized()
            : Ok(await _service.ObterDistribuicaoAsync(usuarioId.Value, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ContaBancariaResponse>> ObterPorId(
        Guid id,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        var conta = await _service.ObterPorIdAsync(id, usuarioId.Value, cancellationToken);
        return conta is null ? NotFound() : Ok(conta);
    }

    [HttpPost]
    public async Task<ActionResult<ContaBancariaResponse>> Criar(
        ContaBancariaRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        var conta = await _service.CriarAsync(request, usuarioId.Value, cancellationToken);
        return CreatedAtAction(nameof(ObterPorId), new { id = conta.Id }, conta);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ContaBancariaResponse>> Atualizar(
        Guid id,
        ContaBancariaRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        var conta = await _service.AtualizarAsync(id, request, usuarioId.Value, cancellationToken);
        return conta is null ? NotFound() : Ok(conta);
    }

    [HttpPatch("{id:guid}/favoritar")]
    public async Task<ActionResult<ContaBancariaResponse>> Favoritar(
        Guid id,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        var conta = await _service.FavoritarAsync(id, usuarioId.Value, cancellationToken);
        return conta is null ? NotFound() : Ok(conta);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Excluir(Guid id, CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        return usuarioId is null
            ? Unauthorized()
            : await _service.ExcluirAsync(id, usuarioId.Value, cancellationToken)
                ? NoContent()
                : NotFound();
    }

    private Guid? ObterUsuarioId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var usuarioId) ? usuarioId : null;
    }
}
