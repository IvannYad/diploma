namespace NewsConsole.BusinessLogic.DTOs;

public record ImportRequestDto(
    IReadOnlyList<System.Text.Json.JsonElement> Documents,
    int BatchSize = 100);

public record ImportProgressDto(
    int Inserted,
    int Total,
    bool Done,
    string? Error = null);
