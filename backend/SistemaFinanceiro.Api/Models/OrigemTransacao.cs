namespace SistemaFinanceiro.Api.Models;

public enum OrigemTransacao
{
    Lancamento = 1,
    AjusteSaldo = 2,
    Transferencia = 3,
    ReembolsoDivisao = 4,
    EmprestimoConcedido = 5,
    RecebimentoEmprestimo = 6
}
