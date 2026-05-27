namespace NewsConsole.Data.Entities;

/// <summary>
/// Raw document from the <c>news_with_tables</c> MongoDB collection.
/// All fields are nullable because pipeline-generated documents may omit optional fields.
/// </summary>
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
