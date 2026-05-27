namespace NewsConsole.BusinessLogic.DTOs;

/// <summary>Sent by the client to upload a batch of raw news documents.</summary>
/// <param name="Documents">Raw JSON array of news records.</param>
/// <param name="BatchSize">How many documents to insert per round-trip (default 100).</param>
public record ImportRequestDto(
    IReadOnlyList<System.Text.Json.JsonElement> Documents,
    int BatchSize = 100);

/// <summary>Progress event streamed back to the client via Server-Sent Events.</summary>
public record ImportProgressDto(
    int Inserted,
    int Total,
    bool Done,
    string? Error = null);
