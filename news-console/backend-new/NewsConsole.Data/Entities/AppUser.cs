using Microsoft.AspNetCore.Identity;

namespace NewsConsole.Data.Entities;

public sealed class AppUser : IdentityUser<int>
{
    public string Name { get; set; } = "";
    public string? Surname { get; set; }
    public string? Address { get; set; }

    public string EncryptedApiKey { get; set; } = "";

    public bool IsBlocked { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
