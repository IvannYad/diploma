namespace NewsConsole.BusinessLogic.DTOs;

public sealed record AuthResponseDto(
    string Token,
    int UserId,
    string Email,
    string Name,
    string Role,
    /// <summary>Plain-text API key — returned only on registration. Store it securely; it cannot be retrieved again.</summary>
    string? ApiKey = null);
