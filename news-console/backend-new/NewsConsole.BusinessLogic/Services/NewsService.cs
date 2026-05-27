using System.Text.RegularExpressions;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data.Repositories;

namespace NewsConsole.BusinessLogic.Services;

/// <summary>
/// Retrieves and filters news articles from MongoDB.
/// Enriches articles with their cluster and subcluster labels, exposes distinct cluster
/// summaries, and supports paginated, keyword-filtered, and cluster-filtered queries.
/// </summary>
public sealed partial class NewsService(INewsRepository repository) : INewsService
{
    [GeneratedRegex(@"<[^>]+>", RegexOptions.Compiled)]
    private static partial Regex HtmlTagRegex();

    public async Task<IReadOnlyList<ClusterDto>> GetClustersAsync(CancellationToken ct = default)
    {
        var articles  = await repository.GetAllArticlesAsync(ct);
        var clusters  = await repository.GetClusterDocumentsAsync(ct);

        var clusterMap = clusters.ToDictionary(c => c.Id, c => c.ClusterLabel);

        return articles
            .Select(a => clusterMap.TryGetValue(a.Id, out var label) ? label : null)
            .Where(label => !string.IsNullOrEmpty(label))
            .GroupBy(label => label!)
            .Select(g => new ClusterDto(g.Key, g.Count()))
            .OrderBy(c => c.Label)
            .ToList();
    }

    public async Task<NewsPageDto> GetNewsAsync(NewsQueryDto query, CancellationToken ct = default)
    {
        var articles  = await repository.GetAllArticlesAsync(ct);
        var clusters  = await repository.GetClusterDocumentsAsync(ct);

        var clusterMap = clusters.ToDictionary(c => c.Id, c => (ClusterLabel: c.ClusterLabel, ScId: c.ScId));

        var dtos = articles.Select(a =>
        {
            clusterMap.TryGetValue(a.Id, out var info);
            return new ArticleDto(a.Id, a.Title, a.BodyPreview, a.FullBody, a.Code, a.Date, a.Time, a.RetrievedAt, info.ClusterLabel, info.ScId);
        }).ToList();

        IEnumerable<ArticleDto> filtered = dtos;

        if (query.MinClusterSize > 0)
        {
            var clusterCounts = dtos
                .Where(a => !string.IsNullOrEmpty(a.ClusterLabel))
                .GroupBy(a => a.ClusterLabel!)
                .ToDictionary(g => g.Key, g => g.Count());

            filtered = filtered.Where(a =>
                !string.IsNullOrEmpty(a.ClusterLabel) &&
                clusterCounts.TryGetValue(a.ClusterLabel!, out var cnt) &&
                cnt >= query.MinClusterSize);
        }

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var term = query.SearchTerm.Trim().ToLowerInvariant();
            filtered = filtered.Where(a =>
                (a.Title?.ToLowerInvariant().Contains(term) ?? false) ||
                HtmlTagRegex().Replace(a.FullBody ?? "", " ").ToLowerInvariant().Contains(term));
        }

        if (query.Clusters.Count > 0)
        {
            var clusterSet = new HashSet<string>(query.Clusters, StringComparer.Ordinal);
            filtered = filtered.Where(a => a.ClusterLabel is not null && clusterSet.Contains(a.ClusterLabel));
        }

        if (TryParseQueryDate(query.DateFrom, out var dateFrom))
            filtered = filtered.Where(a => MatchesDateFrom(a, dateFrom));

        if (TryParseQueryDate(query.DateTo, out var dateTo))
            filtered = filtered.Where(a => MatchesDateTo(a, dateTo));

        var list = filtered
            .OrderBy(a => GetPublicationDateTime(a).HasValue ? 0 : 1)
            .ThenByDescending(GetPublicationDateTime)
            .ThenByDescending(a => a.Id, StringComparer.Ordinal)
            .ToList();
        var total = list.Count;
        var page  = list.Skip(query.Offset);

        if (query.Limit.HasValue)
            page = page.Take(query.Limit.Value);

        return new NewsPageDto(total, query.Offset, query.Limit, page.ToList());
    }

    public async Task<ArticleDto?> GetArticleAsync(string articleId, CancellationToken ct = default)
    {
        var articles = await repository.GetAllArticlesAsync(ct);
        var article  = articles.FirstOrDefault(a => a.Id == articleId);
        if (article is null) return null;

        var clusters  = await repository.GetClusterDocumentsAsync(ct);
        var clusterDoc = clusters.FirstOrDefault(c => c.Id == articleId);

        return new ArticleDto(article.Id, article.Title, article.BodyPreview, article.FullBody, article.Code,
            article.Date, article.Time, article.RetrievedAt, clusterDoc?.ClusterLabel, clusterDoc?.ScId);
    }

    private static bool TryParseQueryDate(string? value, out DateOnly date)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            date = default;
            return false;
        }

        return DateOnly.TryParse(value.Trim(), out date);
    }

    private static DateTime? GetPublicationDateTime(ArticleDto article)
    {
        if (string.IsNullOrWhiteSpace(article.Date))
            return null;

        if (!DateOnly.TryParse(article.Date.Trim(), out var day))
            return null;

        if (!string.IsNullOrWhiteSpace(article.Time) &&
            TimeOnly.TryParse(article.Time.Trim(), out var time))
            return day.ToDateTime(time);

        return day.ToDateTime(TimeOnly.MinValue);
    }

    private static bool MatchesDateFrom(ArticleDto article, DateOnly dateFrom)
    {
        var published = GetPublicationDateTime(article);
        if (published is null)
            return false;

        return DateOnly.FromDateTime(published.Value) >= dateFrom;
    }

    private static bool MatchesDateTo(ArticleDto article, DateOnly dateTo)
    {
        var published = GetPublicationDateTime(article);
        if (published is null)
            return false;

        return DateOnly.FromDateTime(published.Value) <= dateTo;
    }
}
