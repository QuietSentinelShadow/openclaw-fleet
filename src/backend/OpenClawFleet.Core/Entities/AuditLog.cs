namespace OpenClawFleet.Core.Entities;

/// <summary>
/// Audit log entry for all communications sent and received.
/// </summary>
public class AuditLog
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// The instance this log belongs to
    /// </summary>
    public Guid InstanceId { get; set; }
    
    /// <summary>
    /// Navigation to the instance
    /// </summary>
    public OpenClawInstance? Instance { get; set; }
    
    /// <summary>
    /// Direction of the communication
    /// </summary>
    public CommunicationDirection Direction { get; set; }
    
    /// <summary>
    /// Type of communication
    /// </summary>
    public CommunicationType Type { get; set; }
    
    /// <summary>
    /// The message content
    /// </summary>
    public string Content { get; set; } = string.Empty;
    
    /// <summary>
    /// Response content (if applicable)
    /// </summary>
    public string? Response { get; set; }
    
    /// <summary>
    /// Source/origin of the message
    /// </summary>
    public string? Source { get; set; }
    
    /// <summary>
    /// Destination/target of the message
    /// </summary>
    public string? Destination { get; set; }
    
    /// <summary>
    /// User who initiated the communication
    /// </summary>
    public string? UserId { get; set; }
    
    /// <summary>
    /// Session ID for the conversation
    /// </summary>
    public string? SessionId { get; set; }
    
    /// <summary>
    /// Model used for generating response
    /// </summary>
    public string? Model { get; set; }
    
    /// <summary>
    /// Number of tokens in the request
    /// </summary>
    public int? RequestTokens { get; set; }
    
    /// <summary>
    /// Number of tokens in the response
    /// </summary>
    public int? ResponseTokens { get; set; }
    
    /// <summary>
    /// Latency in milliseconds
    /// </summary>
    public long? LatencyMs { get; set; }
    
    /// <summary>
    /// Whether the communication was successful
    /// </summary>
    public bool IsSuccess { get; set; } = true;
    
    /// <summary>
    /// Error message if failed
    /// </summary>
    public string? ErrorMessage { get; set; }
    
    /// <summary>
    /// Additional metadata as JSON
    /// </summary>
    public string? Metadata { get; set; }
    
    /// <summary>
    /// When the communication occurred
    /// </summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public enum CommunicationDirection
{
    Inbound,
    Outbound,
    Internal
}

public enum CommunicationType
{
    Chat,
    Task,
    Command,
    System,
    HealthCheck,
    Error
}