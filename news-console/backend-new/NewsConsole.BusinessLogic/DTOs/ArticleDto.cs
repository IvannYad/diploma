namespace NewsConsole.BusinessLogic.DTOs;

/// <summary>
/// Article returned by the list/detail endpoints.
/// All string fields are kept nullable because MongoDB documents from a live
/// collection may legitimately omit optional fields — failing hard on missing
/// fields would break the entire list for one malformed document.
/// </summary>
public sealed record ArticleDto(
    string Id,
    string? Title,
    string? BodyPreview,
    string? FullBody,
    string? Code,
    string? Date,
    string? Time,
    string? RetrievedAt,
    string? ClusterLabel,
    string? ScId
);
