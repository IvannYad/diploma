using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IChartService
{
    Task<SubclusterDto> FindSubclusterAsync(string clusterLabel, string articleId, CancellationToken ct = default);

    Task<OlapSchemaTreeDto> GetOlapSchemaTreeAsync(CancellationToken ct = default);

    Task<IReadOnlyDictionary<string, object?>?> GetChartConfigAsync(string clusterLabel, string scId, CancellationToken ct = default);

    Task<IReadOnlyDictionary<string, object?>?> GetChartDataAsync(string clusterLabel, string scId, CancellationToken ct = default);
}
