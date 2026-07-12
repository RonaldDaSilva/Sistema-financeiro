namespace SistemaFinanceiro.Api.Dtos.CartoesCredito;

public sealed class CartaoCreditoResponse
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public string ApelidoCartao { get; set; } = string.Empty;
    public string Banco { get; set; } = string.Empty;
    public int DiaVencimento { get; set; }
    public int MelhorDiaCompra { get; set; }
    public decimal LimiteTotal { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public decimal ValorUtilizado { get; set; }
    public decimal LimiteDisponivel { get; set; }
}
