using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.BusinessLogic;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api/olap-rebuild")]
public sealed class OlapRebuildController(
    IIntellectualProcessingService processingService,
    IConfiguration configuration,
    ILogger<OlapRebuildController> logger) : ControllerBase
{
    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? throw new UnauthorizedAccessException("No user id in token."));

    private static string MapResultStatus(ProcessingProcessDto process)
    {
        if (process.IsActive)
        {
            return "running";
        }

        return process.ResultStatus switch
        {
            ProcessingResultStatus.Success => "success",
            ProcessingResultStatus.Failed => "failed",
            ProcessingResultStatus.Cancelled => "cancelled",
            _ => "running",
        };
    }

    [Authorize]
    [HttpPost("start")]
    public async Task<IActionResult> StartRebuild([FromBody] StartOlapRebuildRequest request, CancellationToken ct)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Cluster)
                || string.IsNullOrWhiteSpace(request.Subcluster)
                || request.Schema.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            {
                return BadRequest(new { error = "cluster, subcluster and schema are required" });
            }

            var mongoDbServerUrl = !string.IsNullOrWhiteSpace(request.MongoDbServerUrl)
                ? request.MongoDbServerUrl.Trim()
                : configuration["Processing:DefaultMongoDbServerUrl"]
                    ?? Environment.GetEnvironmentVariable("MONGO_URI")
                    ?? string.Empty;

            if (string.IsNullOrWhiteSpace(mongoDbServerUrl))
            {
                return BadRequest(new { error = "MongoDbServerUrl is required" });
            }

            var schemaJson = request.Schema.GetRawText();
            var process = await processingService.InitiateProcessAsync(
                new CreateProcessingProcessDto(
                    Type: ProcessingType.OlapSchemaRebuild,
                    MongoDbServerUrl: mongoDbServerUrl,
                    AssignedServer: request.AssignedServer,
                    ExtraEnvironmentVariables: new Dictionary<string, string>
                    {
                        ["OLAP_REBUILD_CLUSTER"] = request.Cluster,
                        ["OLAP_REBUILD_SUBCLUSTER"] = request.Subcluster,
                        ["OLAP_REBUILD_SCHEMA_JSON"] = schemaJson,
                    }),
                CurrentUserId,
                ct);

            logger.LogInformation(
                "Started OLAP rebuild process {ProcessId} for {Cluster}/{Subcluster} on server {Server}",
                process.Id,
                request.Cluster,
                request.Subcluster,
                process.AssignedServer);

            return Accepted(new
            {
                processId = process.Id,
                status = "started",
                assignedServer = process.AssignedServer,
                progress_endpoint = $"/api/olap-rebuild/progress?processId={Uri.EscapeDataString(process.Id)}",
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Unauthorized request to start OLAP rebuild");
            return Unauthorized(new { error = "Unauthorized" });
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Invalid operation starting OLAP rebuild process");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error starting rebuild process");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [Authorize]
    [HttpGet("progress")]
    public async Task<IActionResult> GetProgress([FromQuery] string processId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(processId))
        {
            return BadRequest(new { error = "processId query parameter required" });
        }

        var process = await processingService.GetProcessAsync(processId, ct);
        if (process is null)
        {
            return NotFound(new { error = $"Process {processId} not found" });
        }

        return Ok(new
        {
            processId = process.Id,
            status = MapResultStatus(process),
            createdAt = process.CreatedAt,
            completedAt = process.CompletedAt,
            currentStage = process.CurrentStage,
            stageProgress = process.Percent is null ? 0 : (int)Math.Round(process.Percent.Value),
            lastMessage = process.ResultMessage,
            error = process.ResultStatus == ProcessingResultStatus.Failed ? process.ResultMessage : null,
        });
    }

}

public sealed record StartOlapRebuildRequest(
    string Cluster,
    string Subcluster,
    JsonElement Schema,
    string? MongoDbServerUrl = null,
    string? AssignedServer = null);
