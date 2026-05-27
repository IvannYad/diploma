using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.Data;
using NewsConsole.Data.Repositories;
using System.Runtime.InteropServices;

namespace NewsConsole.BusinessLogic.Services;

public sealed class IntellectualProcessingSchedulingService : IIntellectualProcessingSchedulingService
{
    private readonly IProcessingProcessRepository _repository;
    private readonly IProcessingServerService _serverService;
    private readonly IOpenAiKeyResolver _openAiKeyResolver;
    private readonly IConfiguration _configuration;
    private readonly ILogger<IntellectualProcessingSchedulingService> _logger;

    public IntellectualProcessingSchedulingService(
        IProcessingProcessRepository repository,
        IProcessingServerService serverService,
        IOpenAiKeyResolver openAiKeyResolver,
        IConfiguration configuration,
        ILogger<IntellectualProcessingSchedulingService> logger)
    {
        _repository        = repository;
        _serverService     = serverService;
        _openAiKeyResolver = openAiKeyResolver;
        _configuration     = configuration;
        _logger            = logger;
    }

    public async Task<string> SelectServerWithLeastLoadAsync(CancellationToken ct = default)
    {
        var servers = await _serverService.GetAllAsync(ct);
        if (servers.Count == 0)
        {
            _logger.LogError("No processing servers configured");
            throw new InvalidOperationException("No processing servers configured.");
        }

        var activeEntities = await _repository.GetActiveAsync(ct);
        var processCountByServer = activeEntities
            .GroupBy(p => p.AssignedServer ?? "unknown")
            .ToDictionary(g => g.Key, g => g.Count());

        var selectedServer = servers
            .Select(s => new { Server = s, Load = processCountByServer.GetValueOrDefault(s.IpAddress, 0) })
            .OrderBy(x => x.Load)
            .ThenBy(x => x.Server.AddedAt)
            .First()
            .Server;

        _logger.LogInformation(
            "Selected server {IpAddress} for processing (load: {ActiveProcesses}/{MaxCapacity})",
            selectedServer.IpAddress,
            processCountByServer.GetValueOrDefault(selectedServer.IpAddress, 0),
            selectedServer.MaxCapacity);

        return selectedServer.IpAddress;
    }

    public async Task InitiateDockerContainerAsync(
        ProcessingProcessDto process,
        CreateProcessingProcessDto request,
        int initiatedByUserId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(process.MongoDbServerUrl))
            throw new InvalidOperationException("MongoDB server URL is missing for process");

        var openAiApiKey = await _openAiKeyResolver.GetDecryptedKeyAsync(initiatedByUserId, ct);
        if (string.IsNullOrWhiteSpace(openAiApiKey))
            throw new InvalidOperationException("OpenAI API key is not set in user profile.");

        var backendEndpoint = _configuration["Processing:CompletionWebhookEndpoint"]
            ?? _configuration["Processing:BackendCallbackEndpoint"]
            ?? throw new InvalidOperationException(
                "Processing:CompletionWebhookEndpoint or Processing:BackendCallbackEndpoint not configured");

        var pipelineImage = process.Type == ProcessingType.OlapSchemaRebuild
            ? _configuration["Processing:OlapRebuildDockerImage"] ?? "olap-schema-rebuild-pipeline:latest"
            : _configuration["Processing:PipelineDockerImage"] ?? "news-pipeline:latest";

        using var client = CreateDockerClient(process.AssignedServer, out var dockerHostDescription);
        var containerMongoUri          = ResolveMongoUriForContainer(process.MongoDbServerUrl, process.AssignedServer);
        var containerBackendEndpoint   = ResolveCallbackEndpointForContainer(backendEndpoint, process.AssignedServer);
        var progressEndpoint           = ResolveProgressEndpoint(containerBackendEndpoint);
        var databaseName               = MongoDatabaseNameResolver.Resolve(containerMongoUri, "diploma");
        var modelName                  = _configuration["Processing:ModelName"] ?? "gpt-5.4-mini";

        var env = new List<string>
        {
            $"MONGO_URI={containerMongoUri}",
            $"MONGO_DB={databaseName}",
            $"OPENAI_API_KEY={openAiApiKey}",
            $"MODEL_NAME={modelName}",
            $"BACKEND_CALLBACK_ENDPOINT={containerBackendEndpoint}",
            $"BACKEND_PROGRESS_ENDPOINT={progressEndpoint}",
            $"PROCESS_ID={process.Id}",
            $"PROCESS_TYPE={process.Type}",
        };

