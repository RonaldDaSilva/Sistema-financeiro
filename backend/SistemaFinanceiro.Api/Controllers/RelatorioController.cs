using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.Relatorios;
using SistemaFinanceiro.Api.Services.Relatorios;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/relatorios")]
public sealed class RelatorioController : ControllerBase
{
    private readonly IRelatorioService _relatorioService;

    public RelatorioController(IRelatorioService relatorioService)
    {
        _relatorioService = relatorioService;
    }

    [HttpGet("graficos")]
    public async Task<ActionResult<RelatorioGraficosResponse>> GetGraficos(
        [FromQuery] DateOnly? dataInicial,
        [FromQuery] DateOnly? dataFinal,
        [FromQuery] int? mes,
        [FromQuery] int? ano,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (!usuarioId.HasValue)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var inicio = dataInicial ??
                (mes.HasValue && ano.HasValue
                    ? new DateOnly(ano.Value, mes.Value, 1)
                    : new DateOnly(DateTime.Today.Year, DateTime.Today.Month, 1));
            var fim = dataFinal ??
                (mes.HasValue && ano.HasValue
                    ? new DateOnly(ano.Value, mes.Value, 1).AddMonths(1).AddDays(-1)
                    : inicio.AddMonths(1).AddDays(-1));

            var relatorio = await _relatorioService.GetGraficosAsync(
                inicio,
                fim,
                usuarioId.Value,
                cancellationToken);

            return Ok(relatorio);
        }
        catch (ArgumentOutOfRangeException exception)
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
