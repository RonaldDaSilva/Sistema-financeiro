using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Services.Exportacao;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/exportacao")]
public sealed class ExportacaoController : ControllerBase
{
    private const string ExcelMimeType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private const string PdfMimeType = "application/pdf";

    private readonly IExportacaoService _exportacaoService;

    public ExportacaoController(IExportacaoService exportacaoService)
    {
        _exportacaoService = exportacaoService;
    }

    [HttpGet("excel")]
    public async Task<IActionResult> ExportarExcel(
        [FromQuery] DateOnly dataInicial,
        [FromQuery] DateOnly dataFinal,
        [FromQuery] Guid? categoriaId,
        [FromQuery] string? tipoTransacao,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var stream = await _exportacaoService.GerarExcelAsync(
                dataInicial,
                dataFinal,
                usuarioId.Value,
                categoriaId,
                tipoTransacao,
                cancellationToken);

            return File(stream, ExcelMimeType, CriarNomeArquivo(dataInicial, dataFinal, "xlsx"));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpGet("pdf")]
    public async Task<IActionResult> ExportarPdf(
        [FromQuery] DateOnly dataInicial,
        [FromQuery] DateOnly dataFinal,
        [FromQuery] Guid? categoriaId,
        [FromQuery] string? tipoTransacao,
        CancellationToken cancellationToken)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId is null)
        {
            return Unauthorized(new { message = "Usuário não identificado no token." });
        }

        try
        {
            var stream = await _exportacaoService.GerarPdfAsync(
                dataInicial,
                dataFinal,
                usuarioId.Value,
                categoriaId,
                tipoTransacao,
                cancellationToken);

            return File(stream, PdfMimeType, CriarNomeArquivo(dataInicial, dataFinal, "pdf"));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    private Guid? ObterUsuarioId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var usuarioId) ? usuarioId : null;
    }

    private static string CriarNomeArquivo(DateOnly dataInicial, DateOnly dataFinal, string extensao) =>
        $"Extrato_{dataInicial:yyyyMMdd}_{dataFinal:yyyyMMdd}.{extensao}";
}
