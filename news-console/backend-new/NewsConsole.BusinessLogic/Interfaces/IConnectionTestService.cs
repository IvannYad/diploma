using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IConnectionTestService
{
    Task<ConnectionTestDto> TestAsync(string uri, CancellationToken ct = default);
}
