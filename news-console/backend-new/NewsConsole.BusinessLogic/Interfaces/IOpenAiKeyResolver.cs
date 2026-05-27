namespace NewsConsole.BusinessLogic.Interfaces;

public interface IOpenAiKeyResolver
{
    Task<string> GetDecryptedKeyAsync(int userId, CancellationToken ct = default);
}
