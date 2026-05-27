namespace NewsConsole.Data.Entities;

/// <summary>
/// Raw document from the <c>extracted_news</c> MongoDB collection (only the fields needed for the schema tree).
/// </summary>
public sealed record ExtractedNewsDocument(
    string? ClusterLabel,
    string? ScId
);
