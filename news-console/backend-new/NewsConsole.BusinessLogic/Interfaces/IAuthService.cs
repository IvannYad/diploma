using NewsConsole.BusinessLogic.DTOs;

namespace NewsConsole.BusinessLogic.Interfaces;

public interface IAuthService
{
    Task<AuthResponseDto> RegisterAsync(RegisterRequestDto dto, CancellationToken ct = default);
    Task<AuthResponseDto> LoginAsync(PasswordLoginRequestDto dto, CancellationToken ct = default);
}
