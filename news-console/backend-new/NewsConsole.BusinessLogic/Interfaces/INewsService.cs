using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface INewsService
{
    Task<NewsPageDto> GetNewsAsync(NewsQueryDto query, CancellationToken ct = default);
    Task<ArticleDto?> GetArticleAsync(string articleId, CancellationToken ct = default);
    Task<IReadOnlyList<ClusterDto>> GetClustersAsync(CancellationToken ct = default);
}
