using Microsoft.Extensions.Logging;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data.Entities;
using NewsConsole.Data.Repositories;
using System.Collections.Concurrent;

namespace NewsConsole.BusinessLogic.Services;

public sealed class IntellectualProcessingService : IIntellectualProcessingService
{
    private sealed record RuntimeProgress(
        string? LastEvent,
        string? CurrentStage,
        int? StageIndex,
        int? TotalStages,
        int? Processed,
        int? Total,
        double? Percent,
        DateTime UpdatedAtUtc);

    private static readonly ConcurrentDictionary<string, RuntimeProgress> RuntimeProgressByProcessId = new();

    private readonly IProcessingProcessRepository _repository;
    private readonly IIntellectualProcessingSchedulingService _scheduler;
    private readonly ILogger<IntellectualProcessingService> _logger;

    public IntellectualProcessingService(
        IProcessingProcessRepository repository,
        IIntellectualProcessingSchedulingService scheduler,
        ILogger<IntellectualProcessingService> logger)
    {
        _repository = repository;
        _scheduler  = scheduler;
        _logger     = logger;
    }

    public async Task<IReadOnlyList<ProcessingProcessDto>> GetActiveProcessesAsync(CancellationToken ct = default)
    {
        var entities = await _repository.GetActiveAsync(ct);
        return entities.Select(e => ApplyRuntimeProgress(MapToDto(e))).ToList();
    }

    public async Task<ProcessingProcessDto?> GetProcessAsync(string processId, CancellationToken ct = default)
    {
        var entity = await _repository.GetByIdAsync(processId, ct);
        return entity is null ? null : ApplyRuntimeProgress(MapToDto(entity));
    }

    public async Task<IReadOnlyList<ProcessingProcessDto>> GetAllProcessesAsync(CancellationToken ct = default)
    {
        var entities = await _repository.GetAllAsync(ct);
        return entities.Select(e => ApplyRuntimeProgress(MapToDto(e))).ToList();
    }

    public async Task<ProcessingProcessDto> InitiateProcessAsync(
        CreateProcessingProcessDto dto, int initiatedByUserId, CancellationToken ct = default)
    {
        _logger.LogInformation("Initiating {ProcessingType} on server {Server}", dto.Type, dto.AssignedServer ?? "auto-select");

        if (string.IsNullOrWhiteSpace(dto.MongoDbServerUrl))
            throw new InvalidOperationException("MongoDB server URL is required");

        string assignedServer = dto.AssignedServer ?? await _scheduler.SelectServerWithLeastLoadAsync(ct);

        var processId = Guid.NewGuid().ToString("N");
        var processRecord = new ProcessingProcessDto(
            Id: processId,
            Type: dto.Type,
            IsActive: true,
            AssignedServer: assignedServer,
            MongoDbServerUrl: dto.MongoDbServerUrl.Trim(),
            ResultStatus: ProcessingResultStatus.Running,
            ResultMessage: null,
            CreatedAt: DateTime.UtcNow,
            CompletedAt: null);

        try
        {
            await _scheduler.InitiateDockerContainerAsync(processRecord, dto, initiatedByUserId, ct);
            await _repository.CreateAsync(MapToEntity(processRecord), ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initiate Docker container for process {ProcessId}", processId);
            throw new InvalidOperationException($"Failed to start processing container: {ex.Message}");
        }

        _logger.LogInformation("Created processing process {ProcessId} on server {Server}", processId, assignedServer);
        return processRecord;
    }

    public async Task UpdateProcessStatusAsync(ProcessingStatusUpdateDto dto, CancellationToken ct = default)
    {
        var entity = await _repository.GetByIdAsync(dto.ProcessId, ct);
        if (entity is null)
        {
            _logger.LogWarning("Cannot update status: process {ProcessId} not found", dto.ProcessId);
            throw new KeyNotFoundException($"Processing process {dto.ProcessId} not found");
        }

        var process = MapToDto(entity);
        RuntimeProgressByProcessId.TryGetValue(dto.ProcessId, out var runtime);

        var updated = process with
        {
            IsActive = dto.IsActive ?? process.IsActive,
            ResultStatus = dto.Status,
            ResultMessage = dto.Message ?? process.ResultMessage,
            CompletedAt = dto.IsActive == false ? DateTime.UtcNow : process.CompletedAt,
            LastEvent = dto.LastEvent ?? runtime?.LastEvent ?? process.LastEvent,
            CurrentStage = dto.CurrentStage ?? runtime?.CurrentStage ?? process.CurrentStage,
            StageIndex = dto.StageIndex ?? runtime?.StageIndex ?? process.StageIndex,
            TotalStages = dto.TotalStages ?? runtime?.TotalStages ?? process.TotalStages,
            Processed = dto.Processed ?? runtime?.Processed ?? process.Processed,
            Total = dto.Total ?? runtime?.Total ?? process.Total,
            Percent = dto.Percent ?? runtime?.Percent ?? process.Percent,
        };

        RuntimeProgressByProcessId[dto.ProcessId] = new RuntimeProgress(
            LastEvent: updated.LastEvent,
            CurrentStage: updated.CurrentStage,
            StageIndex: updated.StageIndex,
            TotalStages: updated.TotalStages,
            Processed: updated.Processed,
            Total: updated.Total,
            Percent: updated.Percent,
            UpdatedAtUtc: DateTime.UtcNow);

        await _repository.UpdateAsync(MapToEntity(updated), ct);

        if (updated.IsActive == false)
            await _scheduler.TryRemoveContainerAsync(updated.Id, updated.AssignedServer, ct);

        _logger.LogInformation("Updated process {ProcessId} status to {Status}: {Message}",
            dto.ProcessId, dto.Status, dto.Message);
    }

    

    private static ProcessingProcessDto MapToDto(IntellectualProcessingProcess e) => new(
        e.Id,
        Enum.Parse<ProcessingType>(e.Type),
        e.IsActive,
        e.AssignedServer,
        e.MongoDbServerUrl,
        Enum.Parse<ProcessingResultStatus>(e.ResultStatus),
        e.ResultMessage,
        e.CreatedAt,
        e.CompletedAt);

    private static IntellectualProcessingProcess MapToEntity(ProcessingProcessDto d) => new()
    {
        Id              = d.Id,
        Type            = d.Type.ToString(),
        IsActive        = d.IsActive,
        AssignedServer  = d.AssignedServer,
        MongoDbServerUrl = d.MongoDbServerUrl,
        ResultStatus    = d.ResultStatus.ToString(),
        ResultMessage   = d.ResultMessage,
        CreatedAt       = d.CreatedAt,
        CompletedAt     = d.CompletedAt,
    };

    private static ProcessingProcessDto ApplyRuntimeProgress(ProcessingProcessDto process)
    {
        if (!RuntimeProgressByProcessId.TryGetValue(process.Id, out var runtime))
            return process;

        return process with
        {
            LastEvent    = runtime.LastEvent,
            CurrentStage = runtime.CurrentStage,
            StageIndex   = runtime.StageIndex,
            TotalStages  = runtime.TotalStages,
            Processed    = runtime.Processed,
            Total        = runtime.Total,
            Percent      = runtime.Percent,
        };
    }
}
