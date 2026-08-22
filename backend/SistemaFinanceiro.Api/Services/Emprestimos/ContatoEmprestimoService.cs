using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Emprestimos;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Emprestimos;

public sealed class ContatoEmprestimoService : IContatoEmprestimoService
{
    private readonly AppDbContext _dbContext;

    public ContatoEmprestimoService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ContatoEmprestimoResponse>> ListarAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.ContatosEmprestimos
            .AsNoTracking()
            .Where(contato => contato.UsuarioId == usuarioId && contato.Ativo)
            .OrderBy(contato => contato.Nome)
            .Select(contato => Mapear(contato))
            .ToListAsync(cancellationToken);
    }

    public async Task<ContatoEmprestimoResponse> CriarAsync(
        Guid usuarioId,
        CriarContatoEmprestimoRequest request,
        CancellationToken cancellationToken = default)
    {
        var nome = NormalizarNome(request.Nome);
        var contato = new ContatoEmprestimo
        {
            UsuarioId = usuarioId,
            Nome = nome,
            Observacao = NormalizarTexto(request.Observacao)
        };

        _dbContext.ContatosEmprestimos.Add(contato);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(contato);
    }

    public async Task<ContatoEmprestimoResponse?> AtualizarAsync(
        Guid usuarioId,
        Guid id,
        AtualizarContatoEmprestimoRequest request,
        CancellationToken cancellationToken = default)
    {
        var contato = await _dbContext.ContatosEmprestimos
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId,
                cancellationToken);
        if (contato is null)
        {
            return null;
        }

        contato.Nome = NormalizarNome(request.Nome);
        contato.Observacao = NormalizarTexto(request.Observacao);
        contato.AtualizadoEm = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(contato);
    }

    public async Task<bool> RemoverAsync(
        Guid usuarioId,
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var contato = await _dbContext.ContatosEmprestimos
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId,
                cancellationToken);
        if (contato is null)
        {
            return false;
        }

        contato.Ativo = false;
        contato.AtualizadoEm = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ContatoEmprestimoResponse Mapear(ContatoEmprestimo contato) => new()
    {
        Id = contato.Id,
        Nome = contato.Nome,
        Observacao = contato.Observacao,
        Ativo = contato.Ativo,
        CriadoEm = contato.CriadoEm,
        AtualizadoEm = contato.AtualizadoEm
    };

    private static string NormalizarNome(string nome)
    {
        if (string.IsNullOrWhiteSpace(nome))
        {
            throw new InvalidOperationException("O nome do contato é obrigatório.");
        }

        return nome.Trim();
    }

    private static string? NormalizarTexto(string? texto) =>
        string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();
}
