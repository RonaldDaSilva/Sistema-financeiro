using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Services.Divisoes;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class DivisaoTransacaoRulesTests
{
    [Fact]
    public void CalcularValores_DistribuiCentavosNoUltimoParticipante()
    {
        var valores = DivisaoTransacaoRules.CalcularValores(100m, [33.33m, 33.33m, 33.34m]);

        Assert.Equal([33.33m, 33.33m, 33.34m], valores);
        Assert.Equal(100m, valores.Sum());
    }

    [Fact]
    public void ValidarParticipantes_AceitaCriadorUsuarioSistemaEExterno()
    {
        var usuarioParticipanteId = Guid.NewGuid();
        var participantes = new[]
        {
            CriarParticipante(TipoParticipanteDivisao.Criador, 60m, 120m),
            CriarParticipante(TipoParticipanteDivisao.UsuarioSistema, 25m, 50m, usuarioParticipanteId),
            CriarParticipante(TipoParticipanteDivisao.Externo, 15m, 30m)
        };

        DivisaoTransacaoRules.ValidarParticipantes(200m, participantes);
    }

    [Fact]
    public void ValidarParticipantes_BloqueiaUsuarioDuplicado()
    {
        var usuarioParticipanteId = Guid.NewGuid();
        var participantes = new[]
        {
            CriarParticipante(TipoParticipanteDivisao.Criador, 50m, 100m),
            CriarParticipante(TipoParticipanteDivisao.UsuarioSistema, 25m, 50m, usuarioParticipanteId),
            CriarParticipante(TipoParticipanteDivisao.UsuarioSistema, 25m, 50m, usuarioParticipanteId)
        };

        var erro = Assert.Throws<InvalidOperationException>(() =>
            DivisaoTransacaoRules.ValidarParticipantes(200m, participantes));
        Assert.Contains("mesmo usuário", erro.Message);
    }

    [Fact]
    public void ValidarParticipantes_BloqueiaPercentualDiferenteDeCem()
    {
        var participantes = new[]
        {
            CriarParticipante(TipoParticipanteDivisao.Criador, 60m, 120m),
            CriarParticipante(TipoParticipanteDivisao.Externo, 30m, 60m)
        };

        var erro = Assert.Throws<InvalidOperationException>(() =>
            DivisaoTransacaoRules.ValidarParticipantes(180m, participantes));
        Assert.Contains("100%", erro.Message);
    }

    private static DivisaoTransacaoParticipante CriarParticipante(
        TipoParticipanteDivisao tipo,
        decimal percentual,
        decimal valor,
        Guid? participanteUsuarioId = null)
    {
        return new DivisaoTransacaoParticipante
        {
            TipoParticipante = tipo,
            Percentual = percentual,
            Valor = valor,
            ParticipanteUsuarioId = participanteUsuarioId,
            Ativo = true
        };
    }
}
