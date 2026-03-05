namespace OpenClawFleet.Core.Interfaces;

/// <summary>
/// Interface for Ollama model management.
/// </summary>
public interface IOllamaService
{
    /// <summary>
    /// Check if Ollama is available at the configured endpoint.
    /// </summary>
    Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Get list of available models from Ollama.
    /// </summary>
    Task<IEnumerable<OllamaModel>> GetModelsAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Check if a specific model is available.
    /// </summary>
    Task<bool> IsModelAvailableAsync(string modelName, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Pull/download a model from Ollama registry.
    /// </summary>
    Task PullModelAsync(string modelName, CancellationToken cancellationToken = default);
}

/// <summary>
/// Represents an Ollama model.
/// </summary>
public class OllamaModel
{
    public string Name { get; set; } = string.Empty;
    public string? Tag { get; set; }
    public long? Size { get; set; }
    public string? Digest { get; set; }
    public DateTime? ModifiedAt { get; set; }
}