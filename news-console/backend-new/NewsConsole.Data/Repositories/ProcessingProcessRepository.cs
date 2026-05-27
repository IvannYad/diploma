using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NewsConsole.Data.Entities;

namespace NewsConsole.Data.Repositories;

public sealed class ProcessingProcessRepository : IProcessingProcessRepository
{
    private readonly AppDbContext _db;
    private readonly ILogger<ProcessingProcessRepository> _logger;

    public ProcessingProcessRepository(AppDbContext db, ILogger<ProcessingProcessRepository> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<IReadOnlyList<IntellectualProcessingProcess>> GetAllAsync(CancellationToken ct = default)
        => await _db.IntellectualProcessingProcesses
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<IntellectualProcessingProcess>> GetActiveAsync(CancellationToken ct = default)
        => await _db.IntellectualProcessingProcesses
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

    public async Task<IntellectualProcessingProcess?> GetActiveByMongoDbServerUrlAsync(
        string mongoDbServerUrl, CancellationToken ct = default)
    {
        var normalizedTarget = NormalizeMongoUri(mongoDbServerUrl);
        if (string.IsNullOrWhiteSpace(normalizedTarget))
            return null;

        var entities = await _db.IntellectualProcessingProcesses
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return entities.FirstOrDefault(x => NormalizeMongoUri(x.MongoDbServerUrl) == normalizedTarget);
    }

    public async Task<IntellectualProcessingProcess?> GetByIdAsync(string processId, CancellationToken ct = default)
        => await _db.IntellectualProcessingProcesses.FindAsync([processId], ct);

    public async Task<IntellectualProcessingProcess> CreateAsync(
        IntellectualProcessingProcess entity, CancellationToken ct = default)
    {
        _db.IntellectualProcessingProcesses.Add(entity);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Created processing process {ProcessId} of type {Type}", entity.Id, entity.Type);
        return entity;
    }

    public async Task UpdateAsync(IntellectualProcessingProcess entity, CancellationToken ct = default)
    {
        var existing = await _db.IntellectualProcessingProcesses.FindAsync([entity.Id], ct);
        if (existing is null)
        {
            _logger.LogWarning("Processing process {ProcessId} not found for update", entity.Id);
            return;
        }

        existing.Type           = entity.Type;
        existing.IsActive       = entity.IsActive;
        existing.AssignedServer = entity.AssignedServer;
        existing.MongoDbServerUrl = entity.MongoDbServerUrl;
        existing.ResultStatus   = entity.ResultStatus;
        existing.ResultMessage  = entity.ResultMessage;
        existing.CreatedAt      = entity.CreatedAt;
        existing.CompletedAt    = entity.CompletedAt;

        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Updated processing process {ProcessId}", entity.Id);
    }

    public static string NormalizeMongoUri(string? uri) =>
        string.IsNullOrWhiteSpace(uri)
            ? string.Empty
            : uri.Trim().TrimEnd('/').ToLowerInvariant();
}

public interface IProcessingProcessRepository
{
    Task<IReadOnlyList<IntellectualProcessingProcess>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<IntellectualProcessingProcess>> GetActiveAsync(CancellationToken ct = default);
    Task<IntellectualProcessingProcess?> GetActiveByMongoDbServerUrlAsync(string mongoDbServerUrl, CancellationToken ct = default);
    Task<IntellectualProcessingProcess?> GetByIdAsync(string processId, CancellationToken ct = default);
    Task<IntellectualProcessingProcess> CreateAsync(IntellectualProcessingProcess entity, CancellationToken ct = default);
    Task UpdateAsync(IntellectualProcessingProcess entity, CancellationToken ct = default);
}
