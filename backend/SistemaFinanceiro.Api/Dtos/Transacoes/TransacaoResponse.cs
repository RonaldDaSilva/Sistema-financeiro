using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class TransacaoResponse
{
    public Guid Id { get; set; }
    public int CodigoExibicao { get; set; }
    public Guid UsuarioId { get; set; }
    public TipoTransacao Tipo { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateOnly DataOcorrencia { get; set; }
    public Guid? CategoriaId { get; set; }
    public string FormaPagamento { get; set; } = string.Empty;
    public Guid? CartaoCreditoId { get; set; }
    public bool IsFixa { get; set; }
    public Guid? CompraParceladaId { get; set; }
    public int? NumeroParcelaQuitada { get; set; }
}
