using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SistemaFinanceiro.Api.Configuration;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Auth;
using SistemaFinanceiro.Api.Models;
using SistemaFinanceiro.Api.Utils;

namespace SistemaFinanceiro.Api.Services.Auth;

public sealed class AuthService : IAuthService
{
    private readonly AppDbContext _dbContext;
    private readonly PasswordHasher<Usuario> _passwordHasher;
    private readonly JwtOptions _jwtOptions;

    public AuthService(
        AppDbContext dbContext,
        PasswordHasher<Usuario> passwordHasher,
        IOptions<JwtOptions> jwtOptions)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _jwtOptions = jwtOptions.Value;
    }

    public async Task<AuthResponse> CadastrarAsync(CadastrarUsuarioRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizarEmail(request.Email);
        var emailJaExiste = await _dbContext.Usuarios
            .AnyAsync(usuario => usuario.Email == email, cancellationToken);

        if (emailJaExiste)
        {
            throw new InvalidOperationException("E-mail já cadastrado.");
        }

        var cpf = CpfValidator.Normalizar(request.Cpf);
        if (cpf is not null)
        {
            if (!CpfValidator.EhValido(cpf))
            {
                throw new InvalidOperationException("CPF inválido.");
            }

            var cpfJaExiste = await _dbContext.Usuarios
                .AnyAsync(usuario => usuario.Cpf == cpf, cancellationToken);

            if (cpfJaExiste)
            {
                throw new InvalidOperationException("CPF já cadastrado.");
            }
        }

        var usuario = new Usuario
        {
            Nome = request.Nome.Trim(),
            Email = email,
            Telefone = string.IsNullOrWhiteSpace(request.Telefone) ? null : request.Telefone.Trim(),
            Cpf = cpf
        };

        usuario.SenhaHash = _passwordHasher.HashPassword(usuario, request.Senha);

        var cartaoPadrao = new CartaoCredito
        {
            UsuarioId = usuario.Id,
            ApelidoCartao = "Padrão",
            Banco = "Padrão",
            DiaVencimento = 1,
            MelhorDiaCompra = 2,
            LimiteTotal = 0
        };

        _dbContext.Usuarios.Add(usuario);
        _dbContext.CartoesCredito.Add(cartaoPadrao);

        var authResponse = CriarCredenciais(usuario);
        _dbContext.Set<RefreshToken>().Add(new RefreshToken
        {
            UsuarioId = usuario.Id,
            TokenHash = CalcularHashToken(authResponse.RefreshToken),
            ExpiraEm = authResponse.RefreshTokenExpiraEm
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return authResponse;
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizarEmail(request.Email);
        var usuario = await _dbContext.Usuarios
            .AsNoTracking()
            .SingleOrDefaultAsync(usuario => usuario.Email == email, cancellationToken);

        if (usuario is null)
        {
            return null;
        }

        var resultado = _passwordHasher.VerifyHashedPassword(usuario, usuario.SenhaHash, request.Senha);
        if (resultado == PasswordVerificationResult.Failed)
        {
            return null;
        }

        if (resultado == PasswordVerificationResult.SuccessRehashNeeded)
        {
            usuario.SenhaHash = _passwordHasher.HashPassword(usuario, request.Senha);
            _dbContext.Usuarios.Update(usuario);
        }

        var authResponse = CriarCredenciais(usuario);
        _dbContext.Set<RefreshToken>().Add(new RefreshToken
        {
            UsuarioId = usuario.Id,
            TokenHash = CalcularHashToken(authResponse.RefreshToken),
            ExpiraEm = authResponse.RefreshTokenExpiraEm
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return authResponse;
    }

    public async Task<AuthResponse?> RenovarSessaoAsync(
        RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return null;
        }

        var tokenHash = CalcularHashToken(request.RefreshToken);
        var refreshToken = await _dbContext.Set<RefreshToken>()
            .Include(token => token.Usuario)
            .SingleOrDefaultAsync(
                token => token.TokenHash == tokenHash,
                cancellationToken);

        if (refreshToken is null || !refreshToken.EstaAtivo)
        {
            return null;
        }

        refreshToken.RevogadoEm = DateTimeOffset.UtcNow;

        var authResponse = CriarCredenciais(refreshToken.Usuario);
        _dbContext.Set<RefreshToken>().Add(new RefreshToken
        {
            UsuarioId = refreshToken.UsuarioId,
            TokenHash = CalcularHashToken(authResponse.RefreshToken),
            ExpiraEm = authResponse.RefreshTokenExpiraEm
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return authResponse;
    }

    private AuthResponse CriarCredenciais(Usuario usuario)
    {
        ValidarConfiguracaoJwt();

        var agora = DateTimeOffset.UtcNow;
        var accessTokenExpiraEm = agora.AddMinutes(_jwtOptions.AccessTokenMinutes);
        var refreshTokenExpiraEm = agora.AddHours(_jwtOptions.RefreshTokenIdleHours);

        return new AuthResponse
        {
            UsuarioId = usuario.Id,
            Nome = usuario.Nome,
            Email = usuario.Email,
            Telefone = usuario.Telefone,
            Cpf = usuario.Cpf,
            AccessToken = GerarJwt(usuario, accessTokenExpiraEm),
            AccessTokenExpiraEm = accessTokenExpiraEm,
            RefreshToken = GerarRefreshToken(),
            RefreshTokenExpiraEm = refreshTokenExpiraEm
        };
    }

    private string GerarJwt(Usuario usuario, DateTimeOffset expiraEm)
    {
        var chave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.Secret));
        var credenciais = new SigningCredentials(chave, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, usuario.Email),
            new(JwtRegisteredClaimNames.Name, usuario.Nome),
            new(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
            new(ClaimTypes.Email, usuario.Email),
            new(ClaimTypes.Name, usuario.Nome)
        };

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiraEm.UtcDateTime,
            signingCredentials: credenciais);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GerarRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }

    private static string CalcularHashToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash);
    }

    private static string NormalizarEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    private void ValidarConfiguracaoJwt()
    {
        if (string.IsNullOrWhiteSpace(_jwtOptions.Secret) || Encoding.UTF8.GetByteCount(_jwtOptions.Secret) < 32)
        {
            throw new InvalidOperationException("A configuração Jwt:Secret deve ter pelo menos 32 bytes.");
        }

        if (_jwtOptions.AccessTokenMinutes <= 0 ||
            _jwtOptions.RefreshTokenDays <= 0 ||
            _jwtOptions.RefreshTokenIdleHours <= 0)
        {
            throw new InvalidOperationException("Os tempos de expiração do JWT devem ser maiores que zero.");
        }
    }
}
