using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SistemaFinanceiro.Api.Dtos.Transacoes;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Transacoes;

namespace SistemaFinanceiro.Api.Services.Exportacao;

public sealed class ExportacaoService : IExportacaoService
{
    private const string ExcelMimeType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private const string Slate50 = "#F8FAFC";
    private const string Slate100 = "#F1F5F9";
    private const string Slate200 = "#E2E8F0";
    private const string Slate400 = "#94A3B8";
    private const string Slate600 = "#475569";
    private const string Slate900 = "#0F172A";

    private readonly ITransacaoService _transacaoService;

    public ExportacaoService(ITransacaoService transacaoService)
    {
        _transacaoService = transacaoService;
    }

    public async Task<MemoryStream> GerarExcelAsync(
        DateOnly dataInicial,
        DateOnly dataFinal,
        Guid usuarioId,
        Guid? categoriaId = null,
        string? tipoTransacao = null,
        CancellationToken cancellationToken = default)
    {
        _ = ExcelMimeType;
        var itens = await ObterItensFiltradosAsync(
            dataInicial,
            dataFinal,
            usuarioId,
            categoriaId,
            tipoTransacao,
            cancellationToken);

        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Extrato");

        var headers = new[]
        {
            "Data",
            "Descrição",
            "Categoria",
            "Tipo",
            "Forma de Pagamento",
            "Valor"
        };

        for (var column = 0; column < headers.Length; column++)
        {
            var cell = worksheet.Cell(1, column + 1);
            cell.Value = headers[column];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#E2E8F0");
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        }

        var row = 2;
        foreach (var item in itens)
        {
            worksheet.Cell(row, 1).Value = item.DataOcorrencia.ToDateTime(TimeOnly.MinValue);
            worksheet.Cell(row, 1).Style.DateFormat.Format = "dd/mm/yyyy";
            worksheet.Cell(row, 2).Value = item.Descricao;
            worksheet.Cell(row, 3).Value = item.CategoriaNome;
            worksheet.Cell(row, 4).Value = ObterTipoExportacao(item);
            worksheet.Cell(row, 5).Value = item.FormaPagamento;
            worksheet.Cell(row, 6).Value = item.Valor;
            worksheet.Cell(row, 6).Style.NumberFormat.Format = "\"R$\" #,##0.00";
            row++;
        }

        worksheet.Columns().AdjustToContents();

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }

