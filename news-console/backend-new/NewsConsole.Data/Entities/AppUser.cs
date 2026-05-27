using Microsoft.AspNetCore.Identity;

namespace NewsConsole.Data.Entities;

public sealed class AppUser : IdentityUser<int>
{
    public string Name { get; set; } = "";
    public string? Surname { get; set; }
    public string? Address { get; set; }

    /// <summary>
    /// AES-256-CBC(IV+ciphertext) of the system-assigned API key, encoded as Base64.
    /// The per-user encryption key is derived from (UserName:Id) + system passphrase via PBKDF2.
    /// </summary>
    public string EncryptedApiKey { get; set; } = "";

    /// <summary>When <c>true</c> the user cannot log in.</summary>
    public bool IsBlocked { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
