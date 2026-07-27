namespace SistemaFinanceiro.Api.Models;

public enum TipoNotificacao
{
    Vencimento = 1,
    MelhorDiaCompra = 2,
    DivisaoRecebida = 3,
    DivisaoAceita = 4,
    DivisaoRecusada = 5,
    DivisaoExpirada = 6,
    DivisaoCancelada = 7,
    DivisaoAlterada = 8,
    AlteracaoDivisaoAceita = 9,
    AlteracaoDivisaoRecusada = 10
}
