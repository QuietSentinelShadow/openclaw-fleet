using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Extensions.Logging;
using OpenClawFleet.Core.Entities;
using OpenClawFleet.Core.Interfaces;

namespace OpenClawFleet.Infrastructure.Docker;

/// <summary>
/// Service for managing OpenClaw Docker containers.
/// </summary>
public class DockerService : IDockerService
{
    private readonly IDockerClient _dockerClient;
    private readonly ILogger<DockerService> _logger;
    private const string OpenClawImage = "ghcr.io/openclaw/openclaw:latest";
    private const string LabelPrefix = "openclaw-fleet";

    public DockerService(ILogger<DockerService> logger)
    {
        _logger = logger;
        _dockerClient = new DockerClientConfiguration().CreateClient();
    }

    /// <summary>
    /// Check if Docker is available and running.
    /// </summary>
    public async Task<bool> IsDockerAvailableAsync()
    {
        try
        {
            var info = await _dockerClient.System.GetSystemInfoAsync();
            return info != null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Docker is not available");
            return false;
        }
    }

    /// <summary>
    /// Pull the OpenClaw Docker image.
    /// </summary>
    public async Task PullImageAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Pulling OpenClaw image: {Image}", OpenClawImage);

        await _dockerClient.Images.CreateImageAsync(
            new ImagesCreateParameters
            {
                FromImage = OpenClawImage
            },
            new AuthConfig(),
            new Progress<JSONMessage>(message =>
            {
                if (message.Status != null)
                {
                    _logger.LogDebug("Image pull status: {Status}", message.Status);
                }
                if (message.Error != null)
                {
                    _logger.LogError("Image pull error: {Error}", message.Error);
                }
            }),
            cancellationToken);

