using MongoDB.Driver;

namespace NewsConsole.Data;

public interface IMongoConnectionRegistry
{
    IMongoDatabase? GetDatabase(string uri, string databaseName);
    void Register(string uri, string databaseName);
    void InvalidateCache(string uri, string databaseName);
    event Action<string>? CacheInvalidated;
}
