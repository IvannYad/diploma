using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data.Entities;
using NewsConsole.Data.Repositories;

namespace NewsConsole.BusinessLogic.Services;

/// <summary>
/// Manages the registry of remote intellectual-processing servers.
/// Provides full CRUD operations for server entries (IP address, maximum capacity)
/// that are used by the scheduling service to distribute processing jobs.
/// </summary>
public sealed class ProcessingServerService : IProcessingServerService
{
    private readonly IProcessingServerRepository _repository;

    public ProcessingServerService(IProcessingServerRepository repository)
        => _repository = repository;

    public async Task<IReadOnlyList<ProcessingServerDto>> GetAllAsync(CancellationToken ct = default)
    {
        var servers = await _repository.GetAllAsync(ct);
        return servers.Select(Map).ToList();
    }

    public async Task<ProcessingServerDto> AddAsync(CreateProcessingServerDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.IpAddress))
            throw new InvalidOperationException("IP address is required.");
        if (dto.MaxCapacity <= 0)
            throw new InvalidOperationException("Max capacity must be greater than 0.");

        var server = new ProcessingServer
        {
            IpAddress   = dto.IpAddress.Trim(),
            MaxCapacity = dto.MaxCapacity,
            AddedAt     = DateTime.UtcNow,
        };

        var added = await _repository.AddAsync(server, ct);
        return Map(added);
    }

    public async Task<ProcessingServerDto> UpdateAsync(int id, UpdateProcessingServerDto dto, CancellationToken ct = default)
    {
        var server = await _repository.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Server {id} not found.");

        if (!string.IsNullOrWhiteSpace(dto.IpAddress))
            server.IpAddress = dto.IpAddress.Trim();
        if (dto.MaxCapacity.HasValue)
        {
            if (dto.MaxCapacity.Value <= 0)
                throw new InvalidOperationException("Max capacity must be greater than 0.");
            server.MaxCapacity = dto.MaxCapacity.Value;
        }

        await _repository.UpdateAsync(server, ct);
        return Map(server);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var server = await _repository.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Server {id} not found.");
        await _repository.DeleteAsync(server, ct);
    }

    private static ProcessingServerDto Map(ProcessingServer s) =>
        new(s.Id, s.IpAddress, s.MaxCapacity, s.AddedAt);
}
