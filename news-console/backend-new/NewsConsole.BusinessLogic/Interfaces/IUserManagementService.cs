using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IUserManagementService
{
    Task<IEnumerable<UserDto>> GetAllUsersAsync(CancellationToken ct = default);
    Task ChangeRoleAsync(int userId, string newRole, CancellationToken ct = default);
    Task SetBlockedAsync(int userId, bool isBlocked, CancellationToken ct = default);
}
