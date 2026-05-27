using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NewsConsole.Data.Entities;

namespace NewsConsole.Data.Repositories;

public sealed class ProcessingServerRepository : IProcessingServerRepository
{
    private readonly AppDbContext _db;
    private readonly ILogger<ProcessingServerRepository> _logger;

    public ProcessingServerRepository(AppDbContext db, ILogger<ProcessingServerRepository> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ProcessingServer>> GetAllAsync(CancellationToken ct = default)
        => await _db.ProcessingServers.OrderBy(s => s.AddedAt).ToListAsync(ct);

    public async Task<ProcessingServer?> GetByIdAsync(int id, CancellationToken ct = default)
        => await _db.ProcessingServers.FindAsync([id], ct);

    public async Task<ProcessingServer> AddAsync(ProcessingServer server, CancellationToken ct = default)
    {
        _db.ProcessingServers.Add(server);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Added processing server {ServerId} with IP {IpAddress}", server.Id, server.IpAddress);
        return server;
    }

    public async Task UpdateAsync(ProcessingServer server, CancellationToken ct = default)
    {
        _db.ProcessingServers.Update(server);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Updated processing server {ServerId}", server.Id);
    }

    public async Task DeleteAsync(ProcessingServer server, CancellationToken ct = default)
    {
        _db.ProcessingServers.Remove(server);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Deleted processing server {ServerId}", server.Id);
    }
}

public interface IProcessingServerRepository
{
    Task<IReadOnlyList<ProcessingServer>> GetAllAsync(CancellationToken ct = default);
    Task<ProcessingServer?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<ProcessingServer> AddAsync(ProcessingServer server, CancellationToken ct = default);
    Task UpdateAsync(ProcessingServer server, CancellationToken ct = default);
    Task DeleteAsync(ProcessingServer server, CancellationToken ct = default);
}
