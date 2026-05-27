namespace NewsConsole.Data.Entities;

public sealed class IntellectualProcessingProcess
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string? AssignedServer { get; set; }
    public string? MongoDbServerUrl { get; set; }
    public string ResultStatus { get; set; } = string.Empty;
    public string? ResultMessage { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
