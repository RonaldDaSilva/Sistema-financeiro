using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Divisoes;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Divisoes;

public sealed class ContatoDivisaoService : IContatoDivisaoService
{
    private readonly AppDbContext _dbContext;

    public ContatoDivisaoService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ContatoDivisaoResponse>> ListarAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var contatos = await _dbContext.ContatosDivisao
            .AsNoTracking()
            .Include(contato => contato.UsuarioContato)
            .Where(contato => contato.UsuarioId == usuarioId && contato.Ativo)
            .ToListAsync(cancellationToken);

        return contatos
            .OrderByDescending(contato => contato.UltimoUsoEm)
            .ThenBy(contato => contato.Apelido ?? contato.UsuarioContato.Nome)
            .Select(Mapear)
            .ToList();
    }

    public async Task<ContatoDivisaoResponse> CriarAsync(
        Guid usuarioId,
        CriarContatoDivisaoRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.UsuarioContatoId == usuarioId)
        {
            throw new InvalidOperationException("Não é possível salvar o próprio usuário como contato.");
        }

        var contatoUsuario = await _dbContext.Usuarios
            .AsNoTracking()
            .SingleOrDefaultAsync(usuario => usuario.Id == request.UsuarioContatoId, cancellationToken);
        if (contatoUsuario is null)
        {
            throw new InvalidOperationException("Usuário de contato não encontrado.");
        }

        var contato = await _dbContext.ContatosDivisao
            .IgnoreQueryFilters()
            .Include(item => item.UsuarioContato)
            .SingleOrDefaultAsync(
                item => item.UsuarioId == usuarioId &&
                    item.UsuarioContatoId == request.UsuarioContatoId,
                cancellationToken);

        if (contato is null)
        {
            contato = new ContatoDivisao
            {
                UsuarioId = usuarioId,
                UsuarioContatoId = request.UsuarioContatoId,
                Apelido = NormalizarApelido(request.Apelido),
                UltimoUsoEm = DateTimeOffset.UtcNow,
                Ativo = true
            };
            _dbContext.ContatosDivisao.Add(contato);
        }
        else
        {
            contato.Apelido = NormalizarApelido(request.Apelido);
            contato.UltimoUsoEm = DateTimeOffset.UtcNow;
            contato.Ativo = true;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Mapear(contato, contatoUsuario);
    }

    public async Task<ContatoDivisaoResponse?> AtualizarAsync(
        Guid usuarioId,
        Guid id,
        AtualizarContatoDivisaoRequest request,
        CancellationToken cancellationToken = default)
    {
        var contato = await _dbContext.ContatosDivisao
            .Include(item => item.UsuarioContato)
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId,
                cancellationToken);
        if (contato is null)
        {
            return null;
        }

        contato.Apelido = NormalizarApelido(request.Apelido);
        if (request.Ativo.HasValue)
        {
            contato.Ativo = request.Ativo.Value;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(contato);
    }

    public async Task<bool> RemoverAsync(
        Guid usuarioId,
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var contato = await _dbContext.ContatosDivisao
            .SingleOrDefaultAsync(
                item => item.Id == id && item.UsuarioId == usuarioId,
                cancellationToken);
        if (contato is null)
        {
            return false;
        }

        contato.Ativo = false;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    internal static string MascararEmail(string email)
    {
        var partes = email.Split('@', 2);
        if (partes.Length != 2)
        {
            return "***";
        }

        var local = partes[0];
        var prefixo = local.Length <= 1 ? local : local[..Math.Min(2, local.Length)];
        return $"{prefixo}***@{partes[1]}";
    }

    private static ContatoDivisaoResponse Mapear(ContatoDivisao contato)
    {
        return new ContatoDivisaoResponse
        {
            Id = contato.Id,
            UsuarioContatoId = contato.UsuarioContatoId,
            NomeExibicao = contato.Apelido ?? contato.UsuarioContato.Nome,
            EmailMascarado = MascararEmail(contato.UsuarioContato.Email),
            Apelido = contato.Apelido,
            UltimoUsoEm = contato.UltimoUsoEm,
            CriadoEm = contato.CriadoEm,
            Ativo = contato.Ativo
        };
    }

    private static ContatoDivisaoResponse Mapear(ContatoDivisao contato, Usuario usuarioContato)
    {
        return new ContatoDivisaoResponse
        {
            Id = contato.Id,
            UsuarioContatoId = contato.UsuarioContatoId,
            NomeExibicao = contato.Apelido ?? usuarioContato.Nome,
            EmailMascarado = MascararEmail(usuarioContato.Email),
            Apelido = contato.Apelido,
            UltimoUsoEm = contato.UltimoUsoEm,
            CriadoEm = contato.CriadoEm,
            Ativo = contato.Ativo
        };
    }

    private static string? NormalizarApelido(string? apelido) =>
        string.IsNullOrWhiteSpace(apelido) ? null : apelido.Trim();
}
