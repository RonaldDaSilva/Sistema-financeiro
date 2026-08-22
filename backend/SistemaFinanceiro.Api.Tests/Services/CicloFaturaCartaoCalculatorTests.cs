using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.CartoesCredito;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class CicloFaturaCartaoCalculatorTests
{
    [Theory]
    [InlineData(10, 17, 2026, 8, 5, 2026, 8, 17)]
    [InlineData(10, 17, 2026, 8, 9, 2026, 8, 17)]
    [InlineData(10, 17, 2026, 8, 10, 2026, 9, 17)]
    [InlineData(31, 8, 2026, 7, 30, 2026, 8, 8)]
    [InlineData(31, 8, 2026, 7, 31, 2026, 9, 8)]
    [InlineData(31, 8, 2026, 8, 1, 2026, 9, 8)]
    [InlineData(31, 8, 2026, 8, 15, 2026, 9, 8)]
    [InlineData(31, 8, 2026, 8, 30, 2026, 9, 8)]
    [InlineData(31, 8, 2026, 8, 31, 2026, 10, 8)]
    public void CalcularParaCompra_UsaPrimeiroVencimentoPosteriorAoFechamento(
        int melhorDia,
        int diaVencimento,
        int anoCompra,
        int mesCompra,
        int diaCompra,
        int anoVencimento,
        int mesVencimento,
        int diaVencimentoEsperado)
    {
        var cartao = CriarCartao(melhorDia, diaVencimento);

        var ciclo = CicloFaturaCartaoCalculator.CalcularParaCompra(
            cartao,
            new DateOnly(anoCompra, mesCompra, diaCompra));

        Assert.Equal(
            new DateOnly(anoVencimento, mesVencimento, diaVencimentoEsperado),
            ciclo.DataVencimento);
        Assert.True(ciclo.InicioCompetencia <= ciclo.FimCompetencia);
        Assert.True(ciclo.DataVencimento > ciclo.FimCompetencia);
    }

    [Theory]
    [InlineData(2027, 2, 28, 2027, 4, 8)]
    [InlineData(2028, 2, 29, 2028, 4, 8)]
    [InlineData(2027, 4, 30, 2027, 6, 8)]
    [InlineData(2026, 12, 31, 2027, 2, 8)]
    public void CalcularParaCompra_AjustaDia31EMantemViradasDeCalendario(
        int anoCompra,
        int mesCompra,
        int diaCompra,
        int anoVencimento,
        int mesVencimento,
        int diaVencimento)
    {
        var ciclo = CicloFaturaCartaoCalculator.CalcularParaCompra(
            CriarCartao(31, 8),
            new DateOnly(anoCompra, mesCompra, diaCompra));

        Assert.Equal(
            new DateOnly(anoVencimento, mesVencimento, diaVencimento),
            ciclo.DataVencimento);
    }

    [Theory]
    [InlineData(31, 8, 2027, 1, 5)]
    [InlineData(31, 8, 2028, 1, 5)]
    [InlineData(31, 8, 2027, 3, 4)]
    [InlineData(31, 8, 2027, 4, 5)]
    [InlineData(10, 17, 2026, 1, 12)]
    public void CompetenciasConsecutivas_NaoSobrepoemNemDeixamLacunas(
        int melhorDia,
        int diaVencimento,
        int ano,
        int mesInicial,
        int quantidadeMeses)
    {
        CicloFaturaCartao? anterior = null;

        for (var indice = 0; indice < quantidadeMeses; indice++)
        {
            var referencia = new DateOnly(ano, mesInicial, 1).AddMonths(indice);
            var atual = CicloFaturaCartaoCalculator.CalcularPorMesVencimento(
                melhorDia,
                diaVencimento,
                referencia.Month,
                referencia.Year);

            Assert.True(atual.InicioCompetencia <= atual.FimCompetencia);
            Assert.True(atual.DataVencimento > atual.FimCompetencia);
            if (anterior.HasValue)
            {
                Assert.Equal(anterior.Value.FimCompetencia.AddDays(1), atual.InicioCompetencia);
            }

            anterior = atual;
        }
    }

    private static CartaoCredito CriarCartao(int melhorDia, int diaVencimento) => new()
    {
        MelhorDiaCompra = melhorDia,
        DiaVencimento = diaVencimento
    };
}
