namespace SistemaFinanceiro.Api.Dtos.CartoesCredito;

public sealed class CartaoCreditoOpcaoResponse
{
    public Guid Id { get; set; }
    public string ApelidoCartao { get; set; } = string.Empty;
    public string Banco { get; set; } = string.Empty;
}
