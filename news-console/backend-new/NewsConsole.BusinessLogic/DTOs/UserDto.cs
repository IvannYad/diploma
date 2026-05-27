namespace NewsConsole.BusinessLogic.DTOs;

public sealed record UserDto(
    int Id,
    string Name,
    string? Surname,
    string? Address,
    string Email,
    string? Phone,
    string Role,
    bool IsBlocked,
    DateTime CreatedAt);
