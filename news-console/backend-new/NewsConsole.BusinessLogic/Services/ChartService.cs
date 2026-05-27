using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data.Repositories;

namespace NewsConsole.BusinessLogic.Services;

public sealed class ChartService(IChartRepository repository) : IChartService
{
    public async Task<SubclusterDto> FindSubclusterAsync(
        string clusterLabel, string articleId, CancellationToken ct = default)
    {
        var scId = await repository.FindSubclusterIdAsync(clusterLabel, articleId, ct);
        return new SubclusterDto(scId ?? string.Empty, scId is not null);
    }

    public async Task<OlapSchemaTreeDto> GetOlapSchemaTreeAsync(CancellationToken ct = default)
    {
        var docs = await repository.GetExtractedNewsDocumentsAsync(ct);

        var tree = docs
            .Where(d => !string.IsNullOrWhiteSpace(d.ClusterLabel) && !string.IsNullOrWhiteSpace(d.ScId))
            .GroupBy(d => d.ClusterLabel!)
            .OrderBy(g => g.Key)
            .Select(g => new OlapClusterTreeDto(
                g.Key,
                g.Select(d => d.ScId!)
                 .Distinct(StringComparer.Ordinal)
                 .OrderBy(x => x, StringComparer.Ordinal)
                 .Select(x => new OlapSubclusterTreeDto(x))
                 .ToList()))
            .ToList();

        return new OlapSchemaTreeDto(tree);
    }

    public Task<IReadOnlyDictionary<string, object?>?> GetChartConfigAsync(
        string clusterLabel, string scId, CancellationToken ct = default)
        => repository.GetChartConfigAsync(clusterLabel, scId, ct);

    public Task<IReadOnlyDictionary<string, object?>?> GetChartDataAsync(
        string clusterLabel, string scId, CancellationToken ct = default)
        => repository.GetChartDataAsync(clusterLabel, scId, ct);
}