        if (request.ExtraEnvironmentVariables is not null)
        {
            foreach (var kv in request.ExtraEnvironmentVariables)
            {
                if (!string.IsNullOrWhiteSpace(kv.Key))
                    env.Add($"{kv.Key}={kv.Value}");
            }
        }

        _logger.LogInformation(
            "Starting Docker container for process {ProcessId} on {DockerHost} (database {DatabaseName})",
            process.Id, dockerHostDescription, databaseName);

        var container = await client.Containers.CreateContainerAsync(
            new CreateContainerParameters
            {
                Image      = pipelineImage,
                Name       = $"pipeline-{process.Id}",
                Env        = env,
                HostConfig = new HostConfig
                {
                    RestartPolicy = new RestartPolicy { Name = RestartPolicyKind.No },
                },
            }, ct);

        _logger.LogInformation("Created Docker container {ContainerId} for process {ProcessId}",
            container.ID, process.Id);

        await client.Containers.StartContainerAsync(container.ID, new ContainerStartParameters(), ct);

        _logger.LogInformation("Started Docker container {ContainerId} for process {ProcessId}",
            container.ID, process.Id);
    }

    public async Task TryRemoveContainerAsync(string processId, string? assignedServer, CancellationToken ct = default)
    {
        try
        {
            using var client = CreateDockerClient(assignedServer, out _);
            await client.Containers.RemoveContainerAsync(
                $"pipeline-{processId}",
                new ContainerRemoveParameters { Force = true, RemoveVolumes = true },
                ct);

            _logger.LogInformation("Removed Docker container for process {ProcessId}", processId);
        }
        catch (DockerApiException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogDebug("Container for process {ProcessId} not found during cleanup (already removed)", processId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to remove Docker container for process {ProcessId}", processId);
        }
    }

    private DockerClient CreateDockerClient(string? assignedServer, out string dockerHostDescription)
    {
        if (string.IsNullOrWhiteSpace(assignedServer))
            throw new InvalidOperationException("Assigned processing server is missing");

        var normalizedServer = assignedServer.Trim();
        if (IsLocalDockerHost(normalizedServer))
        {
            var localDockerUri = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
                ? "npipe://./pipe/docker_engine"
                : "unix:///var/run/docker.sock";

            dockerHostDescription = localDockerUri;
            return new DockerClientConfiguration(new Uri(localDockerUri)).CreateClient();
        }

        var dockerApiPortRaw = _configuration["Processing:DockerApiPort"];
        var dockerApiPort    = int.TryParse(dockerApiPortRaw, out var parsedPort) ? parsedPort : 2375;
        var dockerHostUri    = $"tcp://{normalizedServer}:{dockerApiPort}";

        dockerHostDescription = dockerHostUri;
        return new DockerClientConfiguration(new Uri(dockerHostUri)).CreateClient();
    }

    private static bool IsLocalDockerHost(string server)
        => server.Equals("localhost",            StringComparison.OrdinalIgnoreCase)
        || server.Equals("127.0.0.1",            StringComparison.OrdinalIgnoreCase)
        || server.Equals("::1",                  StringComparison.OrdinalIgnoreCase)
        || server.Equals(".",                    StringComparison.OrdinalIgnoreCase)
        || server.Equals(Environment.MachineName, StringComparison.OrdinalIgnoreCase);

    private static string ResolveMongoUriForContainer(string mongoUri, string? assignedServer)
    {
        if (string.IsNullOrWhiteSpace(mongoUri) || !IsLocalDockerHost(assignedServer ?? string.Empty))
            return mongoUri;

        return mongoUri
            .Replace("://localhost",  "://host.docker.internal", StringComparison.OrdinalIgnoreCase)
            .Replace("://127.0.0.1",  "://host.docker.internal", StringComparison.OrdinalIgnoreCase)
            .Replace("@localhost",    "@host.docker.internal",   StringComparison.OrdinalIgnoreCase)
            .Replace("@127.0.0.1",   "@host.docker.internal",   StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolveCallbackEndpointForContainer(string callbackEndpoint, string? assignedServer)
    {
        if (string.IsNullOrWhiteSpace(callbackEndpoint) || !IsLocalDockerHost(assignedServer ?? string.Empty))
            return callbackEndpoint;

        return callbackEndpoint
            .Replace("://localhost", "://host.docker.internal", StringComparison.OrdinalIgnoreCase)
            .Replace("://127.0.0.1", "://host.docker.internal", StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolveProgressEndpoint(string completionEndpoint)
    {
        const string completionSuffix = "/completed";
        return completionEndpoint.EndsWith(completionSuffix, StringComparison.OrdinalIgnoreCase)
            ? completionEndpoint[..^completionSuffix.Length] + "/progress"
            : completionEndpoint;
    }
}
