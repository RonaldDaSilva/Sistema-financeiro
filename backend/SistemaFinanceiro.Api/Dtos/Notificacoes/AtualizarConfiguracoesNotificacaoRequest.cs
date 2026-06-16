using System.ComponentModel.DataAnnotations;

namespace SistemaFinanceiro.Api.Dtos.Notificacoes;

public sealed class AtualizarConfiguracoesNotificacaoRequest
{
    public bool ReceberNotificacoes { get; set; }
    public bool AvisarVencimento { get; set; }
    public bool AvisarMelhorDia { get; set; }

    [Range(0, 30)]
    public int DiasAntecedenciaVencimento { get; set; } = 2;

    [Range(0.01, 100)]
    public decimal PercentualPadraoDivisao { get; set; } = 50m;
}
