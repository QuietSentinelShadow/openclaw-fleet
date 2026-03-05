using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using OpenClawFleet.Core.Entities;
using OpenClawFleet.Core.Interfaces;
using OpenClawFleet.Infrastructure.Data;
using OpenClawFleet.Api.Hubs;

namespace OpenClawFleet.Api.Controllers;

/// <summary>
/// API controller for managing OpenClaw fleet instances.
/// </summary>
[ApiController]
[Route("api/fleet")]
public class FleetController : ControllerBase
{
    private readonly FleetDbContext _dbContext;
    private readonly IDockerService _dockerService;
    private readonly IHubContext<FleetHub> _hubContext;
    private readonly ILogger<FleetController> _logger;

    public FleetController(
        FleetDbContext dbContext,
        IDockerService dockerService,
        IHubContext<FleetHub> hubContext,
        ILogger<FleetController> logger)
    {
        _dbContext = dbContext;
        _dockerService = dockerService;
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <summary>
    /// Get all fleet instances.
    /// </summary>
    [HttpGet("instances")]
    public async Task<ActionResult<IEnumerable<OpenClawInstance>>> GetInstances()
    {
        var instances = await _dbContext.Instances
            .OrderBy(i => i.Name)
            .ToListAsync();
        return Ok(instances);
    }

    /// <summary>
    /// Get a specific instance by ID.
    /// </summary>
    [HttpGet("instances/{id}")]
    public async Task<ActionResult<OpenClawInstance>> GetInstance(Guid id)
    {
        var instance = await _dbContext.Instances.FindAsync(id);
        if (instance == null)
        {
            return NotFound(new { error = $"Instance {id} not found" });
        }
        return Ok(instance);
    }

    /// <summary>
    /// Create a new OpenClaw instance.
    /// </summary>
    [HttpPost("instances")]
    public async Task<ActionResult<OpenClawInstance>> CreateInstance([FromBody] CreateInstanceRequest request)
    {
        // Validate agent role exists
        var agentRole = await _dbContext.AgentRoles.FindAsync(request.AgentRoleId);
        if (agentRole == null)
        {
            return BadRequest(new { error = "Invalid agent role" });
        }

        // Generate workspace path
        var workspacePath = $"./workspaces/{request.Name.ToLowerInvariant().Replace(" ", "-")}";
        
        // Find next available port
        var usedPorts = await _dbContext.Instances.Select(i => i.Port).ToListAsync();
        var port = 18800;
        while (usedPorts.Contains(port))
        {
            port++;
        }

        var instance = new OpenClawInstance
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description ?? string.Empty,
            AgentRole = agentRole.Key,
            Port = port,
            OllamaModel = request.OllamaModel ?? agentRole.DefaultModel,
            WorkspacePath = workspacePath,
            SoulContent = request.SoulContent ?? agentRole.DefaultSoulContent,
            AgentsContent = request.AgentsContent ?? agentRole.DefaultAgentsContent,
            Status = InstanceStatus.Creating,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Instances.Add(instance);
        await _dbContext.SaveChangesAsync();

        // Create workspace directory and config files
        await CreateWorkspaceAsync(instance, agentRole);

        // Create Docker container
        try
        {
            var containerId = await _dockerService.CreateContainerAsync(instance);
            instance.ContainerId = containerId;
            instance.ContainerName = $"openclaw-{instance.Name.ToLowerInvariant().Replace(" ", "-")}";
            instance.Status = InstanceStatus.Stopped;
            await _dbContext.SaveChangesAsync();

            // Notify clients
            await _hubContext.Clients.Group("fleet").SendAsync("InstanceCreated", instance);

            return CreatedAtAction(nameof(GetInstance), new { id = instance.Id }, instance);
        }
        catch (Exception ex)
        {
            instance.Status = InstanceStatus.Error;
            await _dbContext.SaveChangesAsync();
            _logger.LogError(ex, "Failed to create container for instance {InstanceId}", instance.Id);
            return StatusCode(500, new { error = $"Failed to create container: {ex.Message}" });
        }
    }

    /// <summary>
    /// Update an existing instance.
    /// </summary>
    [HttpPut("instances/{id}")]
    public async Task<ActionResult<OpenClawInstance>> UpdateInstance(Guid id, [FromBody] UpdateInstanceRequest request)
    {
        var instance = await _dbContext.Instances.FindAsync(id);
        if (instance == null)
        {
            return NotFound(new { error = $"Instance {id} not found" });
        }

        if (instance.Status == InstanceStatus.Running)
        {
            return BadRequest(new { error = "Cannot update a running instance. Stop it first." });
        }

        if (request.Description != null)
            instance.Description = request.Description;
        if (request.OllamaModel != null)
            instance.OllamaModel = request.OllamaModel;
        if (request.SoulContent != null)
            instance.SoulContent = request.SoulContent;
        if (request.AgentsContent != null)
            instance.AgentsContent = request.AgentsContent;
        if (request.CustomConfig != null)
            instance.CustomConfig = request.CustomConfig;

        await _dbContext.SaveChangesAsync();

        // Update workspace files
        await UpdateWorkspaceFilesAsync(instance);

        await _hubContext.Clients.Group("fleet").SendAsync("InstanceUpdated", instance);
        await _hubContext.Clients.Group($"instance-{id}").SendAsync("InstanceUpdated", instance);

        return Ok(instance);
    }

    /// <summary>
    /// Delete an instance.
    /// </summary>
    [HttpDelete("instances/{id}")]
    public async Task<ActionResult> DeleteInstance(Guid id)
    {
        var instance = await _dbContext.Instances.FindAsync(id);
        if (instance == null)
        {
            return NotFound(new { error = $"Instance {id} not found" });
        }

        // Stop and remove container if exists
        if (!string.IsNullOrEmpty(instance.ContainerId))
        {
            try
            {
                await _dockerService.StopContainerAsync(instance.ContainerId);
                await _dockerService.RemoveContainerAsync(instance.ContainerId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to remove container {ContainerId}", instance.ContainerId);
            }
        }

        _dbContext.Instances.Remove(instance);
        await _dbContext.SaveChangesAsync();

        await _hubContext.Clients.Group("fleet").SendAsync("InstanceDeleted", id);

        return NoContent();
    }

    /// <summary>
    /// Start an instance.
    /// </summary>
    [HttpPost("instances/{id}/start")]
    public async Task<ActionResult> StartInstance(Guid id)
    {
        var instance = await _dbContext.Instances.FindAsync(id);
        if (instance == null)
        {
            return NotFound(new { error = $"Instance {id} not found" });
        }

        if (instance.Status == InstanceStatus.Running)
        {
            return BadRequest(new { error = "Instance is already running" });
        }

        if (string.IsNullOrEmpty(instance.ContainerId))
        {
            return BadRequest(new { error = "Instance has no container" });
        }

        try
        {
            instance.Status = InstanceStatus.Starting;
            await _dbContext.SaveChangesAsync();

            await _dockerService.StartContainerAsync(instance.ContainerId);
            
            instance.Status = InstanceStatus.Running;
            instance.LastStartedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            await _hubContext.Clients.Group("fleet").SendAsync("InstanceStarted", instance);
            await _hubContext.Clients.Group($"instance-{id}").SendAsync("InstanceStarted", instance);

            return Ok(new { message = "Instance started", instance });
        }
        catch (Exception ex)
        {
            instance.Status = InstanceStatus.Error;
            await _dbContext.SaveChangesAsync();
            _logger.LogError(ex, "Failed to start instance {InstanceId}", id);
            return StatusCode(500, new { error = $"Failed to start instance: {ex.Message}" });
        }
    }

    /// <summary>
    /// Stop an instance.
    /// </summary>
    [HttpPost("instances/{id}/stop")]
    public async Task<ActionResult> StopInstance(Guid id)
    {
        var instance = await _dbContext.Instances.FindAsync(id);
        if (instance == null)
        {
            return NotFound(new { error = $"Instance {id} not found" });
        }

        if (instance.Status != InstanceStatus.Running)
        {
            return BadRequest(new { error = "Instance is not running" });
        }

        try
        {
            instance.Status = InstanceStatus.Stopping;
            await _dbContext.SaveChangesAsync();

            await _dockerService.StopContainerAsync(instance.ContainerId);
            
            instance.Status = InstanceStatus.Stopped;
            instance.LastStoppedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            await _hubContext.Clients.Group("fleet").SendAsync("InstanceStopped", instance);
            await _hubContext.Clients.Group($"instance-{id}").SendAsync("InstanceStopped", instance);

            return Ok(new { message = "Instance stopped", instance });
        }
        catch (Exception ex)
        {
            instance.Status = InstanceStatus.Error;
            await _dbContext.SaveChangesAsync();
            _logger.LogError(ex, "Failed to stop instance {InstanceId}", id);
            return StatusCode(500, new { error = $"Failed to stop instance: {ex.Message}" });
        }
    }

    /// <summary>
    /// Get instance status.
    /// </summary>
    [HttpGet("instances/{id}/status")]
    public async Task<ActionResult> GetInstanceStatus(Guid id)
    {
        var instance = await _dbContext.Instances.FindAsync(id);
        if (instance == null)
        {
            return NotFound(new { error = $"Instance {id} not found" });
        }

        if (string.IsNullOrEmpty(instance.ContainerId))
        {
            return Ok(new { status = instance.Status.ToString().ToLower() });
        }

        try
        {
            var containerStatus = await _dockerService.GetContainerStatusAsync(instance.ContainerId);
            return Ok(new
            {
                status = instance.Status.ToString().ToLower(),
                container = containerStatus,
                port = instance.Port,
                gatewayUrl = $"http://localhost:{instance.Port}"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get container status for {InstanceId}", id);
            return Ok(new { status = "error", error = ex.Message });
        }
    }

    /// <summary>
    /// Get instance logs.
    /// </summary>
    [HttpGet("instances/{id}/logs")]
    public async Task<ActionResult> GetInstanceLogs(Guid id, [FromQuery] int tail = 100)
    {
        var instance = await _dbContext.Instances.FindAsync(id);
        if (instance == null)
        {
            return NotFound(new { error = $"Instance {id} not found" });
        }

        if (string.IsNullOrEmpty(instance.ContainerId))
        {
            return Ok(new { logs = "" });
        }

        try
        {
            var logs = await _dockerService.GetContainerLogsAsync(instance.ContainerId, tail);
            return Ok(new { logs });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get logs for instance {InstanceId}", id);
            return StatusCode(500, new { error = $"Failed to get logs: {ex.Message}" });
        }
    }

    /// <summary>
    /// Get available agent roles.
    /// </summary>
    [HttpGet("roles")]
    public async Task<ActionResult<IEnumerable<AgentRole>>> GetAgentRoles()
    {
        var roles = await _dbContext.AgentRoles
            .Where(r => r.IsActive)
            .OrderBy(r => r.Name)
            .ToListAsync();
        return Ok(roles);
    }

    /// <summary>
    /// Get fleet statistics.
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult> GetStats()
    {
        var totalInstances = await _dbContext.Instances.CountAsync();
        var runningInstances = await _dbContext.Instances.CountAsync(i => i.Status == InstanceStatus.Running);
        var stoppedInstances = await _dbContext.Instances.CountAsync(i => i.Status == InstanceStatus.Stopped);
        var errorInstances = await _dbContext.Instances.CountAsync(i => i.Status == InstanceStatus.Error);
        var pendingTasks = await _dbContext.Tasks.CountAsync(t => t.Status == TaskStatus.Pending || t.Status == TaskStatus.Queued);
        var runningTasks = await _dbContext.Tasks.CountAsync(t => t.Status == TaskStatus.Running);

        return Ok(new
        {
            instances = new
            {
                total = totalInstances,
                running = runningInstances,
                stopped = stoppedInstances,
                error = errorInstances
            },
            tasks = new
            {
                pending = pendingTasks,
                running = runningTasks
            }
        });
    }

    private async Task CreateWorkspaceAsync(OpenClawInstance instance, AgentRole role)
    {
        // In a real implementation, this would create the directory and files
        // For now, we'll log the action
        _logger.LogInformation("Creating workspace for instance {InstanceId} at {WorkspacePath}", 
            instance.Id, instance.WorkspacePath);
        
        await Task.CompletedTask;
    }

    private async Task UpdateWorkspaceFilesAsync(OpenClawInstance instance)
    {
        _logger.LogInformation("Updating workspace files for instance {InstanceId}", instance.Id);
        await Task.CompletedTask;
    }
}

// Request DTOs
public class CreateInstanceRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid AgentRoleId { get; set; }
    public string? OllamaModel { get; set; }
    public string? SoulContent { get; set; }
    public string? AgentsContent { get; set; }
}

public class UpdateInstanceRequest
{
    public string? Description { get; set; }
    public string? OllamaModel { get; set; }
    public string? SoulContent { get; set; }
    public string? AgentsContent { get; set; }
    public string? CustomConfig { get; set; }
}