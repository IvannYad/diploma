namespace NewsConsole.Data.Settings;

// Only DatabaseName is configured here; the connection string is always
// supplied at runtime by the user through the landing page UI.
public sealed class MongoSettings
{
    public string DatabaseName { get; set; } = "diploma";
}
