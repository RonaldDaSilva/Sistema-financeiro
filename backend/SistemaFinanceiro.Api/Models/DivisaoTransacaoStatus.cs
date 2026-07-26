namespace SistemaFinanceiro.Api.Models;

public enum DivisaoTransacaoStatus
{
    Pendente = 1,
    ParcialmenteAceita = 2,
    Aceita = 3,
    RecusadaAguardandoDecisao = 4,
    AlteracaoPendente = 5,
    Cancelada = 6,
    Expirada = 7
}
