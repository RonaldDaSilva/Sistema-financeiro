using System.ComponentModel.DataAnnotations;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Dtos.Emprestimos;

public sealed class ContatoEmprestimoResponse
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Observacao { get; set; }
    public bool Ativo { get; set; }
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
}

public sealed class CriarContatoEmprestimoRequest
{
    [Required, MaxLength(160)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Observacao { get; set; }
}

public sealed class AtualizarContatoEmprestimoRequest
{
    [Required, MaxLength(160)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Observacao { get; set; }
}

public sealed class CriarEmprestimoRequest
{
    public Guid ContatoId { get; set; }

    [Required, MaxLength(180)]
    public string Descricao { get; set; } = string.Empty;

    [Range(
        typeof(decimal),
        "0.01",
        "9999999999999999",
        ParseLimitsInInvariantCulture = true)]
    public decimal ValorTotal { get; set; }

    public DateOnly Data { get; set; }
    public TipoEmprestimo Tipo { get; set; } = TipoEmprestimo.Avista;
    public DateOnly? DataFimRecorrencia { get; set; }
    public OrigemFinanceiraEmprestimo OrigemFinanceira { get; set; }
    public Guid? CartaoCreditoId { get; set; }
    public Guid? ContaBancariaId { get; set; }

    [Range(1, 360)]
    public int QuantidadeParcelas { get; set; } = 1;

    [MaxLength(500)]
    public string? Observacao { get; set; }
}

public sealed class AtualizarEmprestimoRequest
{
    public Guid ContatoId { get; set; }

    [Required, MaxLength(180)]
    public string Descricao { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Observacao { get; set; }
}

public sealed class RegistrarPagamentoEmprestimoRequest
{
    public DateOnly Data { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public IReadOnlyList<Guid> ParcelaIds { get; set; } = Array.Empty<Guid>();
    public IReadOnlyList<DateOnly> Competencias { get; set; } = Array.Empty<DateOnly>();

    [MaxLength(500)]
    public string? Observacao { get; set; }
}

public class EmprestimoResumoResponse
{
    public Guid Id { get; set; }
    public Guid ContatoId { get; set; }
    public string ContatoNome { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public decimal ValorPago { get; set; }
    public decimal SaldoReceber { get; set; }
    public DateOnly Data { get; set; }
    public TipoEmprestimo Tipo { get; set; }
    public DateOnly? DataFimRecorrencia { get; set; }
    public bool RecorrenciaAtiva { get; set; }
    public OrigemFinanceiraEmprestimo OrigemFinanceira { get; set; }
    public int QuantidadeParcelas { get; set; }
    public int ParcelasPagas { get; set; }
    public StatusEmprestimo Status { get; set; }
    public bool IsArquivado { get; set; }
}

public sealed class EmprestimoMensalItemResponse : EmprestimoResumoResponse
{
    public string OrigemNome { get; set; } = string.Empty;
    public decimal ValorCompetencia { get; set; }
    public DateOnly? DataCompetencia { get; set; }
    public int? NumeroParcelaCompetencia { get; set; }
    public StatusParcelaEmprestimo? StatusCompetencia { get; set; }
    public DateOnly? ProximoVencimento { get; set; }
}

public sealed class ResumoMensalEmprestimosResponse
{
    public int Mes { get; set; }
    public int Ano { get; set; }
    public decimal AReceberTotal { get; set; }
    public decimal PrevistoNoMes { get; set; }
    public decimal RecebidoNoMes { get; set; }
    public int Pagina { get; set; }
    public int TamanhoPagina { get; set; }
    public int TotalItens { get; set; }
    public int TotalPaginas { get; set; }
    public IReadOnlyList<EmprestimoMensalItemResponse> Itens { get; set; } =
        Array.Empty<EmprestimoMensalItemResponse>();
}

public sealed class ParcelaEmprestimoResponse
{
    public Guid Id { get; set; }
    public int NumeroParcela { get; set; }
    public int QuantidadeTotal { get; set; }
    public DateOnly Competencia { get; set; }
    public DateOnly DataVencimento { get; set; }
    public decimal Valor { get; set; }
    public StatusParcelaEmprestimo Status { get; set; }
    public DateOnly? DataPagamento { get; set; }
    public Guid? PagamentoEmprestimoId { get; set; }
    public bool IsVirtual { get; set; }
}

public sealed class AlteracaoRecorrenciaEmprestimoRequest
{
    public DateOnly Competencia { get; set; }

    [Range(typeof(decimal), "0.01", "9999999999999999", ParseLimitsInInvariantCulture = true)]
    public decimal Valor { get; set; }

    public EscopoAlteracaoRecorrenciaEmprestimo Escopo { get; set; }
}

public sealed class EncerrarRecorrenciaEmprestimoRequest
{
    public DateOnly UltimaCompetencia { get; set; }
}

public sealed class AlteracaoRecorrenciaEmprestimoResponse
{
    public Guid Id { get; set; }
    public DateOnly Competencia { get; set; }
    public decimal Valor { get; set; }
    public EscopoAlteracaoRecorrenciaEmprestimo Escopo { get; set; }
}

public sealed class PagamentoEmprestimoResponse
{
    public Guid Id { get; set; }
    public DateOnly Data { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public decimal ValorTotal { get; set; }
    public string? Observacao { get; set; }
    public IReadOnlyList<Guid> ParcelaIds { get; set; } = Array.Empty<Guid>();
    public DateTimeOffset CriadoEm { get; set; }
}

public sealed class EmprestimoDetalheResponse : EmprestimoResumoResponse
{
    public Guid? CartaoCreditoId { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public string? Observacao { get; set; }
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
    public IReadOnlyList<ParcelaEmprestimoResponse> Parcelas { get; set; } = Array.Empty<ParcelaEmprestimoResponse>();
    public IReadOnlyList<PagamentoEmprestimoResponse> Pagamentos { get; set; } = Array.Empty<PagamentoEmprestimoResponse>();
    public IReadOnlyList<AlteracaoRecorrenciaEmprestimoResponse> AlteracoesRecorrencia { get; set; } = Array.Empty<AlteracaoRecorrenciaEmprestimoResponse>();
}
