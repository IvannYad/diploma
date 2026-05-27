using MongoDB.Driver;

namespace NewsConsole.Data;

/// <summary>
/// Extracts the database segment from a MongoDB connection string, if present.
/// </summary>
public static class MongoDatabaseNameResolver
{
    public static string? FromUri(string? uri)
    {
        if (string.IsNullOrWhiteSpace(uri))
            return null;

        try
        {
            var name = new MongoUrl(uri.Trim()).DatabaseName;
            return string.IsNullOrWhiteSpace(name) ? null : name;
        }
        catch
        {
            return null;
        }
    }

    public static string Resolve(string? uri, string defaultDatabaseName) =>
        FromUri(uri) ?? defaultDatabaseName;
}
