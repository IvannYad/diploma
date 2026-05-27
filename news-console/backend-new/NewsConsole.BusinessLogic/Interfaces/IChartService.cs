using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IChartService
{
    Task<SubclusterDto> FindSubclusterAsync(string clusterLabel, string articleId, CancellationToken ct = default);

    Task<OlapSchemaTreeDto> GetOlapSchemaTreeAsync(CancellationToken ct = default);

    /// <summary>
    /// Returns the raw chart config document as a dictionary so the API can
    /// pass it through to the frontend unchanged — the schema is owned by the
    /// Python ML pipeline, not by this service, so we avoid re-modelling it.
    /// </summary>
    Task<IReadOnlyDictionary<string, object?>?> GetChartConfigAsync(string clusterLabel, string scId, CancellationToken ct = default);

    Task<IReadOnlyDictionary<string, object?>?> GetChartDataAsync(string clusterLabel, string scId, CancellationToken ct = default);
}
