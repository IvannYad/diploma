using Microsoft.AspNetCore.Identity;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data.Entities;

namespace NewsConsole.BusinessLogic.Services;

/// <summary>
/// Resolves a decrypted OpenAI API key for a given user.
/// Retrieves the user's stored encrypted key and decrypts it using the per-user
/// key derived from the user's identity via <see cref="EncryptionService"/>.
/// </summary>
public sealed class OpenAiKeyResolver : IOpenAiKeyResolver
{
    private readonly UserManager<AppUser> _userManager;
    private readonly EncryptionService _encryption;

    public OpenAiKeyResolver(UserManager<AppUser> userManager, EncryptionService encryption)
    {
        _userManager = userManager;
        _encryption = encryption;
    }

    public async Task<string> GetDecryptedKeyAsync(int userId, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString())
            ?? throw new KeyNotFoundException("User not found.");

        if (string.IsNullOrWhiteSpace(user.EncryptedApiKey))
            throw new InvalidOperationException("OpenAI API key is not set in user profile.");

        if (string.IsNullOrWhiteSpace(user.UserName))
            throw new InvalidOperationException("User name is missing; cannot decrypt API key.");

        return _encryption.Decrypt(user.EncryptedApiKey, user.UserName, user.Id.ToString());
    }
}
