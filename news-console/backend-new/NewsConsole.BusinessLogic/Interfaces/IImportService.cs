using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IImportService
{
    /// <summary>
    /// Validates the supplied documents, inserts them into <c>news_with_tables</c>
    /// in batches, and streams progress via the returned async enumerable.
    /// </summary>
    IAsyncEnumerable<ImportProgressDto> ImportNewsAsync(
        ImportRequestDto request,
        CancellationToken ct = default);
}
