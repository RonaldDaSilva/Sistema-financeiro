namespace SistemaFinanceiro.Api.Utils;

public static class CpfValidator
{
    public static string? Normalizar(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf))
        {
            return null;
        }

        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        return string.IsNullOrWhiteSpace(digits) ? null : digits;
    }

    public static bool EhValido(string cpf)
    {
        var digits = Normalizar(cpf);
        if (digits is null || digits.Length != 11)
        {
            return false;
        }

        if (digits.Distinct().Count() == 1)
        {
            return false;
        }

        var numbers = digits.Select(character => character - '0').ToArray();
        var firstDigit = CalcularDigito(numbers, 9, 10);
        var secondDigit = CalcularDigito(numbers, 10, 11);

        return numbers[9] == firstDigit && numbers[10] == secondDigit;
    }

    private static int CalcularDigito(IReadOnlyList<int> numbers, int length, int startWeight)
    {
        var sum = 0;
        for (var index = 0; index < length; index++)
        {
            sum += numbers[index] * (startWeight - index);
        }

        var remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    }
}
