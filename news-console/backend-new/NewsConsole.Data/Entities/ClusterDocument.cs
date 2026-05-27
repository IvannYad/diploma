namespace NewsConsole.Data.Entities;

/// <summary>
/// Raw document from the <c>clustered_articles</c> MongoDB collection.
/// </summary>
public sealed record ClusterDocument(
    string Id,
    string ClusterLabel,
    string? ScId
);
