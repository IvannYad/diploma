namespace NewsConsole.BusinessLogic.DTOs;

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
