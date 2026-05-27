using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IIntellectualProcessingSchedulingService
{
    Task<string> SelectServerWithLeastLoadAsync(CancellationToken ct = default);

    Task InitiateDockerContainerAsync(
        ProcessingProcessDto process,
        CreateProcessingProcessDto request,
        int initiatedByUserId,
        CancellationToken ct = default);

    Task TryRemoveContainerAsync(string processId, string? assignedServer, CancellationToken ct = default);
}
