namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class AlterarStatusPagamentoRequest
{
    public bool? IsPaga { get; set; }
    public Guid? ContaBancariaId { get; set; }
}
