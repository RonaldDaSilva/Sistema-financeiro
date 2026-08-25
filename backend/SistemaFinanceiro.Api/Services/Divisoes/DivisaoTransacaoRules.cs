using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Divisoes;

public static class DivisaoTransacaoRules
{
    private const int PrazoMinimoConviteDias = 3;
    private const int PrazoPadraoConviteDias = 7;

    public static IReadOnlyList<decimal> CalcularValores(decimal valorTotal, IReadOnlyList<decimal> percentuais)
    {
        if (valorTotal <= 0)
        {
            throw new InvalidOperationException("O valor total da divisão deve ser maior que zero.");
        }

        if (percentuais.Count == 0)
        {
            throw new InvalidOperationException("A divisão deve possuir ao menos um participante.");
        }

        if (percentuais.Any(percentual => percentual <= 0 || percentual > 100))
        {
            throw new InvalidOperationException("Cada percentual deve ser maior que zero e no máximo 100%.");
        }

        if (percentuais.Sum() != 100m)
        {
            throw new InvalidOperationException("A soma dos percentuais da divisão deve ser 100%.");
        }

        var valores = new List<decimal>(percentuais.Count);
        var acumulado = 0m;

        for (var indice = 0; indice < percentuais.Count; indice++)
        {
            var valor = indice == percentuais.Count - 1
                ? valorTotal - acumulado
                : Math.Round(valorTotal * percentuais[indice] / 100m, 2, MidpointRounding.AwayFromZero);

            valores.Add(valor);
            acumulado += valor;
        }

        return valores;
    }

    public static (decimal PercentualCriador, decimal ValorCriador,
        IReadOnlyList<decimal> Percentuais, IReadOnlyList<decimal> Valores) CalcularDistribuicao(
        decimal valorTotal,
        IReadOnlyList<(decimal? Percentual, decimal? Valor)> participacoes)
    {
        if (valorTotal <= 0)
        {
            throw new InvalidOperationException("O valor total da divisão deve ser maior que zero.");
        }

        var percentuais = new List<decimal>(participacoes.Count);
        var valores = new List<decimal>(participacoes.Count);
        foreach (var participacao in participacoes)
        {
            if (participacao.Valor.HasValue == participacao.Percentual.HasValue)
            {
                throw new InvalidOperationException(
                    "Cada participante deve informar exatamente percentual ou valor.");
            }

            if (participacao.Valor.HasValue)
            {
                var valor = decimal.Round(participacao.Valor.Value, 2, MidpointRounding.AwayFromZero);
                if (valor <= 0 || valor >= valorTotal)
                {
                    throw new InvalidOperationException("O valor do participante deve ser maior que zero e menor que o total.");
                }

                valores.Add(valor);
                percentuais.Add(decimal.Round(valor * 100m / valorTotal, 2, MidpointRounding.AwayFromZero));
                continue;
            }

            var percentual = participacao.Percentual!.Value;
            if (percentual <= 0 || percentual >= 100m)
            {
                throw new InvalidOperationException("O percentual do participante deve ser maior que zero e menor que 100%.");
            }

            percentuais.Add(percentual);
            valores.Add(decimal.Round(valorTotal * percentual / 100m, 2, MidpointRounding.AwayFromZero));
        }

        var valorCriador = valorTotal - valores.Sum();
        var percentualCriador = 100m - percentuais.Sum();
        if (valorCriador <= 0 || percentualCriador <= 0)
        {
            throw new InvalidOperationException("A soma das partes de terceiros deve ser menor que o total da divisão.");
        }

        return (percentualCriador, valorCriador, percentuais, valores);
    }

    public static void ValidarParticipantes(
        decimal valorTotal,
        IReadOnlyCollection<DivisaoTransacaoParticipante> participantes)
    {
        if (participantes.Count == 0)
        {
            throw new InvalidOperationException("A divisão deve possuir participantes.");
        }

        var ativos = participantes.Where(participante => participante.Ativo).ToList();
        if (ativos.Count == 0)
        {
            throw new InvalidOperationException("A divisão deve possuir participantes ativos.");
        }

        if (ativos.Count(participante => participante.TipoParticipante == TipoParticipanteDivisao.Criador) != 1)
        {
            throw new InvalidOperationException("A divisão deve possuir exatamente um criador ativo.");
        }

        var usuariosDuplicados = ativos
            .Where(participante => participante.ParticipanteUsuarioId.HasValue)
            .GroupBy(participante => participante.ParticipanteUsuarioId!.Value)
            .Any(grupo => grupo.Count() > 1);
        if (usuariosDuplicados)
        {
            throw new InvalidOperationException("O mesmo usuário não pode aparecer duas vezes na divisão.");
        }

        if (ativos.Any(participante => participante.Percentual <= 0 || participante.Percentual > 100))
        {
            throw new InvalidOperationException("Cada percentual deve ser maior que zero e no máximo 100%.");
        }

        if (ativos.Sum(participante => participante.Percentual) != 100m)
        {
            throw new InvalidOperationException("A soma dos percentuais da divisão deve ser 100%.");
        }

        if (ativos.Sum(participante => participante.Valor) != valorTotal)
        {
            throw new InvalidOperationException("A soma dos valores da divisão deve fechar com o valor total.");
        }
    }

    public static DateTimeOffset CalcularExpiracaoConvite(
        DateOnly dataOcorrencia,
        DateTimeOffset agora)
    {
        var expiraPadrao = agora.AddDays(PrazoPadraoConviteDias);
        var vencimento = new DateTimeOffset(
            dataOcorrencia.ToDateTime(TimeOnly.MaxValue),
            agora.Offset);
        var expiraMinima = agora.AddDays(PrazoMinimoConviteDias);

        return vencimento > expiraMinima && vencimento < expiraPadrao
            ? vencimento
            : expiraPadrao;
    }
}
