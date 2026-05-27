namespace NewsConsole.BusinessLogic.DTOs;

/// <summary>
/// Encapsulates all filter/paging parameters for the article list query.
/// A dedicated object here avoids a 5-parameter method signature (ISP / clean boundaries)
/// and makes it trivial to add new filters without changing every caller.
/// </summary>
public sealed record NewsQueryDto(
    string? SearchTerm,
    IReadOnlyList<string> Clusters,
    int MinClusterSize,
    int Offset,
    int? Limit,
    string? DateFrom = null,
    string? DateTo = null
);
