using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data.Entities;

namespace NewsConsole.BusinessLogic.Services;

public sealed class AuthService : IAuthService
{
    private readonly UserManager<AppUser> _userManager;
    private readonly string _jwtSecret;
    private readonly EncryptionService _encryption;

    public AuthService(
        UserManager<AppUser> userManager,
        string jwtSecret,
        EncryptionService encryption)
    {
        _userManager  = userManager;
        _jwtSecret    = jwtSecret;
        _encryption   = encryption;
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterRequestDto dto, CancellationToken ct = default)
    {
        var existing = await _userManager.FindByEmailAsync(dto.Email);
        if (existing is not null)
            throw new InvalidOperationException("An account with this email address already exists.");

        var user = new AppUser
        {
            UserName    = dto.Email,
            Email       = dto.Email,
            Name        = dto.Name,
            Surname     = dto.Surname,
            Address     = dto.Address,
            PhoneNumber = dto.Phone,
            CreatedAt   = DateTime.UtcNow,
        };

        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
            throw new InvalidOperationException(
                string.Join("; ", result.Errors.Select(e => e.Description)));

        await _userManager.AddToRoleAsync(user, AppRoles.User);

        var plainApiKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        user.EncryptedApiKey = _encryption.Encrypt(plainApiKey, user.UserName!, user.Id.ToString());
        await _userManager.UpdateAsync(user);

        var token = await GenerateJwtAsync(user);
        return new AuthResponseDto(token, user.Id, user.Email!, user.Name, AppRoles.User, plainApiKey);
    }

    public async Task<AuthResponseDto> LoginAsync(PasswordLoginRequestDto dto, CancellationToken ct = default)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email)
            ?? throw new UnauthorizedAccessException("Invalid credentials.");

        if (user.IsBlocked)
            throw new UnauthorizedAccessException("Account is blocked.");

        if (!await _userManager.CheckPasswordAsync(user, dto.Password))
            throw new UnauthorizedAccessException("Invalid credentials.");

        var roles = await _userManager.GetRolesAsync(user);
        var role  = roles.FirstOrDefault() ?? AppRoles.User;
        var token = await GenerateJwtAsync(user);

        return new AuthResponseDto(token, user.Id, user.Email!, user.Name, role);
    }

    private async Task<string> GenerateJwtAsync(AppUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var role  = roles.FirstOrDefault() ?? AppRoles.User;

        var secKey      = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
        var credentials = new SigningCredentials(secKey, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? ""),
            new("name",                         user.Name),
            new(ClaimTypes.Role,               role),
        };

        var token = new JwtSecurityToken(
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
