namespace SistemaFinanceiro.Api.Services.Exportacao;

public interface IExportacaoService
{
    Task<MemoryStream> GerarExcelAsync(
        DateOnly dataInicial,
        DateOnly dataFinal,
        Guid usuarioId,
        Guid? categoriaId = null,
        string? tipoTransacao = null,
        CancellationToken cancellationToken = default);

    Task<MemoryStream> GerarPdfAsync(
        DateOnly dataInicial,
        DateOnly dataFinal,
        Guid usuarioId,
        Guid? categoriaId = null,
        string? tipoTransacao = null,
        CancellationToken cancellationToken = default);
}
