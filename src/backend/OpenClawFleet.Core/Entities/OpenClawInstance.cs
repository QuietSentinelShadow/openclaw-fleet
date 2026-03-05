namespace OpenClawFleet.Core.Entities;

/// <summary>
/// Represents a single OpenClaw Docker instance managed by the fleet.
/// </summary>
public class OpenClawInstance
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// Unique name/identifier for this instance
    /// </summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// Human-readable description of the instance's purpose
    /// </summary>
    public string Description { get; set; } = string.Empty;
    
    /// <summary>
    /// The agent role type (coding, research, communication, etc.)
    /// </summary>
    public string AgentRole { get; set; } = string.Empty;
    
    /// <summary>
    /// Docker container ID (when running)
    /// </summary>
    public string? ContainerId { get; set; }
    
    /// <summary>
    /// Container name in Docker
    /// </summary>
    public string? ContainerName { get; set; }
    
    /// <summary>
    /// Port exposed by the container for gateway access
    /// </summary>
    public int Port { get; set; }
    
    /// <summary>
    /// Current status of the instance
    /// </summary>
    public InstanceStatus Status { get; set; } = InstanceStatus.Stopped;
    
    /// <summary>
    /// Ollama model to use for inference
    /// </summary>
    public string OllamaModel { get; set; } = "llama3.2";
    
    /// <summary>
    /// Path to the workspace directory on the host
    /// </summary>
    public string WorkspacePath { get; set; } = string.Empty;
    
    /// <summary>
    /// Custom configuration JSON for OpenClaw
    /// </summary>
    public string? CustomConfig { get; set; }
    
    /// <summary>
    /// SOUL.md content for this agent's persona
    /// </summary>
    public string? SoulContent { get; set; }
    
    /// <summary>
    /// AGENTS.md content for this agent's instructions
    /// </summary>
    public string? AgentsContent { get; set; }
    
    /// <summary>
    /// Skills directory path relative to workspace
    /// </summary>
    public string? SkillsPath { get; set; }
    
    /// <summary>
    /// When this instance was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// When this instance was last started
    /// </summary>
    public DateTime? LastStartedAt { get; set; }
    
    /// <summary>
    /// When this instance was last stopped
    /// </summary>
    public DateTime? LastStoppedAt { get; set; }
    
    /// <summary>
    /// Health check timestamp
    /// </summary>
    public DateTime? LastHealthCheck { get; set; }
    
    /// <summary>
    /// Navigation to audit logs
    /// </summary>
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    
    /// <summary>
    /// Navigation to tasks
    /// </summary>
    public ICollection<FleetTask> Tasks { get; set; } = new List<FleetTask>();
}

public enum InstanceStatus
{
    /// <summary>
    /// Instance is not running
    /// </summary>
    Stopped,
    
    /// <summary>
    /// Instance is starting up
    /// </summary>
    Starting,
    
    /// <summary>
    /// Instance is running and healthy
    /// </summary>
    Running,
    
    /// <summary>
    /// Instance is stopping
    /// </summary>
    Stopping,
    
    /// <summary>
    /// Instance is in an error state
    /// </summary>
    Error,
    
    /// <summary>
    /// Instance is being created
    /// </summary>
    Creating
}