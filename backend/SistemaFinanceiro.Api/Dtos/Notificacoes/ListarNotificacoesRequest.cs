using System.ComponentModel.DataAnnotations;

namespace SistemaFinanceiro.Api.Dtos.Notificacoes;

public sealed class ListarNotificacoesRequest
{
    [Range(1, int.MaxValue)]
    public int Pagina { get; set; } = 1;

    [Range(1, 50)]
    public int TamanhoPagina { get; set; } = 20;

    [MaxLength(20)]
    public string Filtro { get; set; } = "Todas";

    [MaxLength(20)]
    public string? Categoria { get; set; }
}

public sealed class NotificacoesPaginadasResponse
{
    public IReadOnlyList<NotificacaoResponse> Itens { get; set; } = [];
    public int Pagina { get; set; }
    public int TamanhoPagina { get; set; }
    public int TotalItens { get; set; }
    public int TotalPaginas { get; set; }
}
