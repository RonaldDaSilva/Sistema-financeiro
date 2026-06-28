using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Services.Transacoes;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/transacoes")]
public sealed class TransacaoController : ControllerBase
{
    private readonly ITransacaoService _transacaoService;

    public TransacaoController(ITransacaoService transacaoService)
    {
        _transacaoService = transacaoService;
    }

    [HttpGet("extrato-mensal")]
    public async Task<ActionResult<ExtratoMensalResponse>> GetExtratoMensal(
        [FromQuery] int mes,
        [FromQuery] int ano,
        [FromQuery] bool? apenasDivididas,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var extrato = await _transacaoService.GetExtratoMensalAsync(
                mes,
                ano,
                usuarioId.Value,
                apenasDivididas,
                cancellationToken);

            return Ok(extrato);
        }
        catch (ArgumentOutOfRangeException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpGet("extrato-mensal/paginado")]
    public async Task<IActionResult> GetExtratoMensalPaginado(
        [FromQuery] ExtratoPaginadoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var extrato = await _transacaoService.GetExtratoMensalPaginadoAsync(
                request,
                usuarioId.Value,
                cancellationToken);

            return Ok(extrato);
        }
        catch (ArgumentOutOfRangeException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpGet("faturas-mes")]
    public async Task<ActionResult<IReadOnlyList<FaturaConsolidadaResponse>>> GetFaturasDoMes(
        [FromQuery] int mes,
        [FromQuery] int ano,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var faturas = await _transacaoService.GetFaturasDoMesAsync(
                mes,
                ano,
                usuarioId.Value,
                cancellationToken);

            return Ok(faturas);
        }
        catch (ArgumentOutOfRangeException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Criar(
        CriarTransacaoRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var id = await _transacaoService.CriarAsync(request, usuarioId.Value, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, new { id });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Atualizar(
        Guid id,
        CriarTransacaoRequest request,
        CancellationToken cancellationToken,
        [FromQuery] bool replicarFuturas = true)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var transacaoId = await _transacaoService.AtualizarAsync(
                id,
                request,
                usuarioId.Value,
                replicarFuturas,
                cancellationToken);
            return transacaoId is null ? NotFound() : Ok(new { id = transacaoId.Value });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("antecipar-parcela")]
    public async Task<ActionResult<IReadOnlyList<TransacaoResponse>>> AnteciparParcela(
        AnteciparParcelaRequest request,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var transacoes = await _transacaoService.AnteciparParcelaAsync(
                request,
                usuarioId.Value,
                cancellationToken);

            return CreatedAtAction(nameof(Criar), null, transacoes);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Excluir(
        Guid id,
        [FromQuery] DateOnly? dataOcorrencia,
        CancellationToken cancellationToken,
        [FromQuery] bool replicarFuturas = true)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        var excluiu = await _transacaoService.ExcluirAsync(
            id,
            usuarioId.Value,
            dataOcorrencia,
            replicarFuturas,
            cancellationToken);
        return excluiu ? NoContent() : NotFound();
    }

    [HttpPatch("{id:guid}/alternar-status")]
    public async Task<IActionResult> AlternarStatusPagamento(
        Guid id,
        CancellationToken cancellationToken,
        [FromQuery] DateOnly? dataOcorrencia = null)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        var isPaga = await _transacaoService.AlternarStatusPagamentoAsync(
            id,
            usuarioId.Value,
            dataOcorrencia,
            cancellationToken);

        return isPaga.HasValue ? Ok(new { isPaga = isPaga.Value }) : NotFound();
    }

    [HttpPatch("faturas/{cartaoCreditoId:guid}/alternar-status")]
    public async Task<IActionResult> AlternarStatusFatura(
        Guid cartaoCreditoId,
        [FromQuery] DateOnly dataVencimento,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        var isPaga = await _transacaoService.AlternarStatusFaturaAsync(
            cartaoCreditoId,
            dataVencimento,
            usuarioId.Value,
            cancellationToken);

        return isPaga.HasValue ? Ok(new { isPaga = isPaga.Value }) : NotFound();
    }

    private Guid? ObterUsuarioId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var usuarioId) ? usuarioId : null;
    }
}
