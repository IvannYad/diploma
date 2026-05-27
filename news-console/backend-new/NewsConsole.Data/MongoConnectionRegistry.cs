using System.Collections.Concurrent;
using MongoDB.Driver;

namespace NewsConsole.Data;

public sealed class MongoConnectionRegistry : IMongoConnectionRegistry, IDisposable
{
    private readonly ConcurrentDictionary<string, ConnectionEntry> _connections = new();

    public event Action<string>? CacheInvalidated;

    public IMongoDatabase? GetDatabase(string uri, string databaseName)
    {
        if (string.IsNullOrWhiteSpace(uri))
            return null;

        var key = MongoConnectionKey.Create(uri, databaseName);
        return _connections.TryGetValue(key, out var entry) ? entry.Database : null;
    }

    public void Register(string uri, string databaseName)
    {
        if (string.IsNullOrWhiteSpace(uri))
            throw new ArgumentException("URI is required.", nameof(uri));
        if (string.IsNullOrWhiteSpace(databaseName))
            throw new ArgumentException("Database name is required.", nameof(databaseName));

        var key = MongoConnectionKey.Create(uri, databaseName);
        _connections.AddOrUpdate(
            key,
            _ => CreateEntry(uri, databaseName),
            (_, existing) =>
            {
                existing.Dispose();
                return CreateEntry(uri, databaseName);
            });
    }

    public void InvalidateCache(string uri, string databaseName)
    {
        if (string.IsNullOrWhiteSpace(uri))
            return;

        CacheInvalidated?.Invoke(MongoConnectionKey.Create(uri, databaseName));
    }

    public void Dispose()
    {
        foreach (var entry in _connections.Values)
            entry.Dispose();
        _connections.Clear();
    }

    private static ConnectionEntry CreateEntry(string uri, string databaseName)
    {
        var client = new MongoClient(MongoClientSettings.FromConnectionString(uri));
        return new ConnectionEntry(client, client.GetDatabase(databaseName));
    }

    private sealed class ConnectionEntry(MongoClient client, IMongoDatabase database) : IDisposable
    {
        public IMongoDatabase Database { get; } = database;

        public void Dispose() => client.Dispose();
    }
}
