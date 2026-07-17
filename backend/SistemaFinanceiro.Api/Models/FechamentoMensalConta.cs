namespace SistemaFinanceiro.Api.Models;

public sealed class FechamentoMensalConta
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FechamentoMensalSaldoId { get; set; }
    public Guid ContaBancariaId { get; set; }
    public decimal Saldo { get; set; }

    public FechamentoMensalSaldo FechamentoMensalSaldo { get; set; } = null!;
    public ContaBancaria ContaBancaria { get; set; } = null!;
}
