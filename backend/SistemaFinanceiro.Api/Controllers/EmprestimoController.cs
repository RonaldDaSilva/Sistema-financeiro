using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.Emprestimos;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Emprestimos;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/emprestimos")]
public sealed class EmprestimoController : ControllerBase
{
    private readonly IEmprestimoService _service;

    public EmprestimoController(IEmprestimoService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EmprestimoResumoResponse>>> Listar(
        [FromQuery] Guid? contatoId,
        [FromQuery] StatusEmprestimo? status,
        [FromQuery] bool incluirArquivados,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        return usuarioId is null
            ? Unauthorized()
            : Ok(await _service.ListarAsync(usuarioId.Value, contatoId, status, incluirArquivados, cancellationToken));
    }

    [HttpDelete("{id:guid}/pagamentos/{pagamentoId:guid}")]
    public async Task<ActionResult<EmprestimoDetalheResponse>> DesfazerPagamento(
        Guid id,
        Guid pagamentoId,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var emprestimo = await _service.DesfazerPagamentoAsync(
                usuarioId.Value,
                id,
                pagamentoId,
                cancellationToken);
            return emprestimo is null ? NotFound() : Ok(emprestimo);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPatch("{id:guid}/arquivar")]
    public Task<ActionResult<EmprestimoDetalheResponse>> Arquivar(
        Guid id,
        CancellationToken cancellationToken) => DefinirArquivamento(id, true, cancellationToken);

    [HttpPatch("{id:guid}/desarquivar")]
    public Task<ActionResult<EmprestimoDetalheResponse>> Desarquivar(
        Guid id,
        CancellationToken cancellationToken) => DefinirArquivamento(id, false, cancellationToken);

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EmprestimoDetalheResponse>> Obter(
        Guid id,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        var emprestimo = await _service.ObterAsync(usuarioId.Value, id, cancellationToken);
        return emprestimo is null ? NotFound() : Ok(emprestimo);
    }

    [HttpPost]
    public async Task<ActionResult<EmprestimoDetalheResponse>> Criar(
        CriarEmprestimoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var emprestimo = await _service.CriarAsync(usuarioId.Value, request, cancellationToken);
            return CreatedAtAction(nameof(Obter), new { id = emprestimo.Id }, emprestimo);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<EmprestimoDetalheResponse>> Atualizar(
        Guid id,
        AtualizarEmprestimoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var emprestimo = await _service.AtualizarAsync(usuarioId.Value, id, request, cancellationToken);
            return emprestimo is null ? NotFound() : Ok(emprestimo);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("{id:guid}/pagamentos")]
    public async Task<ActionResult<PagamentoEmprestimoResponse>> RegistrarPagamento(
        Guid id,
        RegistrarPagamentoEmprestimoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var pagamento = await _service.RegistrarPagamentoAsync(usuarioId.Value, id, request, cancellationToken);
            return pagamento is null ? NotFound() : Ok(pagamento);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Cancelar(Guid id, CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            return await _service.CancelarAsync(usuarioId.Value, id, cancellationToken)
                ? NoContent()
                : NotFound();
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

    private async Task<ActionResult<EmprestimoDetalheResponse>> DefinirArquivamento(
        Guid id,
        bool arquivar,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        try
        {
            var emprestimo = await _service.DefinirArquivamentoAsync(
                usuarioId.Value,
                id,
                arquivar,
                cancellationToken);
            return emprestimo is null ? NotFound() : Ok(emprestimo);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }
}
