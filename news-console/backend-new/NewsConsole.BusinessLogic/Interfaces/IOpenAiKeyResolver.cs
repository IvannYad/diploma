namespace NewsConsole.BusinessLogic.Interfaces;

/// <summary>
/// Resolves a decrypted OpenAI API key for a specific application user.
/// </summary>
public interface IOpenAiKeyResolver
{
    Task<string> GetDecryptedKeyAsync(int userId, CancellationToken ct = default);
}
