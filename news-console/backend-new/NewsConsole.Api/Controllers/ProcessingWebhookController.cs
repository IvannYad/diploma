using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api/webhooks/processing")]
[AllowAnonymous]
public sealed class ProcessingWebhookController : ControllerBase
{
    private readonly IIntellectualProcessingService _processingService;
    private readonly ILogger<ProcessingWebhookController> _logger;

    public ProcessingWebhookController(
        IIntellectualProcessingService processingService,
        ILogger<ProcessingWebhookController> logger)
    {
        _processingService = processingService;
        _logger = logger;
    }

    /// <summary>
    /// Webhook endpoint called by Docker processing code for live progress updates.
    /// </summary>
    [HttpPost("progress")]
    public async Task<IActionResult> NotifyProgress(
        [FromBody] ProcessingProgressWebhookRequest dto,
        CancellationToken ct)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.ProcessId))
                return BadRequest(new { error = "ProcessId is required" });

            var isErrorEvent = string.Equals(dto.Event, "pipeline_error", StringComparison.OrdinalIgnoreCase);
            var status = isErrorEvent ? ProcessingResultStatus.Failed : ProcessingResultStatus.Running;
            var message = dto.Message ?? dto.Error;

            await _processingService.UpdateProcessStatusAsync(
                new ProcessingStatusUpdateDto(
                    ProcessId: dto.ProcessId,
                    Status: status,
                    Message: message,
                    IsActive: isErrorEvent ? false : true,
                    LastEvent: dto.Event,
                    CurrentStage: dto.Stage,
                    StageIndex: dto.StageIndex,
                    TotalStages: dto.TotalStages,
                    Processed: dto.Processed,
                    Total: dto.Total,
                    Percent: dto.Percent),
                ct);

            return Ok(new { processId = dto.ProcessId, eventName = dto.Event });
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Progress webhook received for unknown process {ProcessId}", dto.ProcessId);
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to handle progress webhook for process {ProcessId}", dto.ProcessId);
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Failed to handle progress webhook" });
        }
    }

    /// <summary>
    /// Webhook endpoint called by Docker processing code after task completion.
    /// </summary>
    [HttpPost("completed")]
    public async Task<IActionResult> NotifyCompleted(
        [FromBody] ProcessingCompletionWebhookRequest dto,
        CancellationToken ct)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.ProcessId))
                return BadRequest(new { error = "ProcessId is required" });

            var finalStatus = dto.Succeeded
                ? ProcessingResultStatus.Success
                : ProcessingResultStatus.Failed;

            var finalMessage = dto.Succeeded
                ? dto.Message
                : string.IsNullOrWhiteSpace(dto.ValidationError)
                    ? dto.Message
                    : dto.ValidationError;

            await _processingService.UpdateProcessStatusAsync(
                new ProcessingStatusUpdateDto(
                    ProcessId: dto.ProcessId,
                    Status: finalStatus,
                    Message: finalMessage,
                    IsActive: false),
                ct);

            return Ok(new
            {
                processId = dto.ProcessId,
                status = finalStatus,
                message = "Processing completion webhook accepted",
            });
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Completion webhook received for unknown process {ProcessId}", dto.ProcessId);
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to handle completion webhook for process {ProcessId}", dto.ProcessId);
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Failed to handle completion webhook" });
        }
    }
}

public sealed record ProcessingCompletionWebhookRequest(
    string ProcessId,
    bool Succeeded,
    string? Message = null,
    string? ValidationError = null);

public sealed record ProcessingProgressWebhookRequest(
    string ProcessId,
    string Event,
    string? Stage = null,
    int? StageIndex = null,
    int? TotalStages = null,
    int? Processed = null,
    int? Total = null,
    double? Percent = null,
    string? Message = null,
    string? Error = null);
