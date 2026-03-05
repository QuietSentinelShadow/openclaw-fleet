using OpenClawFleet.Core.Entities;

namespace OpenClawFleet.Core.Interfaces;

/// <summary>
/// Interface for Docker container management.
/// </summary>
public interface IDockerService : IDisposable
{
    Task<bool> IsDockerAvailableAsync();
    Task PullImageAsync(CancellationToken cancellationToken = default);
    Task<string> CreateContainerAsync(OpenClawInstance instance, CancellationToken cancellationToken = default);
    Task StartContainerAsync(string containerId, CancellationToken cancellationToken = default);
    Task StopContainerAsync(string containerId, CancellationToken cancellationToken = default);
    Task RemoveContainerAsync(string containerId, CancellationToken cancellationToken = default);
    Task<ContainerStatus> GetContainerStatusAsync(string containerId, CancellationToken cancellationToken = default);
    Task<string> GetContainerLogsAsync(string containerId, int tail = 100, CancellationToken cancellationToken = default);
    Task<IList<Docker.DotNet.Models.ContainerListResponse>> ListFleetContainersAsync(CancellationToken cancellationToken = default);
    Task<string> ExecuteCommandAsync(string containerId, string[] command, CancellationToken cancellationToken = default);
}