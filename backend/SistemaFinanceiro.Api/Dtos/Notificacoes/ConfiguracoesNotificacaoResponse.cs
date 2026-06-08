namespace SistemaFinanceiro.Api.Dtos.Notificacoes;

public sealed class ConfiguracoesNotificacaoResponse
{
    public bool ReceberNotificacoes { get; set; }
    public bool AvisarVencimento { get; set; }
    public bool AvisarMelhorDia { get; set; }
    public int DiasAntecedenciaVencimento { get; set; }
}
