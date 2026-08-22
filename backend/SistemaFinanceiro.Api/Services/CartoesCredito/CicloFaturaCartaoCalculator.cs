using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.CartoesCredito;

public static class CicloFaturaCartaoCalculator
{
    public static CicloFaturaCartao CalcularPorMesVencimento(
        CartaoCredito cartao,
        int mes,
        int ano)
    {
        ArgumentNullException.ThrowIfNull(cartao);
        return CalcularPorMesVencimento(cartao.MelhorDiaCompra, cartao.DiaVencimento, mes, ano);
    }

    public static CicloFaturaCartao CalcularPorMesVencimento(
        int melhorDiaCompra,
        int diaVencimento,
        int mes,
        int ano)
    {
        ValidarDia(melhorDiaCompra, nameof(melhorDiaCompra));
        ValidarDia(diaVencimento, nameof(diaVencimento));

        var mesVencimento = new DateOnly(ano, mes, 1);
        var ciclo = CalcularPorMesFechamento(
            melhorDiaCompra,
            diaVencimento,
            mesVencimento);

        if (ciclo.DataVencimento.Year == ano && ciclo.DataVencimento.Month == mes)
        {
            return ciclo;
        }

        ciclo = CalcularPorMesFechamento(
            melhorDiaCompra,
            diaVencimento,
            mesVencimento.AddMonths(-1));
        if (ciclo.DataVencimento.Year != ano || ciclo.DataVencimento.Month != mes)
        {
            throw new InvalidOperationException("Não foi possível determinar a competência da fatura pelo vencimento.");
        }

        return ciclo;
    }

    private static CicloFaturaCartao CalcularPorMesFechamento(
        int melhorDiaCompra,
        int diaVencimento,
        DateOnly mesFechamento)
    {
        var inicioCompetencia = CriarDataNoMes(mesFechamento.AddMonths(-1), melhorDiaCompra);
        var fimCompetencia = CriarDataNoMes(mesFechamento, melhorDiaCompra).AddDays(-1);
        var mesVencimento = mesFechamento;
        var dataVencimento = CriarDataNoMes(mesVencimento, diaVencimento);

        if (dataVencimento <= fimCompetencia)
        {
            mesVencimento = mesVencimento.AddMonths(1);
            dataVencimento = CriarDataNoMes(mesVencimento, diaVencimento);
        }

        if (inicioCompetencia > fimCompetencia || dataVencimento <= fimCompetencia)
        {
            throw new InvalidOperationException(
                "Ciclo de fatura inválido: início, fechamento e vencimento estão fora da ordem temporal.");
        }

        return new CicloFaturaCartao(inicioCompetencia, fimCompetencia, dataVencimento);
    }

    public static CicloFaturaCartao CalcularParaCompra(
        CartaoCredito cartao,
        DateOnly dataCompra)
    {
        ArgumentNullException.ThrowIfNull(cartao);

        var mesCompra = new DateOnly(dataCompra.Year, dataCompra.Month, 1);
        var inicioNovoCiclo = CriarDataNoMes(mesCompra, cartao.MelhorDiaCompra);
        var mesFechamento = dataCompra >= inicioNovoCiclo
            ? mesCompra.AddMonths(1)
            : mesCompra;

        return CalcularPorMesFechamento(
            cartao.MelhorDiaCompra,
            cartao.DiaVencimento,
            mesFechamento);
    }

    public static DateOnly CriarDataNoMes(DateOnly mes, int dia)
    {
        ValidarDia(dia, nameof(dia));
        return new DateOnly(
            mes.Year,
            mes.Month,
            Math.Min(dia, DateTime.DaysInMonth(mes.Year, mes.Month)));
    }

    private static void ValidarDia(int dia, string parametro)
    {
        if (dia is < 1 or > 31)
        {
            throw new ArgumentOutOfRangeException(parametro, "O dia deve estar entre 1 e 31.");
        }
    }
}

public readonly record struct CicloFaturaCartao(
    DateOnly InicioCompetencia,
    DateOnly FimCompetencia,
    DateOnly DataVencimento);
