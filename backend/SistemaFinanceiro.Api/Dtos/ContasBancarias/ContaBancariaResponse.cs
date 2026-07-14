namespace SistemaFinanceiro.Api.Dtos.ContasBancarias;

public sealed class ContaBancariaResponse
{
    public Guid Id { get; set; }
    public string NomeCustomizado { get; set; } = string.Empty;
    public string CodigoBanco { get; set; } = string.Empty;
    public decimal SaldoInicial { get; set; }
    public bool IsFavorita { get; set; }
    public bool IsArquivada { get; set; }
    public bool PermiteEditarSaldoInicial { get; set; }
    public DateTimeOffset DataCriacao { get; set; }
}
