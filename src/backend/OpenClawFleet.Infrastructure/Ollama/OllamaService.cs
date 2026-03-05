using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using OpenClawFleet.Core.Interfaces;

namespace OpenClawFleet.Infrastructure.Ollama;

/// <summary>
/// Service for interacting with Ollama API.
/// </summary>
public class OllamaService : IOllamaService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OllamaService> _logger;
    private readonly string _baseUrl;

    public OllamaService(ILogger<OllamaService> logger, string baseUrl = "http://localhost:11434")
    {
        _logger = logger;
        _baseUrl = baseUrl;
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(baseUrl),
            Timeout = TimeSpan.FromMinutes(10) // For model pulls
        };
    }

    /// <summary>
    /// Check if Ollama is available at the configured endpoint.
    /// </summary>
    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ollama is not available at {BaseUrl}", _baseUrl);
            return false;
        }
    }

    /// <summary>
    /// Get list of available models from Ollama.
    /// </summary>
    public async Task<IEnumerable<OllamaModel>> GetModelsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/tags", cancellationToken);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var modelsResponse = JsonSerializer.Deserialize<OllamaTagsResponse>(content, 
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            return modelsResponse?.Models?.Select(m => new OllamaModel
            {
                Name = m.Name ?? string.Empty,
                Tag = m.Tag,
                Size = m.Size,
                Digest = m.Digest,
                ModifiedAt = m.ModifiedAt
            }) ?? Enumerable.Empty<OllamaModel>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get models from Ollama");
            return Enumerable.Empty<OllamaModel>();
        }
    }

    /// <summary>
    /// Check if a specific model is available.
    /// </summary>
    public async Task<bool> IsModelAvailableAsync(string modelName, CancellationToken cancellationToken = default)
    {
        var models = await GetModelsAsync(cancellationToken);
        return models.Any(m => m.Name.Equals(modelName, StringComparison.OrdinalIgnoreCase) ||
                              m.Name.StartsWith($"{modelName}:", StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Pull/download a model from Ollama registry.
    /// </summary>
    public async Task PullModelAsync(string modelName, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Pulling model {ModelName} from Ollama", modelName);

        var pullRequest = new { name = modelName, stream = false };
        var response = await _httpClient.PostAsJsonAsync("/api/pull", pullRequest, cancellationToken);
        
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Failed to pull model {modelName}: {error}");
        }

        _logger.LogInformation("Model {ModelName} pulled successfully", modelName);
    }
}

// DTOs for Ollama API responses
internal class OllamaTagsResponse
{
    public List<OllamaModelResponse>? Models { get; set; }
}

internal class OllamaModelResponse
{
    public string? Name { get; set; }
    public string? Tag { get; set; }
    public long? Size { get; set; }
    public string? Digest { get; set; }
    public DateTime? ModifiedAt { get; set; }
}