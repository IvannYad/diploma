using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

/// <summary>
/// Handles Docker container lifecycle and server selection for processing tasks.
/// </summary>
public interface IIntellectualProcessingSchedulingService
{
    /// <summary>Picks the processing server with the least active load.</summary>
    Task<string> SelectServerWithLeastLoadAsync(CancellationToken ct = default);

    /// <summary>Creates and starts a Docker container for the given process.</summary>
    Task InitiateDockerContainerAsync(
        ProcessingProcessDto process,
        CreateProcessingProcessDto request,
        int initiatedByUserId,
        CancellationToken ct = default);

    /// <summary>Force-removes the container associated with the given process, ignoring not-found errors.</summary>
    Task TryRemoveContainerAsync(string processId, string? assignedServer, CancellationToken ct = default);
}