    public async Task<MemoryStream> GerarPdfAsync(
        DateOnly dataInicial,
        DateOnly dataFinal,
        Guid usuarioId,
        Guid? categoriaId = null,
        string? tipoTransacao = null,
        CancellationToken cancellationToken = default)
    {
        var itens = await ObterItensFiltradosAsync(
            dataInicial,
            dataFinal,
            usuarioId,
            categoriaId,
            tipoTransacao,
            cancellationToken);

        var totalReceitas = itens
            .Where(item => item.Tipo == TipoTransacao.Receita)
            .Sum(item => item.Valor);
        var totalDespesas = itens
            .Where(item => item.Tipo == TipoTransacao.Despesa)
            .Sum(item => item.Valor);
        var totalInvestido = itens
            .Where(item => item.Tipo == TipoTransacao.Investimento)
            .Sum(item => item.Valor);
        var saldo = totalReceitas - totalDespesas - totalInvestido;

        var stream = new MemoryStream();

        Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(28);
                page.Size(PageSizes.A4.Landscape());
                page.DefaultTextStyle(text => text.FontSize(9).FontFamily("Arial"));

                page.Header().Column(column =>
                {
                    column.Item().Text("Relatório Financeiro")
                        .FontSize(18)
                        .Bold()
                        .FontColor(Slate900);
                    column.Item().Text(
                            $"Período: {FormatarData(dataInicial)} até {FormatarData(dataFinal)}")
                        .FontSize(10)
                        .FontColor(Slate600);
                });

                page.Content().PaddingTop(16).Column(column =>
                {
                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Element(container => ResumoBox(
                            container,
                            "Receitas",
                            totalReceitas,
                            Colors.Green.Darken2));
                        row.RelativeItem().Element(container => ResumoBox(
                            container,
                            "Despesas",
                            totalDespesas,
                            Colors.Red.Darken2));
                        row.RelativeItem().Element(container => ResumoBox(
                            container,
                            "Investimentos",
                            totalInvestido,
                            Colors.Blue.Darken2));
                        row.RelativeItem().Element(container => ResumoBox(
                            container,
                            "Saldo",
                            saldo,
                            saldo >= 0 ? Colors.Green.Darken3 : Colors.Red.Darken3));
                    });

                    column.Item().PaddingTop(16).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(70);
                            columns.RelativeColumn(2.2f);
                            columns.RelativeColumn(1.1f);
                            columns.ConstantColumn(90);
                            columns.RelativeColumn(1.2f);
                            columns.ConstantColumn(85);
                        });

                        table.Header(header =>
                        {
                            HeaderCell(header, "Data");
                            HeaderCell(header, "Descrição");
                            HeaderCell(header, "Categoria");
                            HeaderCell(header, "Tipo");
                            HeaderCell(header, "Forma Pgto.");
                            HeaderCell(header, "Valor");
                        });

                        foreach (var item in itens)
                        {
                            BodyCell(table, FormatarData(item.DataOcorrencia));
                            BodyCell(table, item.Descricao);
                            BodyCell(table, item.CategoriaNome);
                            BodyCell(table, ObterTipoExportacao(item));
                            BodyCell(table, item.FormaPagamento);
                            BodyCell(table, FormatarMoeda(item.Valor), alignRight: true);
                        }
                    });
                });

                page.Footer().AlignRight().Text(text =>
                {
                    text.Span("Gerado em ");
                    text.Span(DateTime.Now.ToString("dd/MM/yyyy HH:mm"));
                });
            });
        }).GeneratePdf(stream);

        stream.Position = 0;
        return stream;
    }

    private async Task<IReadOnlyList<ExtratoMensalItemResponse>> ObterItensFiltradosAsync(
        DateOnly dataInicial,
        DateOnly dataFinal,
        Guid usuarioId,
        Guid? categoriaId,
        string? tipoTransacao,
        CancellationToken cancellationToken)
    {
        if (dataFinal < dataInicial)
        {
            throw new ArgumentException("A data final deve ser maior ou igual à data inicial.");
        }

        var itens = new List<ExtratoMensalItemResponse>();
        foreach (var referencia in EnumerarMeses(dataInicial, dataFinal))
        {
            var extrato = await _transacaoService.GetExtratoMensalAsync(
                referencia.Month,
                referencia.Year,
                usuarioId,
                cancellationToken: cancellationToken);

            itens.AddRange(extrato.Itens);
        }

        return itens
            .Where(item => item.DataOcorrencia >= dataInicial && item.DataOcorrencia <= dataFinal)
            .Where(item => !categoriaId.HasValue || item.CategoriaId == categoriaId.Value)
            .Where(item => AplicarFiltroTipo(item, tipoTransacao))
            .OrderBy(item => item.DataOcorrencia)
            .ThenBy(item => item.Descricao)
            .ToList();
    }

    private static bool AplicarFiltroTipo(ExtratoMensalItemResponse item, string? tipoTransacao)
    {
        if (string.IsNullOrWhiteSpace(tipoTransacao) ||
            tipoTransacao.Equals("todos", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return tipoTransacao.Trim().ToLowerInvariant() switch
        {
            "receita" or "receitas" => item.Tipo == TipoTransacao.Receita,
            "despesa" or "despesas" => item.Tipo == TipoTransacao.Despesa,
            "investimento" or "investimentos" => item.Tipo == TipoTransacao.Investimento,
            "fatura" or "faturas" => item.Origem == "FaturaCartao",
            _ => true
        };
    }

    private static string ObterTipoExportacao(ExtratoMensalItemResponse item)
    {
        if (item.Origem == "FaturaCartao")
        {
            return "Fatura";
        }

        return item.Tipo switch
        {
            TipoTransacao.Receita => "Receita",
            TipoTransacao.Despesa => "Despesa",
            TipoTransacao.Investimento => "Investimento",
            _ => item.Tipo.ToString()
        };
    }

    private static IEnumerable<DateOnly> EnumerarMeses(DateOnly dataInicial, DateOnly dataFinal)
    {
        var cursor = new DateOnly(dataInicial.Year, dataInicial.Month, 1);
        var ultimoMes = new DateOnly(dataFinal.Year, dataFinal.Month, 1);

        while (cursor <= ultimoMes)
        {
            yield return cursor;
            cursor = cursor.AddMonths(1);
        }
    }

    private static string FormatarData(DateOnly data) =>
        data.ToString("dd/MM/yyyy", System.Globalization.CultureInfo.GetCultureInfo("pt-BR"));

    private static string FormatarMoeda(decimal valor) =>
        valor.ToString("C", System.Globalization.CultureInfo.GetCultureInfo("pt-BR"));

    private static void HeaderCell(TableCellDescriptor table, string text)
    {
        table.Cell()
            .Background(Slate200)
            .BorderBottom(1)
            .BorderColor(Slate400)
            .Padding(6)
            .Text(text)
            .Bold()
            .FontColor(Slate900);
    }

    private static void BodyCell(TableDescriptor table, string text, bool alignRight = false)
    {
        var cell = table.Cell()
            .BorderBottom(0.5f)
            .BorderColor(Slate200)
            .Padding(6);

        if (alignRight)
        {
            cell.AlignRight().Text(text);
            return;
        }

        cell.Text(text);
    }

    private static void ResumoBox(
        IContainer container,
        string label,
        decimal valor,
        string color)
    {
        container
            .PaddingRight(8)
            .Border(1)
            .BorderColor(Slate200)
            .Background(Colors.White)
            .Padding(10)
            .Column(column =>
            {
                column.Item().Text(label).FontSize(8).FontColor(Slate600);
                column.Item().Text(FormatarMoeda(valor)).Bold().FontSize(12).FontColor(color);
            });
    }
}
