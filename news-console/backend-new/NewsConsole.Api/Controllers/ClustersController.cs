using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.Interfaces;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api/clusters")]
public sealed class ClustersController(INewsService newsService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetClusters(CancellationToken ct)
    {
        var clusters = await newsService.GetClustersAsync(ct);
        return Ok(new { clusters });
    }
}
