using System.Runtime.CompilerServices;
using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Driver;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data;

namespace NewsConsole.BusinessLogic.Services;

public sealed class ImportService(IMongoContext mongoContext) : IImportService
{
    private static readonly HashSet<string> RequiredFields =
    [
        "id", "body_preview", "code", "date", "full_body", "retrieved_at", "time", "title"
    ];

    private IMongoDatabase _db =>
        mongoContext.Database
        ?? throw new InvalidOperationException(
            "MongoDB is not connected. Test the connection first.");

    public async IAsyncEnumerable<ImportProgressDto> ImportNewsAsync(
        ImportRequestDto request,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var docs = request.Documents;
        int total = docs.Count;
        int batchSize = Math.Max(1, request.BatchSize);

        if (total == 0)
        {
            yield return new ImportProgressDto(0, 0, true, "No documents supplied.");
            yield break;
        }

        var bsonDocs = new List<BsonDocument>(total);
        for (int i = 0; i < total; i++)
        {
            var element = docs[i];
            if (element.ValueKind != JsonValueKind.Object)
            {
                yield return new ImportProgressDto(0, total, true,
                    $"Document at index {i} is not an object.");
                yield break;
            }

            var missing = RequiredFields
                .Where(f => !element.TryGetProperty(f, out _))
                .ToList();

            if (missing.Count > 0)
            {
                yield return new ImportProgressDto(0, total, true,
                    $"Document at index {i} is missing required field(s): {string.Join(", ", missing)}.");
                yield break;
            }

            var bson = BsonDocument.Parse(element.GetRawText());
            bson.Remove("_id");
            bsonDocs.Add(bson);
        }

        var collection = _db.GetCollection<BsonDocument>("news_with_tables");
        int inserted = 0;

        for (int start = 0; start < total; start += batchSize)
        {
            ct.ThrowIfCancellationRequested();

            var batch = bsonDocs.GetRange(start, Math.Min(batchSize, total - start));
            await collection.InsertManyAsync(batch, cancellationToken: ct);
            inserted += batch.Count;

            yield return new ImportProgressDto(inserted, total, inserted == total);
        }

        mongoContext.InvalidateCache();
    }
}
