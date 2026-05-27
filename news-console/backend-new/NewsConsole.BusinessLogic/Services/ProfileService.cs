using Microsoft.AspNetCore.Identity;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data.Entities;

namespace NewsConsole.BusinessLogic.Services;

/// <summary>
/// Manages the authenticated user's own profile.
/// Provides retrieval of profile data and update of personal details,
/// password changes, and the user's encrypted OpenAI API key.
/// </summary>
public sealed class ProfileService : IProfileService
{
    private readonly UserManager<AppUser> _userManager;
    private readonly EncryptionService    _encryption;

    public ProfileService(UserManager<AppUser> userManager, EncryptionService encryption)
    {
        _userManager = userManager;
        _encryption  = encryption;
    }

    public async Task<ProfileDto> GetAsync(int userId, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString())
            ?? throw new KeyNotFoundException("User not found.");

        var roles = await _userManager.GetRolesAsync(user);
        var role  = roles.FirstOrDefault() ?? "User";

        return new ProfileDto(
            Id:         user.Id,
            Name:       user.Name,
            Surname:    user.Surname,
            Address:    user.Address,
            Email:      user.Email!,
            Phone:      user.PhoneNumber,
            Role:       role,
            HasOpenAiKey: !string.IsNullOrEmpty(user.EncryptedApiKey),
            CreatedAt:  user.CreatedAt);
    }

    public async Task UpdateAsync(int userId, UpdateProfileDto dto, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString())
            ?? throw new KeyNotFoundException("User not found.");

        if (!string.IsNullOrWhiteSpace(dto.Name))
            user.Name = dto.Name.Trim();

        user.Surname     = string.IsNullOrWhiteSpace(dto.Surname)  ? null : dto.Surname.Trim();
        user.Address     = string.IsNullOrWhiteSpace(dto.Address)  ? null : dto.Address.Trim();
        user.PhoneNumber = string.IsNullOrWhiteSpace(dto.Phone)    ? null : dto.Phone.Trim();

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            throw new InvalidOperationException(
                string.Join("; ", updateResult.Errors.Select(e => e.Description)));

        if (!string.IsNullOrWhiteSpace(dto.NewPassword))
        {
            if (string.IsNullOrWhiteSpace(dto.CurrentPassword))
                throw new InvalidOperationException("Current password is required to set a new one.");

            var pwResult = await _userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
            if (!pwResult.Succeeded)
                throw new InvalidOperationException(
                    string.Join("; ", pwResult.Errors.Select(e => e.Description)));
        }

        if (dto.OpenAiKey is not null)
        {
            if (string.IsNullOrWhiteSpace(dto.OpenAiKey))
            {
                user.EncryptedApiKey = "";
            }
            else
            {
                user.EncryptedApiKey = _encryption.Encrypt(
                    dto.OpenAiKey.Trim(), user.UserName!, user.Id.ToString());
            }

            await _userManager.UpdateAsync(user);
        }
    }
}
