using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IProcessingServerService
{
    Task<IReadOnlyList<ProcessingServerDto>> GetAllAsync(CancellationToken ct = default);
    Task<ProcessingServerDto> AddAsync(CreateProcessingServerDto dto, CancellationToken ct = default);
    Task<ProcessingServerDto> UpdateAsync(int id, UpdateProcessingServerDto dto, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
