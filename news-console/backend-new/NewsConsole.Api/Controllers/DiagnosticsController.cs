using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.Interfaces;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class DiagnosticsController(IConnectionTestService connectionTestService) : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "ok" });

    [HttpPost("test-connection")]
    public async Task<IActionResult> TestConnection(
        [FromBody] TestConnectionRequest body,
        CancellationToken ct)
    {
        var result = await connectionTestService.TestAsync(body.Uri ?? string.Empty, ct);
        return Ok(result);
    }

    public sealed record TestConnectionRequest(string? Uri);
}
