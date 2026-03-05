namespace OpenClawFleet.Core.Entities;

/// <summary>
/// Represents a task that can be routed to an OpenClaw instance.
/// </summary>
public class FleetTask
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// The instance assigned to this task
    /// </summary>
    public Guid? InstanceId { get; set; }
    
    /// <summary>
    /// Navigation to the instance
    /// </summary>
    public OpenClawInstance? Instance { get; set; }
    
    /// <summary>
    /// Task title/summary
    /// </summary>
    public string Title { get; set; } = string.Empty;
    
    /// <summary>
    /// Detailed task description/instruction
    /// </summary>
    public string Description { get; set; } = string.Empty;
    
    /// <summary>
    /// Type of task
    /// </summary>
    public TaskType Type { get; set; } = TaskType.Chat;
    
    /// <summary>
    /// Current status of the task
    /// </summary>
    public TaskStatus Status { get; set; } = TaskStatus.Pending;
    
    /// <summary>
    /// Priority level (1-10, higher = more urgent)
    /// </summary>
    public int Priority { get; set; } = 5;
    
    /// <summary>
    /// Required capabilities/skills for this task
    /// </summary>
    public string? RequiredCapabilities { get; set; }
    
    /// <summary>
    /// Preferred model for this task
    /// </summary>
    public string? PreferredModel { get; set; }
    
    /// <summary>
    /// User who submitted the task
    /// </summary>
    public string? SubmittedBy { get; set; }
    
    /// <summary>
    /// Input data for the task
    /// </summary>
    public string? InputData { get; set; }
    
    /// <summary>
    /// Output/result from the task
    /// </summary>
    public string? Result { get; set; }
    
    /// <summary>
    /// Error message if task failed
    /// </summary>
    public string? ErrorMessage { get; set; }
    
    /// <summary>
    /// Parent task ID for subtasks
    /// </summary>
    public Guid? ParentTaskId { get; set; }
    
    /// <summary>
    /// When the task was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// When the task was started
    /// </summary>
    public DateTime? StartedAt { get; set; }
    
    /// <summary>
    /// When the task completed
    /// </summary>
    public DateTime? CompletedAt { get; set; }
    
    /// <summary>
    /// Scheduled execution time (for delayed tasks)
    /// </summary>
    public DateTime? ScheduledFor { get; set; }
    
    /// <summary>
    /// Maximum allowed execution time in seconds
    /// </summary>
    public int TimeoutSeconds { get; set; } = 300;
    
    /// <summary>
    /// Number of retry attempts
    /// </summary>
    public int RetryCount { get; set; } = 0;
    
    /// <summary>
    /// Maximum retry attempts
    /// </summary>
    public int MaxRetries { get; set; } = 3;
}

public enum TaskType
{
    Chat,
    CodeGeneration,
    CodeReview,
    Research,
    Analysis,
    Documentation,
    Testing,
    Deployment,
    Communication,
    Orchestration
}

public enum TaskStatus
{
    Pending,
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
    Timeout,
    Retrying
}