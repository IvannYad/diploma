using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.BusinessLogic;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api/admin/servers")]
[Authorize(Roles = AppRoles.Admin)]
public sealed class ProcessingServersController : ControllerBase
{
    private readonly IProcessingServerService _servers;

    public ProcessingServersController(IProcessingServerService servers) => _servers = servers;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await _servers.GetAllAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Add(
        [FromBody] CreateProcessingServerDto dto,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.IpAddress))
            return BadRequest(new { error = "IP address is required." });

        try
        {
            var result = await _servers.AddAsync(dto, ct);
            return CreatedAtAction(nameof(GetAll), result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdateProcessingServerDto dto,
        CancellationToken ct)
    {
        try
        {
            var result = await _servers.UpdateAsync(id, dto, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)      { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        try
        {
            await _servers.DeleteAsync(id, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
}
