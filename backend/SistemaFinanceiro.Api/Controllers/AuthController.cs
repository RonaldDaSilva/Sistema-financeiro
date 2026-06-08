using Microsoft.AspNetCore.Mvc;
using SistemaFinanceiro.Api.Dtos.Auth;
using SistemaFinanceiro.Api.Services.Auth;

namespace SistemaFinanceiro.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("cadastro")]
    public async Task<ActionResult<AuthResponse>> Cadastrar(
        CadastrarUsuarioRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _authService.CadastrarAsync(request, cancellationToken);
            return CreatedAtAction(nameof(Cadastrar), new { id = response.UsuarioId }, response);
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _authService.LoginAsync(request, cancellationToken);
        if (response is null)
        {
            return Unauthorized(new { message = "E-mail ou senha inválidos." });
        }

        return Ok(response);
    }
}
