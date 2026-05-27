using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data.Entities;

namespace NewsConsole.BusinessLogic.Services;

public sealed class UserManagementService : IUserManagementService
{
    private readonly UserManager<AppUser> _userManager;

    public UserManagementService(UserManager<AppUser> userManager)
        => _userManager = userManager;

    public async Task<IEnumerable<UserDto>> GetAllUsersAsync(CancellationToken ct = default)
    {
        var users  = await _userManager.Users.ToListAsync(ct);
        var result = new List<UserDto>(users.Count);

        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            result.Add(new UserDto(
                user.Id,
                user.Name,
                user.Surname,
                user.Address,
                user.Email ?? "",
                user.PhoneNumber,
                roles.FirstOrDefault() ?? AppRoles.User,
                user.IsBlocked,
                user.CreatedAt));
        }

        return result;
    }

    public async Task ChangeRoleAsync(int userId, string newRole, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString())
            ?? throw new KeyNotFoundException($"User '{userId}' not found.");

        if (await IsAdminAsync(user))
            throw new InvalidOperationException("Cannot change the role of an administrator.");

        var current = await _userManager.GetRolesAsync(user);
        if (current.Count > 0)
            await _userManager.RemoveFromRolesAsync(user, current);

        await _userManager.AddToRoleAsync(user, newRole);
    }

    public async Task SetBlockedAsync(int userId, bool isBlocked, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString())
            ?? throw new KeyNotFoundException($"User '{userId}' not found.");

        if (await IsAdminAsync(user))
            throw new InvalidOperationException("Cannot block an administrator.");

        user.IsBlocked = isBlocked;
        await _userManager.UpdateAsync(user);
    }

    private async Task<bool> IsAdminAsync(AppUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        return roles.Contains(AppRoles.Admin);
    }
}
