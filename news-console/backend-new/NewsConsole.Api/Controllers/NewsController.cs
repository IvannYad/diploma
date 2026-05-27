using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api/news")]
public sealed class NewsController(INewsService newsService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetNews(
        [FromQuery] string?  q                = null,
        [FromQuery] string[] cluster          = null!,
        [FromQuery] int      min_cluster_size = 0,
        [FromQuery] int      offset           = 0,
        [FromQuery] int?     limit            = null,
        [FromQuery] string?  date_from        = null,
        [FromQuery] string?  date_to          = null,
        CancellationToken ct = default)
    {
        var query  = new NewsQueryDto(q, cluster ?? [], min_cluster_size, offset, limit, date_from, date_to);
        var result = await newsService.GetNewsAsync(query, ct);
        return Ok(result);
    }

    [HttpGet("{articleId}")]
    public async Task<IActionResult> GetArticle(string articleId, CancellationToken ct)
    {
        var article = await newsService.GetArticleAsync(articleId, ct);
        return article is null
            ? NotFound(new { error = $"Article '{articleId}' not found" })
            : Ok(article);
    }
}
