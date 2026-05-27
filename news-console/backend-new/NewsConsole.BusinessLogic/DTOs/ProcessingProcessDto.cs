namespace NewsConsole.BusinessLogic.DTOs;

/// <summary>
/// Type of intellectual processing task
/// </summary>
public enum ProcessingType
{
    /// <summary>Intellectual processing of news articles (clustering, extraction, metrics)</summary>
    IntellectualProcessing,
    
    /// <summary>OLAP schema rebuild</summary>
    OlapSchemaRebuild,
}

/// <summary>
/// Status of a processing task result
/// </summary>
public enum ProcessingResultStatus
{
    /// <summary>Process is pending or running</summary>
    Running,
    
    /// <summary>Process completed successfully</summary>
    Success,
    
    /// <summary>Process failed with an error</summary>
    Failed,
    
    /// <summary>Process was cancelled</summary>
    Cancelled,
}

public sealed record ProcessingProcessDto(
    string Id,
    ProcessingType Type,
    bool IsActive,
    string? AssignedServer,
    string? MongoDbServerUrl,
    ProcessingResultStatus ResultStatus,
    string? ResultMessage,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    string? LastEvent = null,
    string? CurrentStage = null,
    int? StageIndex = null,
    int? TotalStages = null,
    int? Processed = null,
    int? Total = null,
    double? Percent = null);

public sealed record CreateProcessingProcessDto(
    ProcessingType Type,
    string MongoDbServerUrl,
    string? AssignedServer = null,
    IReadOnlyDictionary<string, string>? ExtraEnvironmentVariables = null);

public sealed record UpdateProcessingProcessDto(
    bool? IsActive,
    ProcessingResultStatus? ResultStatus,
    string? ResultMessage);

public sealed record ProcessingStatusUpdateDto(
    string ProcessId,
    ProcessingResultStatus Status,
    string? Message = null,
    bool? IsActive = null,
    string? LastEvent = null,
    string? CurrentStage = null,
    int? StageIndex = null,
    int? TotalStages = null,
    int? Processed = null,
    int? Total = null,
    double? Percent = null);
