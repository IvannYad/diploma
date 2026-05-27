namespace NewsConsole.Data.Entities;

public sealed class ProcessingServer
{
    public int    Id          { get; set; }
    public string IpAddress   { get; set; } = "";
    public int    MaxCapacity { get; set; }
    public DateTime AddedAt   { get; set; } = DateTime.UtcNow;
}
