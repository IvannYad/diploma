using System.Security.Cryptography;
using System.Text;

namespace NewsConsole.BusinessLogic.Services;

/// <summary>
/// Stateless AES-256-CBC encryption and decryption utility.
/// Supports both a shared passphrase-derived key (for general data)
/// and per-user keys derived from the user's identity via PBKDF2 (for sensitive user data such as API keys).
/// <para>
/// AES-256-CBC encryption helper. The encryption key is derived from any
/// passphrase via SHA-256 so the config value can be any string.
/// The random IV is prepended to the ciphertext before base64 encoding.
/// </para>
/// </summary>
public sealed class EncryptionService
{
    private readonly string _passphrase;
    private readonly byte[] _sharedKey;

    public EncryptionService(string passphrase)
    {
        _passphrase = passphrase;
        _sharedKey = SHA256.HashData(Encoding.UTF8.GetBytes(passphrase));
    }

    public string Encrypt(string plainText) => EncryptWithKey(plainText, _sharedKey);
    public string Decrypt(string encryptedBase64) => DecryptWithKey(encryptedBase64, _sharedKey);

    public string Encrypt(string plainText, string userName, string userId)
        => EncryptWithKey(plainText, DeriveUserKey(userName, userId));

    public string Decrypt(string encryptedBase64, string userName, string userId)
        => DecryptWithKey(encryptedBase64, DeriveUserKey(userName, userId));

    private static string EncryptWithKey(string plainText, byte[] key)
    {
        using var aes = Aes.Create();
        aes.Key = key;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        var plainBytes  = Encoding.UTF8.GetBytes(plainText);
        var cipherBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

        var combined = new byte[aes.IV.Length + cipherBytes.Length];
        Buffer.BlockCopy(aes.IV, 0, combined, 0, aes.IV.Length);
        Buffer.BlockCopy(cipherBytes, 0, combined, aes.IV.Length, cipherBytes.Length);

        return Convert.ToBase64String(combined);
    }

    private static string DecryptWithKey(string encryptedBase64, byte[] key)
    {
        var combined  = Convert.FromBase64String(encryptedBase64);
        using var aes = Aes.Create();
        aes.Key = key;

        var iv          = new byte[aes.BlockSize / 8];
        var cipherBytes = new byte[combined.Length - iv.Length];
        Buffer.BlockCopy(combined, 0, iv, 0, iv.Length);
        Buffer.BlockCopy(combined, iv.Length, cipherBytes, 0, cipherBytes.Length);
        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor();
        var plainBytes = decryptor.TransformFinalBlock(cipherBytes, 0, cipherBytes.Length);
        return Encoding.UTF8.GetString(plainBytes);
    }

    private byte[] DeriveUserKey(string userName, string userId)
    {
        var salt = SHA256.HashData(Encoding.UTF8.GetBytes(_passphrase));
        return Rfc2898DeriveBytes.Pbkdf2(
            password:      Encoding.UTF8.GetBytes($"{userName}:{userId}"),
            salt:          salt,
            iterations:    100_000,
            hashAlgorithm: HashAlgorithmName.SHA256,
            outputLength:  32);
    }
}
