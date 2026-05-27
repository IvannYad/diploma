namespace NewsConsole.BusinessLogic.DTOs;

/// <summary>Returned by GET /api/profile.</summary>
public sealed record ProfileDto(
    int    Id,
    string Name,
    string? Surname,
    string? Address,
    string Email,
    string? Phone,
    string Role,
    bool   HasOpenAiKey,
    DateTime CreatedAt);

/// <summary>Body for PATCH /api/profile.</summary>
public sealed record UpdateProfileDto(
    string? Name,
    string? Surname,
    string? Address,
    string? Phone,
    string? CurrentPassword,
    string? NewPassword,
    string? OpenAiKey);
