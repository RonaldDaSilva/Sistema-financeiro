using System.ComponentModel.DataAnnotations;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class CriarTransacaoRequest
{
    [Required]
    public TipoTransacao Tipo { get; set; }

    [Required]
    [MaxLength(180)]
    public string Descricao { get; set; } = string.Empty;

    [Range(0.01, 999999999999.99)]
    public decimal Valor { get; set; }

    [Required]
    public DateOnly DataOcorrencia { get; set; }

    public Guid? CategoriaId { get; set; }

    [Required]
    [MaxLength(60)]
    public string FormaPagamento { get; set; } = string.Empty;

    public Guid? CartaoCreditoId { get; set; }
    public bool IsFixa { get; set; }
    public Guid? CompraParceladaId { get; set; }
    public int? NumeroParcelaQuitada { get; set; }
}
