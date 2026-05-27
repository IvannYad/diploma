using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    /// <summary>
    /// Create a new account. Returns a JWT and a one-time plain-text API key.
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register(
        [FromBody] RegisterRequestDto dto,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { error = "Email is required." });
        if (string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { error = "Password is required." });
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { error = "Name is required." });

        try
        {
            var result = await authService.RegisterAsync(dto, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Authenticate with email + password and receive a JWT.</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login(
        [FromBody] PasswordLoginRequestDto dto,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { error = "Email and password are required." });

        try
        {
            var result = await authService.LoginAsync(dto, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }
}
