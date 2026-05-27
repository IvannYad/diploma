namespace NewsConsole.Data;

internal static class MongoConnectionKey
{
    public static string Create(string uri, string databaseName) =>
        $"{uri.Trim()}|{databaseName.Trim()}";
}
