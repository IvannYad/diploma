namespace NewsConsole.BusinessLogic.DTOs;

public sealed record NewsQueryDto(
    string? SearchTerm,
    IReadOnlyList<string> Clusters,
    int MinClusterSize,
    int Offset,
    int? Limit,
    string? DateFrom = null,
    string? DateTo = null
);
