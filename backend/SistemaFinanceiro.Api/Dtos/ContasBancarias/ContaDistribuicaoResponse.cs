namespace SistemaFinanceiro.Api.Dtos.ContasBancarias;

public sealed class ContaDistribuicaoResponse
{
    public Guid Id { get; set; }
    public string CodigoBanco { get; set; } = string.Empty;
    public string NomeCustomizado { get; set; } = string.Empty;
    public decimal SaldoAtual { get; set; }
}
