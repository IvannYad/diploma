namespace NewsConsole.BusinessLogic.DTOs;

public sealed record ProcessingServerDto(
    int      Id,
    string   IpAddress,
    int      MaxCapacity,
    DateTime AddedAt);

public sealed record CreateProcessingServerDto(
    string IpAddress,
    int    MaxCapacity);

public sealed record UpdateProcessingServerDto(
    string? IpAddress,
    int?    MaxCapacity);
