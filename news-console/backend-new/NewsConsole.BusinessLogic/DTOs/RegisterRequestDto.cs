namespace NewsConsole.BusinessLogic.DTOs;

public sealed record RegisterRequestDto(
    string Name,
    string? Surname,
    string? Address,
    string Email,
    string? Phone,
    string Password);
