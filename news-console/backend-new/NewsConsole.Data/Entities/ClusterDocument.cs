namespace NewsConsole.Data.Entities;

public sealed record ClusterDocument(
    string Id,
    string ClusterLabel,
    string? ScId
);
