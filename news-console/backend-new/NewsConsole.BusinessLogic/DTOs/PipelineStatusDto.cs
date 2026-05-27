namespace NewsConsole.BusinessLogic.DTOs;

public sealed record PipelineStatusDto(
    string? RunId,
    bool IsRunning,
    string LastEvent,
    string? Stage,
    int? StageIndex,
    int? TotalStages,
    int? Processed,
    int? Total,
    double? Percent,
    string? Error,
    int? ExitCode,
    DateTime? StartedAtUtc,
    DateTime? LastUpdateUtc,
    DateTime? FinishedAtUtc)
{
    public static PipelineStatusDto Idle() => new(
        RunId: null,
        IsRunning: false,
        LastEvent: "idle",
        Stage: null,
        StageIndex: null,
        TotalStages: null,
        Processed: null,
        Total: null,
        Percent: null,
        Error: null,
        ExitCode: null,
        StartedAtUtc: null,
        LastUpdateUtc: null,
        FinishedAtUtc: null);

    public static PipelineStatusDto Starting(string runId) => new(
        RunId: runId,
        IsRunning: true,
        LastEvent: "pipeline_starting",
        Stage: "starting",
        StageIndex: 0,
        TotalStages: null,
        Processed: 0,
        Total: 1,
        Percent: 0,
        Error: null,
        ExitCode: null,
        StartedAtUtc: DateTime.UtcNow,
        LastUpdateUtc: DateTime.UtcNow,
        FinishedAtUtc: null);
}
