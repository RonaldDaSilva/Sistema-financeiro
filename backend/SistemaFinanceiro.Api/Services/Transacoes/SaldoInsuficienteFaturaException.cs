namespace SistemaFinanceiro.Api.Services.Transacoes;

public sealed class SaldoInsuficienteFaturaException : InvalidOperationException
{
    public SaldoInsuficienteFaturaException()
        : base("A conta vinculada não possui saldo para este pagamento.")
    {
    }

    public string Erro => "SALDO_INSUFICIENTE";
}
