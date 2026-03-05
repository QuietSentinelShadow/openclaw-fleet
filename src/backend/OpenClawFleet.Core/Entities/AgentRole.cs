namespace OpenClawFleet.Core.Entities;

/// <summary>
/// Pre-defined agent role template for OpenClaw instances.
/// </summary>
public class AgentRole
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// Unique identifier for the role (e.g., "coding", "research")
    /// </summary>
    public string Key { get; set; } = string.Empty;
    
    /// <summary>
    /// Display name of the role
    /// </summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// Description of what this role does
    /// </summary>
    public string Description { get; set; } = string.Empty;
    
    /// <summary>
    /// Default Ollama model for this role
    /// </summary>
    public string DefaultModel { get; set; } = "llama3.2";
    
    /// <summary>
    /// Default SOUL.md content for agents with this role
    /// </summary>
    public string DefaultSoulContent { get; set; } = string.Empty;
    
    /// <summary>
    /// Default AGENTS.md content for agents with this role
    /// </summary>
    public string DefaultAgentsContent { get; set; } = string.Empty;
    
    /// <summary>
    /// Skills/capabilities this role provides (JSON array)
    /// </summary>
    public string? Capabilities { get; set; }
    
    /// <summary>
    /// Default skills directory content (skill files as JSON)
    /// </summary>
    public string? DefaultSkills { get; set; }
    
    /// <summary>
    /// Whether this is a built-in system role
    /// </summary>
    public bool IsSystem { get; set; } = false;
    
    /// <summary>
    /// Whether this role is active/available
    /// </summary>
    public bool IsActive { get; set; } = true;
    
    /// <summary>
    /// When this role was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// When this role was last updated
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}