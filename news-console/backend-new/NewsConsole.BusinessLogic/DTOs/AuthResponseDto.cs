namespace NewsConsole.BusinessLogic.DTOs;

public sealed record AuthResponseDto(
    string Token,
    int UserId,
    string Email,
    string Name,
    string Role,
    string? ApiKey = null);
