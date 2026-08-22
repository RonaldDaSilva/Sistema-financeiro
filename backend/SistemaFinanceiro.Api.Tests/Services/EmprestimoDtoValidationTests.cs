using System.ComponentModel.DataAnnotations;
using System.Globalization;
using SistemaFinanceiro.Api.Dtos.Emprestimos;
using SistemaFinanceiro.Api.Models;
using Xunit;

namespace SistemaFinanceiro.Api.Tests.Services;

public sealed class EmprestimoDtoValidationTests
{
    [Fact]
    public void CriarEmprestimoRequest_ValidaDecimalComCulturaPtBr()
    {
        var culturaAnterior = CultureInfo.CurrentCulture;
        var culturaUiAnterior = CultureInfo.CurrentUICulture;

        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("pt-BR");
            CultureInfo.CurrentUICulture = CultureInfo.GetCultureInfo("pt-BR");
            var request = new CriarEmprestimoRequest
            {
                ContatoId = Guid.NewGuid(),
                Descricao = "Empréstimo de teste",
                ValorTotal = 0.01m,
                Data = new DateOnly(2026, 8, 20),
                OrigemFinanceira = OrigemFinanceiraEmprestimo.ContaBancaria,
                ContaBancariaId = Guid.NewGuid(),
                QuantidadeParcelas = 1
            };
            var resultados = new List<ValidationResult>();

            var valido = Validator.TryValidateObject(
                request,
                new ValidationContext(request),
                resultados,
                validateAllProperties: true);

            Assert.True(valido, string.Join(Environment.NewLine, resultados));
        }
        finally
        {
            CultureInfo.CurrentCulture = culturaAnterior;
            CultureInfo.CurrentUICulture = culturaUiAnterior;
        }
    }
}
