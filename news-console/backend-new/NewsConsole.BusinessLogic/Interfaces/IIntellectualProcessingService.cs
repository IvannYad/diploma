using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IIntellectualProcessingService
{
    Task<IReadOnlyList<ProcessingProcessDto>> GetActiveProcessesAsync(CancellationToken ct = default);
    Task<ProcessingProcessDto?> GetProcessAsync(string processId, CancellationToken ct = default);
    Task<ProcessingProcessDto> InitiateProcessAsync(CreateProcessingProcessDto dto, int initiatedByUserId, CancellationToken ct = default);
    Task UpdateProcessStatusAsync(ProcessingStatusUpdateDto dto, CancellationToken ct = default);
    Task<IReadOnlyList<ProcessingProcessDto>> GetAllProcessesAsync(CancellationToken ct = default);
}
