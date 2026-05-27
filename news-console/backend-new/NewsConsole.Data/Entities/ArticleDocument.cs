namespace NewsConsole.Data.Entities;

public sealed record ArticleDocument(
    string Id,
    string? Title,
    string? BodyPreview,
    string? FullBody,
    string? Code,
    string? Date,
    string? Time,
    string? RetrievedAt
);
