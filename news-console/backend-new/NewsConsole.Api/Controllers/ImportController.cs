using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using System.Text;
using System.Text.Json;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class ImportController(IImportService importService) : ControllerBase
{
    [HttpPost("import-news")]
    public async Task ImportNews([FromBody] ImportRequestDto body, CancellationToken ct)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        await Response.Body.FlushAsync(ct);

        await foreach (var progress in importService.ImportNewsAsync(body, ct))
        {
            var json = JsonSerializer.Serialize(progress,
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

            var line = $"data: {json}\n\n";
            var bytes = Encoding.UTF8.GetBytes(line);
            await Response.Body.WriteAsync(bytes, ct);
            await Response.Body.FlushAsync(ct);

            if (progress.Done || progress.Error is not null)
                break;
        }
    }
}
