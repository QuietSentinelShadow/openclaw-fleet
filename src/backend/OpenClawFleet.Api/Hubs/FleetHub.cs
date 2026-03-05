using Microsoft.AspNetCore.SignalR;
using OpenClawFleet.Core.Entities;

namespace OpenClawFleet.Api.Hubs;

/// <summary>
/// SignalR hub for real-time fleet updates.
/// </summary>
public class FleetHub : Hub
{
    private readonly ILogger<FleetHub> _logger;

    public FleetHub(ILogger<FleetHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Called when a client connects to the hub.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Called when a client disconnects from the hub.
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Subscribe to updates for a specific instance.
    /// </summary>
    public async Task SubscribeToInstance(Guid instanceId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"instance-{instanceId}");
        _logger.LogDebug("Client {ConnectionId} subscribed to instance {InstanceId}", 
            Context.ConnectionId, instanceId);
    }

    /// <summary>
    /// Unsubscribe from updates for a specific instance.
    /// </summary>
    public async Task UnsubscribeFromInstance(Guid instanceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"instance-{instanceId}");
        _logger.LogDebug("Client {ConnectionId} unsubscribed from instance {InstanceId}", 
            Context.ConnectionId, instanceId);
    }

    /// <summary>
    /// Subscribe to all fleet updates.
    /// </summary>
    public async Task SubscribeToFleet()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "fleet");
        _logger.LogDebug("Client {ConnectionId} subscribed to fleet updates", Context.ConnectionId);
    }

    /// <summary>
    /// Unsubscribe from all fleet updates.
    /// </summary>
    public async Task UnsubscribeFromFleet()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "fleet");
        _logger.LogDebug("Client {ConnectionId} unsubscribed from fleet updates", Context.ConnectionId);
    }

    /// <summary>
    /// Subscribe to audit log updates.
    /// </summary>
    public async Task SubscribeToAudit()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "audit");
        _logger.LogDebug("Client {ConnectionId} subscribed to audit updates", Context.ConnectionId);
    }
}

/// <summary>
/// Event types for fleet notifications.
/// </summary>
public enum FleetEventType
{
    InstanceCreated,
    InstanceUpdated,
    InstanceDeleted,
    InstanceStarted,
    InstanceStopped,
    InstanceError,
    TaskCreated,
    TaskUpdated,
    TaskCompleted,
    TaskFailed,
    AuditLogCreated,
    HealthCheckCompleted
}

/// <summary>
/// Event payload for fleet notifications.
/// </summary>
public class FleetEvent
{
    public FleetEventType Type { get; set; }
    public Guid? InstanceId { get; set; }
    public Guid? TaskId { get; set; }
    public string? Message { get; set; }
    public object? Data { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}