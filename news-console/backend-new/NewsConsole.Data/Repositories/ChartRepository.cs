using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using MongoDB.Bson;
using MongoDB.Driver;
using NewsConsole.Data.Entities;

namespace NewsConsole.Data.Repositories;

public sealed class ChartRepository : IChartRepository
{
    private readonly IMongoConnectionRegistry _registry;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly string _databaseName;

    public ChartRepository(
        IMongoConnectionRegistry registry,
        IHttpContextAccessor httpContextAccessor,
        IConfiguration configuration)
    {
        _registry = registry;
        _httpContextAccessor = httpContextAccessor;
        _databaseName = configuration["Mongo:DatabaseName"] ?? "diploma";
    }

    private IMongoDatabase Db
    {
        get
        {
            var uri = MongoUriResolver.Resolve(_httpContextAccessor)
                ?? throw new InvalidOperationException(
                    "MongoDB connection URI is missing. Test the connection from the landing page first.");

            var dbName = MongoDatabaseNameResolver.Resolve(uri, _databaseName);
            return _registry.GetDatabase(uri, dbName)
                ?? throw new InvalidOperationException(
                    "MongoDB is not connected for this URI. Test the connection from the landing page first.");
        }
    }

    public async Task<string?> FindSubclusterIdAsync(
        string clusterLabel, string articleId, CancellationToken ct = default)
    {
        var idValues = int.TryParse(articleId, out var intId)
            ? new BsonArray { articleId, intId }
            : new BsonArray { articleId };

        var filter = Builders<BsonDocument>.Filter.And(
            Builders<BsonDocument>.Filter.Eq("cluster_label", clusterLabel),
            Builders<BsonDocument>.Filter.ElemMatch<BsonDocument>("articles",
                new BsonDocumentFilterDefinition<BsonDocument>(
                    new BsonDocument("article_id", new BsonDocument("$in", idValues)))));

        var projection = Builders<BsonDocument>.Projection.Include("sc_id").Exclude("_id");

        var doc = await Db.GetCollection<BsonDocument>("extracted_news")
                           .Find(filter)
                           .Project(projection)
                           .FirstOrDefaultAsync(ct);

        if (doc is null) return null;
        var v = doc.GetValue("sc_id", BsonNull.Value);
        return v.IsBsonNull ? null : v.ToString();
    }

    public async Task<IReadOnlyList<ExtractedNewsDocument>> GetExtractedNewsDocumentsAsync(CancellationToken ct = default)
    {
        var docs = await Db.GetCollection<BsonDocument>("extracted_news")
                            .Find(Builders<BsonDocument>.Filter.Empty)
                            .Project(Builders<BsonDocument>.Projection
                                .Include("cluster_label")
                                .Include("sc_id")
                                .Exclude("_id"))
                            .ToListAsync(ct);

        return docs.Select(doc => new ExtractedNewsDocument(
            ClusterLabel: doc.GetValue("cluster_label", BsonNull.Value) is var cl && cl.IsBsonNull ? null : cl.ToString(),
            ScId:         doc.GetValue("sc_id",         BsonNull.Value) is var sc && sc.IsBsonNull ? null : sc.ToString()))
            .ToList();
    }

    public async Task<IReadOnlyDictionary<string, object?>?> GetChartConfigAsync(
        string clusterLabel, string scId, CancellationToken ct = default)
    {
        var filter = Builders<BsonDocument>.Filter.And(
            Builders<BsonDocument>.Filter.Eq("cluster_label", clusterLabel),
            Builders<BsonDocument>.Filter.Eq("sc_id", scId));

        var doc = await Db.GetCollection<BsonDocument>("chart_configs")
                           .Find(filter)
                           .Project(Builders<BsonDocument>.Projection.Exclude("_id"))
                           .FirstOrDefaultAsync(ct);

        return doc is null ? null : BsonToDict(doc);
    }

    public async Task<IReadOnlyDictionary<string, object?>?> GetChartDataAsync(
        string clusterLabel, string scId, CancellationToken ct = default)
    {
        var filter = Builders<BsonDocument>.Filter.And(
            Builders<BsonDocument>.Filter.Eq("cluster_label", clusterLabel),
            Builders<BsonDocument>.Filter.Eq("sc_id", scId));

        var doc = await Db.GetCollection<BsonDocument>("extracted_news")
                           .Find(filter)
                           .Project(Builders<BsonDocument>.Projection.Exclude("_id"))
                           .FirstOrDefaultAsync(ct);

        return doc is null ? null : BsonToDict(doc);
    }

    private static IReadOnlyDictionary<string, object?> BsonToDict(BsonDocument doc)
    {
        var dict = new Dictionary<string, object?>(doc.ElementCount);
        foreach (var el in doc)
            dict[el.Name] = BsonToClr(el.Value);
        return dict;
    }

    private static object? BsonToClr(BsonValue v) => v.BsonType switch
    {
        BsonType.Document  => BsonToDict(v.AsBsonDocument),
        BsonType.Array     => v.AsBsonArray.Select(BsonToClr).ToList(),
        BsonType.Int32     => v.AsInt32,
        BsonType.Int64     => v.AsInt64,
        BsonType.Double    => v.AsDouble,
        BsonType.Boolean   => v.AsBoolean,
        BsonType.DateTime  => v.ToUniversalTime(),
        BsonType.Null      => null,
        _                  => v.ToString(),
    };
}

public interface IChartRepository
{
    Task<string?> FindSubclusterIdAsync(string clusterLabel, string articleId, CancellationToken ct = default);
    Task<IReadOnlyList<ExtractedNewsDocument>> GetExtractedNewsDocumentsAsync(CancellationToken ct = default);
    Task<IReadOnlyDictionary<string, object?>?> GetChartConfigAsync(string clusterLabel, string scId, CancellationToken ct = default);
    Task<IReadOnlyDictionary<string, object?>?> GetChartDataAsync(string clusterLabel, string scId, CancellationToken ct = default);
}
