using System.Collections.Concurrent;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using MongoDB.Bson;
using MongoDB.Driver;
using NewsConsole.Data.Entities;

namespace NewsConsole.Data.Repositories;

/// <summary>
/// Loads articles per Mongo connection and keeps an in-memory cache keyed by connection.
/// </summary>
public sealed class NewsRepository : INewsRepository
{
    private readonly IMongoConnectionRegistry _registry;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly string _databaseName;
    private readonly SemaphoreSlim _gate = new(1, 1);

    private readonly ConcurrentDictionary<string, CacheEntry> _caches = new();

    public NewsRepository(
        IMongoConnectionRegistry registry,
        IHttpContextAccessor httpContextAccessor,
        IConfiguration configuration)
    {
        _registry = registry;
        _httpContextAccessor = httpContextAccessor;
        _databaseName = configuration["Mongo:DatabaseName"] ?? "diploma";
        _registry.CacheInvalidated += key => _caches.TryRemove(key, out _);
    }

    private (string Key, IMongoDatabase Db) RequireConnection()
    {
        var uri = MongoUriResolver.Resolve(_httpContextAccessor)
            ?? throw new InvalidOperationException(
                "MongoDB connection URI is missing. Test the connection from the landing page first.");

        var dbName = MongoDatabaseNameResolver.Resolve(uri, _databaseName);
        var db = _registry.GetDatabase(uri, dbName)
            ?? throw new InvalidOperationException(
                "MongoDB is not connected for this URI. Test the connection from the landing page first.");

        return (MongoConnectionKey.Create(uri, dbName), db);
    }

    public async Task<IReadOnlyList<ArticleDocument>> GetAllArticlesAsync(CancellationToken ct = default)
    {
        var (key, db) = RequireConnection();
        if (_caches.TryGetValue(key, out var cache) && cache.Articles is not null)
            return cache.Articles;

        await _gate.WaitAsync(ct);
        try
        {
            if (_caches.TryGetValue(key, out cache) && cache.Articles is not null)
                return cache.Articles;

            var cursor = await db.GetCollection<BsonDocument>("news_with_tables")
                                  .FindAsync(Builders<BsonDocument>.Filter.Empty,
                                      new FindOptions<BsonDocument>
                                      {
                                          Projection = Builders<BsonDocument>.Projection.Exclude("_id")
                                      }, ct);

            var articles = new List<ArticleDocument>();
            await cursor.ForEachAsync(doc =>
            {
                articles.Add(new ArticleDocument(
                    Id:          BsonStr(doc.GetValue("id",           BsonNull.Value)) ?? string.Empty,
                    Title:       BsonStr(doc.GetValue("title",        BsonNull.Value)),
                    BodyPreview: BsonStr(doc.GetValue("body_preview", BsonNull.Value)),
                    FullBody:    BsonStr(doc.GetValue("full_body",    BsonNull.Value)),
                    Code:        BsonStr(doc.GetValue("code",         BsonNull.Value)),
                    Date:        BsonStr(doc.GetValue("date",         BsonNull.Value)),
                    Time:        BsonStr(doc.GetValue("time",         BsonNull.Value)),
                    RetrievedAt: BsonStr(doc.GetValue("retrieved_at", BsonNull.Value))));
            }, ct);

            var entry = _caches.GetOrAdd(key, _ => new CacheEntry());
            entry.Articles = articles;
            return entry.Articles;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<IReadOnlyList<ClusterDocument>> GetClusterDocumentsAsync(CancellationToken ct = default)
    {
        var (key, db) = RequireConnection();
        if (_caches.TryGetValue(key, out var cache) && cache.Clusters is not null)
            return cache.Clusters;

        await _gate.WaitAsync(ct);
        try
        {
            if (_caches.TryGetValue(key, out cache) && cache.Clusters is not null)
                return cache.Clusters;

            var projection = Builders<BsonDocument>.Projection
                .Exclude("_id")
                .Include("id")
                .Include("cluster_label")
                .Include("sc_id")
                .Include("subcluster_id")
                .Include("subcluster");

            var cursor = await db.GetCollection<BsonDocument>("clustered_articles")
                                  .FindAsync(Builders<BsonDocument>.Filter.Empty,
                                      new FindOptions<BsonDocument> { Projection = projection }, ct);

            var docs = new List<ClusterDocument>();
            await cursor.ForEachAsync(doc =>
            {
                var id = doc.GetValue("id", BsonNull.Value).ToString() ?? string.Empty;
                if (string.IsNullOrEmpty(id)) return;

                var scId = FirstNonEmpty(doc, "sc_id", "subcluster_id", "subcluster");
                docs.Add(new ClusterDocument(
                    Id:           id,
                    ClusterLabel: BsonStr(doc.GetValue("cluster_label", BsonNull.Value)) ?? string.Empty,
                    ScId:         string.IsNullOrEmpty(scId) ? null : scId));
            }, ct);

            var entry = _caches.GetOrAdd(key, _ => new CacheEntry());
            entry.Clusters = docs;
            return entry.Clusters;
        }
        finally
        {
            _gate.Release();
        }
    }

    private static string FirstNonEmpty(BsonDocument doc, params string[] fields)
    {
        foreach (var f in fields)
        {
            var v = doc.GetValue(f, BsonNull.Value);
            if (!v.IsBsonNull && v.ToString() is { Length: > 0 } s)
                return s;
        }
        return string.Empty;
    }

    private static string? BsonStr(BsonValue v) =>
        v.IsBsonNull ? null : v.ToString();

    private sealed class CacheEntry
    {
        public IReadOnlyList<ArticleDocument>? Articles;
        public IReadOnlyList<ClusterDocument>? Clusters;
    }
}

public interface INewsRepository
{
    Task<IReadOnlyList<ArticleDocument>> GetAllArticlesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<ClusterDocument>> GetClusterDocumentsAsync(CancellationToken ct = default);
}
