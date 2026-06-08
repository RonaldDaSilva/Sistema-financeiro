using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Usuarios;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Utils;

namespace SistemaFinanceiro.Api.Services.Usuarios;

public sealed class UsuarioService : IUsuarioService
{
    private readonly AppDbContext _dbContext;
    private readonly PasswordHasher<Usuario> _passwordHasher;

    public UsuarioService(AppDbContext dbContext, PasswordHasher<Usuario> passwordHasher)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
    }

    public async Task<UsuarioPerfilResponse?> ObterPerfilAsync(
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var usuario = await _dbContext.Usuarios
            .AsNoTracking()
            .SingleOrDefaultAsync(usuario => usuario.Id == usuarioId, cancellationToken);

        return usuario is null ? null : MapearPerfil(usuario);
    }

    public async Task<UsuarioPerfilResponse?> AtualizarPerfilAsync(
        Guid usuarioId,
        AtualizarUsuarioRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!request.ConfirmarAlteracao)
        {
            throw new InvalidOperationException("Confirme a alteração dos dados antes de salvar.");
        }

        var usuario = await _dbContext.Usuarios
            .SingleOrDefaultAsync(usuario => usuario.Id == usuarioId, cancellationToken);

        if (usuario is null)
        {
            return null;
        }

        var email = string.IsNullOrWhiteSpace(request.Email)
            ? usuario.Email
            : NormalizarEmail(request.Email);

        var emailJaExiste = await _dbContext.Usuarios
            .AnyAsync(item => item.Id != usuarioId && item.Email == email, cancellationToken);

        if (emailJaExiste)
        {
            throw new InvalidOperationException("E-mail já cadastrado por outro usuário.");
        }

        var cpf = CpfValidator.Normalizar(request.Cpf);
        if (cpf is not null)
        {
            if (!CpfValidator.EhValido(cpf))
            {
                throw new InvalidOperationException("CPF inválido.");
            }

            var cpfJaExiste = await _dbContext.Usuarios
                .AnyAsync(item => item.Id != usuarioId && item.Cpf == cpf, cancellationToken);

            if (cpfJaExiste)
            {
                throw new InvalidOperationException("CPF já cadastrado por outro usuário.");
            }
        }

        usuario.Nome = request.Nome.Trim();
        usuario.Email = email;
        usuario.Telefone = string.IsNullOrWhiteSpace(request.Telefone) ? null : request.Telefone.Trim();
        usuario.Cpf = cpf;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapearPerfil(usuario);
    }

    public async Task<bool> AlterarSenhaAsync(
        Guid usuarioId,
        AlterarSenhaRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!request.ConfirmarAlteracao)
        {
            throw new InvalidOperationException("Confirme a alteração da senha antes de salvar.");
        }

        if (request.NovaSenha.Length < 8)
        {
            throw new InvalidOperationException("A nova senha deve ter pelo menos 8 caracteres.");
        }

        var usuario = await _dbContext.Usuarios
            .SingleOrDefaultAsync(usuario => usuario.Id == usuarioId, cancellationToken);

        if (usuario is null)
        {
            return false;
        }

        var resultado = _passwordHasher.VerifyHashedPassword(usuario, usuario.SenhaHash, request.SenhaAtual);
        if (resultado == PasswordVerificationResult.Failed)
        {
            throw new InvalidOperationException("Senha atual inválida.");
        }

        usuario.SenhaHash = _passwordHasher.HashPassword(usuario, request.NovaSenha);

        await _dbContext.RefreshTokens
            .Where(token => token.UsuarioId == usuarioId && token.RevogadoEm == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(token => token.RevogadoEm, DateTimeOffset.UtcNow),
                cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ExcluirContaAsync(
        Guid usuarioId,
        ExcluirContaRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(request.Confirmacao.Trim(), "EXCLUIR", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Digite EXCLUIR para confirmar a exclusão da conta.");
        }

        var usuario = await _dbContext.Usuarios
            .SingleOrDefaultAsync(usuario => usuario.Id == usuarioId, cancellationToken);

        if (usuario is null)
        {
            return false;
        }

        var resultado = _passwordHasher.VerifyHashedPassword(usuario, usuario.SenhaHash, request.Senha);
        if (resultado == PasswordVerificationResult.Failed)
        {
            throw new InvalidOperationException("Senha inválida.");
        }

        await _dbContext.Transacoes.Where(item => item.UsuarioId == usuarioId).ExecuteDeleteAsync(cancellationToken);
        await _dbContext.ComprasParceladas.Where(item => item.UsuarioId == usuarioId).ExecuteDeleteAsync(cancellationToken);
        await _dbContext.CartoesCredito.Where(item => item.UsuarioId == usuarioId).ExecuteDeleteAsync(cancellationToken);
        await _dbContext.Categorias.Where(item => item.UsuarioId == usuarioId).ExecuteDeleteAsync(cancellationToken);
        await _dbContext.RefreshTokens.Where(item => item.UsuarioId == usuarioId).ExecuteDeleteAsync(cancellationToken);

        _dbContext.Usuarios.Remove(usuario);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static UsuarioPerfilResponse MapearPerfil(Usuario usuario)
    {
        return new UsuarioPerfilResponse
        {
            Id = usuario.Id,
            Nome = usuario.Nome,
            Email = usuario.Email,
            Telefone = usuario.Telefone,
            Cpf = usuario.Cpf
        };
    }

    private static string NormalizarEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }
}
