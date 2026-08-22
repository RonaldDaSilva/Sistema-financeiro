using SistemaFinanceiro.Api.Dtos.Emprestimos;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Emprestimos;

public interface IEmprestimoService
{
    Task<IReadOnlyList<EmprestimoResumoResponse>> ListarAsync(Guid usuarioId, Guid? contatoId = null, StatusEmprestimo? status = null, bool incluirArquivados = false, CancellationToken cancellationToken = default);
    Task<EmprestimoDetalheResponse?> ObterAsync(Guid usuarioId, Guid id, CancellationToken cancellationToken = default);
    Task<EmprestimoDetalheResponse> CriarAsync(Guid usuarioId, CriarEmprestimoRequest request, CancellationToken cancellationToken = default);
    Task<EmprestimoDetalheResponse?> AtualizarAsync(Guid usuarioId, Guid id, AtualizarEmprestimoRequest request, CancellationToken cancellationToken = default);
    Task<PagamentoEmprestimoResponse?> RegistrarPagamentoAsync(Guid usuarioId, Guid id, RegistrarPagamentoEmprestimoRequest request, CancellationToken cancellationToken = default);
    Task<EmprestimoDetalheResponse?> DesfazerPagamentoAsync(Guid usuarioId, Guid id, Guid pagamentoId, CancellationToken cancellationToken = default);
    Task<EmprestimoDetalheResponse?> DefinirArquivamentoAsync(Guid usuarioId, Guid id, bool arquivar, CancellationToken cancellationToken = default);
    Task<bool> CancelarAsync(Guid usuarioId, Guid id, CancellationToken cancellationToken = default);
}
