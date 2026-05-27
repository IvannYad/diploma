using MongoDB.Bson;
using MongoDB.Driver;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data;
using NewsConsole.Data.Repositories;

namespace NewsConsole.BusinessLogic.Services;

public sealed class ConnectionTestService : IConnectionTestService
{
    private static readonly HashSet<string> RequiredFields =
    [
        "id", "body_preview", "code", "date", "full_body", "retrieved_at", "time", "title"
    ];

    private static readonly HashSet<string> OtherCollections =
    [
        "clustered_articles", "extracted_news", "chart_configs"
    ];

    private readonly IMongoContext _mongoContext;
    private readonly string _databaseName;
    private readonly IProcessingProcessRepository _processingProcessRepository;

    public ConnectionTestService(
        IMongoContext mongoContext,
        string databaseName,
        IProcessingProcessRepository processingProcessRepository)
    {
        _mongoContext = mongoContext;
        _databaseName = databaseName;
        _processingProcessRepository = processingProcessRepository;
    }

    public async Task<ConnectionTestDto> TestAsync(string uri, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(uri))
            return new ConnectionTestDto(ConnectionStatus.ConnectionFailed, "No URI provided");

        MongoClient? client = null;
        try
        {
            var settings = MongoClientSettings.FromConnectionString(uri);
            settings.ServerSelectionTimeout = TimeSpan.FromSeconds(3);
            client = new MongoClient(settings);

            await client.GetDatabase("admin")
                        .RunCommandAsync<BsonDocument>(
                            new BsonDocument("ping", 1), cancellationToken: ct);

            var dbName = MongoDatabaseNameResolver.Resolve(uri, _databaseName);
            _mongoContext.Activate(uri, dbName);

            var db = client.GetDatabase(dbName);
            var collectionNames = (await db.ListCollectionNamesAsync(cancellationToken: ct))
                                  .ToList()
                                  .ToHashSet();

            var activeProcess = await _processingProcessRepository.GetActiveByMongoDbServerUrlAsync(uri, ct);

            if (!collectionNames.Contains("news_with_tables"))
                return new ConnectionTestDto(
                    ConnectionStatus.BadFormat,
                    "Collection news_with_tables not found",
                    ActiveProcessId: activeProcess?.Id);

            var sample = await db.GetCollection<BsonDocument>("news_with_tables")
                                 .Find(Builders<BsonDocument>.Filter.Empty)
                                 .Limit(1)
                                 .FirstOrDefaultAsync(ct);

            if (sample is null || !RequiredFields.All(f => sample.Contains(f)))
                return new ConnectionTestDto(
                    ConnectionStatus.BadFormat,
                    "news_with_tables is empty or has incorrect document format",
                    ActiveProcessId: activeProcess?.Id);

            if (collectionNames.Overlaps(OtherCollections))
                return new ConnectionTestDto(ConnectionStatus.Ready, ActiveProcessId: activeProcess?.Id);

            var articleCount = (int)await db.GetCollection<BsonDocument>("news_with_tables")
                                            .EstimatedDocumentCountAsync(cancellationToken: ct);
            return new ConnectionTestDto(ConnectionStatus.NeedsProcessing, Count: articleCount, ActiveProcessId: activeProcess?.Id);
        }
        catch (Exception ex)
        {
            return new ConnectionTestDto(ConnectionStatus.ConnectionFailed, ToUserFriendlyConnectionMessage(ex));
        }
        finally
        {
            client?.Dispose();
        }
    }

    private static string ToUserFriendlyConnectionMessage(Exception ex)
    {
        var text = ex.ToString();

        if (text.Contains("actively refused", StringComparison.OrdinalIgnoreCase)
            || text.Contains("10061", StringComparison.OrdinalIgnoreCase)
            || text.Contains("ECONNREFUSED", StringComparison.OrdinalIgnoreCase)
            || text.Contains("No connection could be made", StringComparison.OrdinalIgnoreCase))
        {
            return "MongoDB refused the connection. Check that the server is running and the host and port in the URL are correct.";
        }

        if (text.Contains("timed out", StringComparison.OrdinalIgnoreCase)
            || text.Contains("Timeout", StringComparison.OrdinalIgnoreCase)
            || text.Contains("ServerSelectionTimeout", StringComparison.OrdinalIgnoreCase))
        {
            return "The connection timed out. Verify the server address is reachable and not blocked by a firewall.";
        }

        if (text.Contains("Authentication failed", StringComparison.OrdinalIgnoreCase)
            || text.Contains("bad auth", StringComparison.OrdinalIgnoreCase)
            || text.Contains("not authorized", StringComparison.OrdinalIgnoreCase))
        {
            return "Authentication failed. Check the username and password in your connection URL.";
        }

        if (ex is FormatException
            || text.Contains("not a valid", StringComparison.OrdinalIgnoreCase)
            || text.Contains("Invalid connection string", StringComparison.OrdinalIgnoreCase))
        {
            return "The connection URL format is invalid. Use a standard mongodb:// or mongodb+srv:// URL.";
        }

        return "Could not connect to MongoDB. Verify the connection URL and that the server is running.";
    }
}