        _logger.LogInformation("OpenClaw image pulled successfully");
    }

    /// <summary>
    /// Create a new OpenClaw container.
    /// </summary>
    public async Task<string> CreateContainerAsync(
        OpenClawInstance instance,
        CancellationToken cancellationToken = default)
    {
        var containerName = $"openclaw-{instance.Name.ToLowerInvariant().Replace(" ", "-")}";
        
        _logger.LogInformation("Creating container {ContainerName} for instance {InstanceId}", 
            containerName, instance.Id);

        var environment = new List<string>
        {
            $"OPENCLAW_GATEWAY_PORT={instance.Port}",
            $"OPENCLAW_OLLAMA_BASE_URL=http://host.docker.internal:11434",
            $"OPENCLAW_MODEL={instance.OllamaModel}",
            "OPENCLAW_BIND=lan"
        };

        var binds = new List<string>
        {
            $"{instance.WorkspacePath}:/home/node/.openclaw/workspace"
        };

        var labels = new Dictionary<string, string>
        {
            { $"{LabelPrefix}.instance-id", instance.Id.ToString() },
            { $"{LabelPrefix}.agent-role", instance.AgentRole },
            { $"{LabelPrefix}.managed", "true" }
        };

        var createParameters = new CreateContainerParameters
        {
            Name = containerName,
            Image = OpenClawImage,
            Env = environment,
            HostConfig = new HostConfig
            {
                PortBindings = new Dictionary<string, IList<PortBinding>>
                {
                    {
                        "18789/tcp",
                        new List<PortBinding>
                        {
                            new PortBinding
                            {
                                HostPort = instance.Port.ToString()
                            }
                        }
                    }
                },
                Binds = binds,
                ExtraHosts = new List<string> { "host.docker.internal:host-gateway" }
            },
            ExposedPorts = new Dictionary<string, EmptyStruct>
            {
                { "18789/tcp", new EmptyStruct() }
            },
            Labels = labels,
            WorkingDir = "/home/node/.openclaw/workspace"
        };

        var response = await _dockerClient.Containers.CreateContainerAsync(
            createParameters,
            cancellationToken);

        _logger.LogInformation("Container {ContainerId} created for instance {InstanceId}", 
            response.ID[..12], instance.Id);

        return response.ID;
    }

    /// <summary>
    /// Start a container.
    /// </summary>
    public async Task StartContainerAsync(string containerId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Starting container {ContainerId}", containerId[..12]);

        var success = await _dockerClient.Containers.StartContainerAsync(
            containerId,
            new ContainerStartParameters(),
            cancellationToken);

        if (!success)
        {
            throw new InvalidOperationException($"Failed to start container {containerId}");
        }

        _logger.LogInformation("Container {ContainerId} started", containerId[..12]);
    }

    /// <summary>
    /// Stop a container.
    /// </summary>
    public async Task StopContainerAsync(string containerId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Stopping container {ContainerId}", containerId[..12]);

        await _dockerClient.Containers.StopContainerAsync(
            containerId,
            new ContainerStopParameters
            {
                WaitBeforeKillSeconds = 30
            },
            cancellationToken);

        _logger.LogInformation("Container {ContainerId} stopped", containerId[..12]);
    }

    /// <summary>
    /// Remove a container.
    /// </summary>
    public async Task RemoveContainerAsync(string containerId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Removing container {ContainerId}", containerId[..12]);

        await _dockerClient.Containers.RemoveContainerAsync(
            containerId,
            new ContainerRemoveParameters
            {
                Force = true,
                RemoveVolumes = false
            },
            cancellationToken);

        _logger.LogInformation("Container {ContainerId} removed", containerId[..12]);
    }

    /// <summary>
    /// Get container status.
    /// </summary>
    public async Task<ContainerStatus> GetContainerStatusAsync(string containerId, CancellationToken cancellationToken = default)
    {
        try
        {
            var inspect = await _dockerClient.Containers.InspectContainerAsync(containerId, cancellationToken);
            
            return new ContainerStatus
            {
                Id = inspect.ID,
                Name = inspect.Name,
                IsRunning = inspect.State.Running,
                Status = inspect.State.Status,
                StartedAt = inspect.State.StartedAt,
                FinishedAt = inspect.State.FinishedAt,
                IpAddress = inspect.NetworkSettings.IPAddress
            };
        }
        catch (DockerContainerNotFoundException)
        {
            return new ContainerStatus
            {
                Id = containerId,
                Status = "not_found",
                IsRunning = false
            };
        }
    }

    /// <summary>
    /// Get container logs.
    /// </summary>
    public async Task<string> GetContainerLogsAsync(
        string containerId, 
        int tail = 100,
        CancellationToken cancellationToken = default)
    {
        var logs = await _dockerClient.Containers.GetContainerLogsAsync(
            containerId,
            new ContainerLogsParameters
            {
                ShowStdout = true,
                ShowStderr = true,
                Tail = tail.ToString()
            },
            cancellationToken);

        using var reader = new StreamReader(logs);
        return await reader.ReadToEndAsync(cancellationToken);
    }

    /// <summary>
    /// List all OpenClaw Fleet managed containers.
    /// </summary>
    public async Task<IList<ContainerListResponse>> ListFleetContainersAsync(CancellationToken cancellationToken = default)
    {
        var containers = await _dockerClient.Containers.ListContainersAsync(
            new ContainersListParameters
            {
                All = true,
                Filters = new Dictionary<string, IDictionary<string, bool>>
                {
                    { "label", new Dictionary<string, bool> { { $"{LabelPrefix}.managed=true", true } } }
                }
            },
            cancellationToken);

        return containers;
    }

    /// <summary>
    /// Execute a command in a running container.
    /// </summary>
    public async Task<string> ExecuteCommandAsync(
        string containerId,
        string[] command,
        CancellationToken cancellationToken = default)
    {
        var exec = await _dockerClient.Exec.CreateContainerExecAsync(
            containerId,
            new ContainerExecCreateParameters
            {
                Cmd = command,
                AttachStdout = true,
                AttachStderr = true
            },
            cancellationToken);

        using var stream = await _dockerClient.Exec.StartContainerExecAsync(
            exec.ID,
            new ContainerExecStartParameters(),
            cancellationToken);

        using var reader = new StreamReader(stream);
        return await reader.ReadToEndAsync(cancellationToken);
    }

    public void Dispose()
    {
        _dockerClient?.Dispose();
    }
}

public class ContainerStatus
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsRunning { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? StartedAt { get; set; }
    public string? FinishedAt { get; set; }
    public string? IpAddress { get; set; }
}