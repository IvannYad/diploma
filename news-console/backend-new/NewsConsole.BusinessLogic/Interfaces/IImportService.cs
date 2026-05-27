using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IImportService
{
    IAsyncEnumerable<ImportProgressDto> ImportNewsAsync(
        ImportRequestDto request,
        CancellationToken ct = default);
}
