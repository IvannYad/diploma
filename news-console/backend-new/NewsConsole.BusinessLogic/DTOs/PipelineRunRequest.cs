namespace NewsConsole.BusinessLogic.DTOs;

public sealed record PipelineRunRequest(
    string MongoUrl,
    string? OpenAiToken,
    string? DatabaseName,
    string? SourceCollection,
    int BatchSize,
    string? ModelName,
    bool SkipCharts,
    string? PythonExecutable);
