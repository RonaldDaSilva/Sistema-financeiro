using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.Dashboard;
using SistemaFinanceiro.Api.Services.Dashboard;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public sealed class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("inicio")]
    public async Task<ActionResult<DashboardInicioDto>> GetInicio(
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        var dashboard = await _dashboardService.GetInicioAsync(
            usuarioId.Value,
            cancellationToken);

        return Ok(dashboard);
    }

    [HttpGet("relatorios")]
    public async Task<ActionResult<DashboardRelatoriosDto>> GetRelatorios(
        [FromQuery] int mes,
        [FromQuery] int ano,
        [FromQuery] Guid? contaBancariaId,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var dashboard = await _dashboardService.GetRelatoriosAsync(
                mes,
                ano,
                usuarioId.Value,
                contaBancariaId,
                cancellationToken);

            return Ok(dashboard);
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
