using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.BusinessLogic;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api/admin/processing")]
[Authorize]
public sealed class ProcessingController : ControllerBase
{
    private readonly IIntellectualProcessingService _processingService;
    private readonly ILogger<ProcessingController> _logger;

    public ProcessingController(
        IIntellectualProcessingService processingService,
        ILogger<ProcessingController> logger)
    {
        _processingService = processingService;
        _logger = logger;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? throw new UnauthorizedAccessException("No user id in token."));

    /// <summary>
    /// Get all active (running) processing processes
    /// </summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActiveProcesses(CancellationToken ct)
    {
        try
        {
            var processes = await _processingService.GetActiveProcessesAsync(ct);
            return Ok(processes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving active processes");
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Failed to retrieve active processes" });
        }
    }

    /// <summary>
    /// Get all processing processes including completed/failed ones
    /// </summary>
    [HttpGet("all")]
    public async Task<IActionResult> GetAllProcesses(CancellationToken ct)
    {
        try
        {
            var processes = await _processingService.GetAllProcessesAsync(ct);
            return Ok(processes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving all processes");
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Failed to retrieve processes" });
        }
    }

    /// <summary>
    /// Get a specific processing process
    /// </summary>
    [HttpGet("{processId}")]
    public async Task<IActionResult> GetProcess(string processId, CancellationToken ct)
    {
        try
        {
            var process = await _processingService.GetProcessAsync(processId, ct);
            if (process is null)
                return NotFound(new { error = "Processing process not found" });

            return Ok(process);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving process {ProcessId}", processId);
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Failed to retrieve process" });
        }
    }

    /// <summary>
    /// Initiate a new processing task.
    /// The system will automatically select the server with the least load.
    /// </summary>
    [HttpPost("initiate")]
    public async Task<IActionResult> InitiateProcess(
        [FromBody] CreateProcessingProcessDto dto,
        CancellationToken ct)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Type.ToString()))
                return BadRequest(new { error = "Processing type is required" });

            if (string.IsNullOrWhiteSpace(dto.MongoDbServerUrl))
                return BadRequest(new { error = "MongoDB server URL is required" });

            var process = await _processingService.InitiateProcessAsync(dto, CurrentUserId, ct);
            return Accepted(new
            {
                processId = process.Id,
                process,
                progressEndpoint = $"/api/admin/processing/{process.Id}",
            });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid operation initiating process");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating processing");
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Failed to initiate processing" });
        }
    }

    /// <summary>
    /// Update the status of a processing task (callback from container)
    /// This endpoint can be called without authentication from the Docker container
    /// </summary>
    [HttpPost("callback")]
    [AllowAnonymous]
    public async Task<IActionResult> UpdateProcessStatus(
        [FromBody] ProcessingStatusUpdateDto dto,
        CancellationToken ct)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.ProcessId))
                return BadRequest(new { error = "ProcessId is required" });

            await _processingService.UpdateProcessStatusAsync(dto, ct);
            return Ok(new { message = "Status updated successfully" });
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Process not found for status callback");
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating process status");
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Failed to update process status" });
        }
    }
}
