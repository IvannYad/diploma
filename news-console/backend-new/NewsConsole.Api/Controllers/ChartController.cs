using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class ChartController(
    IChartService chartService,
    IConnectionTestService connectionTestService) : ControllerBase
{
    [HttpGet("olap-schemas/tree")]
    public async Task<IActionResult> GetOlapSchemaTree(
        [FromQuery(Name = "mongo_uri")] string? mongoUri,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(mongoUri))
        {
            var connectionResult = await connectionTestService.TestAsync(mongoUri, ct);
            if (connectionResult.Status == ConnectionStatus.ConnectionFailed)
                return BadRequest(new { error = connectionResult.Message ?? "Failed to connect to MongoDB" });
        }

        var tree = await chartService.GetOlapSchemaTreeAsync(ct);
        return Ok(tree);
    }

    [HttpGet("find-subcluster")]
    public async Task<IActionResult> FindSubcluster(
        [FromQuery] string cluster,
        [FromQuery] string article_id,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cluster) || string.IsNullOrWhiteSpace(article_id))
            return BadRequest(new { error = "cluster and article_id query parameters are required" });

        var result = await chartService.FindSubclusterAsync(cluster, article_id, ct);
        return Ok(result);
    }

    [HttpGet("chart-config")]
    public async Task<IActionResult> GetChartConfig(
        [FromQuery] string cluster,
        [FromQuery] string sc_id,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cluster) || string.IsNullOrWhiteSpace(sc_id))
            return BadRequest(new { error = "cluster and sc_id query parameters are required" });

        var doc = await chartService.GetChartConfigAsync(cluster, sc_id, ct);
        return doc is null
            ? NotFound(new { error = $"Chart config not found for {cluster}/{sc_id}" })
            : Ok(doc);
    }

    [HttpGet("chart-data")]
    public async Task<IActionResult> GetChartData(
        [FromQuery] string cluster,
        [FromQuery] string sc_id,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cluster) || string.IsNullOrWhiteSpace(sc_id))
            return BadRequest(new { error = "cluster and sc_id query parameters are required" });

        var doc = await chartService.GetChartDataAsync(cluster, sc_id, ct);
        return doc is null
            ? NotFound(new { error = $"Chart data not found for {cluster}/{sc_id}" })
            : Ok(doc);
    }


}
