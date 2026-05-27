namespace NewsConsole.Data.Entities;

public sealed record ExtractedNewsDocument(
    string? ClusterLabel,
    string? ScId
);
