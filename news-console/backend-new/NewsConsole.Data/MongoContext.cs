using Microsoft.AspNetCore.Http;
using MongoDB.Driver;

namespace NewsConsole.Data;

/// <summary>
/// Request-scoped view of the active MongoDB connection for the current HTTP request.
/// Resolves the database from <see cref="MongoUriResolver"/> against the shared
/// <see cref="IMongoConnectionRegistry"/>.
/// </summary>
public interface IMongoContext
{
    IMongoDatabase? Database { get; }
    void Activate(string uri, string databaseName);
    void InvalidateCache();
}

public sealed class RequestMongoContext : IMongoContext
{
    private readonly IMongoConnectionRegistry _registry;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly string _databaseName;

    public RequestMongoContext(
        IMongoConnectionRegistry registry,
        IHttpContextAccessor httpContextAccessor,
        string databaseName)
    {
        _registry = registry;
        _httpContextAccessor = httpContextAccessor;
        _databaseName = databaseName;
    }

    public IMongoDatabase? Database
    {
        get
        {
            var uri = MongoUriResolver.Resolve(_httpContextAccessor);
            if (string.IsNullOrWhiteSpace(uri))
                return null;

            var dbName = MongoDatabaseNameResolver.Resolve(uri, _databaseName);
            return _registry.GetDatabase(uri, dbName);
        }
    }

    public void Activate(string uri, string databaseName)
    {
        var dbName = MongoDatabaseNameResolver.Resolve(uri, databaseName);
        _registry.Register(uri, dbName);
    }

    public void InvalidateCache()
    {
        var uri = MongoUriResolver.Resolve(_httpContextAccessor);
        if (string.IsNullOrWhiteSpace(uri))
            return;

        var dbName = MongoDatabaseNameResolver.Resolve(uri, _databaseName);
        _registry.InvalidateCache(uri, dbName);
    }
}
