namespace NewsConsole.BusinessLogic.DTOs;

public enum ProcessingType
{
    IntellectualProcessing,
    
    OlapSchemaRebuild,
}

public enum ProcessingResultStatus
{
    Running,
    
    Success,
    
    Failed,
    
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
