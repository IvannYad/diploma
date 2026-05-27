using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.BusinessLogic;

namespace NewsConsole.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = AppRoles.Admin)]
public sealed class UsersController : ControllerBase
{
    private readonly IUserManagementService _userManagement;

    public UsersController(IUserManagementService userManagement)
        => _userManagement = userManagement;

    /// <summary>Returns all registered users with their role and blocked status.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var users = await _userManagement.GetAllUsersAsync(ct);
        return Ok(users);
    }

    /// <summary>Assigns a new role (<c>User</c> or <c>Admin</c>) to the specified user.</summary>
    [HttpPatch("{id:int}/role")]
    public async Task<IActionResult> ChangeRole(
        int id,
        [FromBody] ChangeRoleDto dto,
        CancellationToken ct)
    {
        if (dto.Role is not (AppRoles.User or AppRoles.Admin))
            return BadRequest(new { error = $"Role must be '{AppRoles.User}' or '{AppRoles.Admin}'." });

        try
        {
            await _userManagement.ChangeRoleAsync(id, dto.Role, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message });
        }
    }

    /// <summary>Sets or clears the blocked flag for the specified user.</summary>
    [HttpPatch("{id:int}/blocked")]
    public async Task<IActionResult> SetBlocked(
        int id,
        [FromBody] SetBlockedDto dto,
        CancellationToken ct)
    {
        try
        {
            await _userManagement.SetBlockedAsync(id, dto.IsBlocked, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message });
        }
    }
}
