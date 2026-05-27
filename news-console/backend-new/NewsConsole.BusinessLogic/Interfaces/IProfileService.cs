using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IProfileService
{
    Task<ProfileDto> GetAsync(int userId, CancellationToken ct = default);
    Task UpdateAsync(int userId, UpdateProfileDto dto, CancellationToken ct = default);
}
