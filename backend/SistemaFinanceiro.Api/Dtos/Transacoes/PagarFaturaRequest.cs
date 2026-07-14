namespace SistemaFinanceiro.Api.Dtos.Transacoes;

public sealed class PagarFaturaRequest
{
    public bool ConfirmarSemSaldo { get; set; }
    public Guid? ContaBancariaId { get; set; }
}
