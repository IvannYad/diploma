using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public sealed class ProfileController : ControllerBase
{
    private readonly IProfileService _profile;

    public ProfileController(IProfileService profile) => _profile = profile;

    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? throw new UnauthorizedAccessException("No user id in token."));

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        try
        {
            var result = await _profile.GetAsync(CurrentUserId, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    [HttpPatch]
    public async Task<IActionResult> Update(
        [FromBody] UpdateProfileDto dto,
        CancellationToken ct)
    {
        try
        {
            await _profile.UpdateAsync(CurrentUserId, dto, ct);
            var updated = await _profile.GetAsync(CurrentUserId, ct);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)       { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex)  { return BadRequest(new { error = ex.Message }); }
    }
}
