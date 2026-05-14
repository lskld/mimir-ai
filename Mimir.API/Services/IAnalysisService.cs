using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

/// <summary>Orchestrates AI-driven requirement extraction and training outline generation.</summary>
public interface IAnalysisService
{
    /// <summary>
    /// Loads document chunks, injects them into the extraction prompt, calls the LLM API,
    /// generates a structured generic training outline, and persists it.
    /// </summary>
    Task<TrainingOutlineResponse> AnalyzeDocumentAsync(Guid documentId, string regulationType);

    /// <summary>
    /// Takes a list of extracted requirements and calls the LLM API to produce a
    /// structured <see cref="TrainingOutlineResponse"/> with cited sections.
    /// </summary>
    Task<TrainingOutlineResponse> GenerateOutlineAsync(
        List<string> requirements,
        Guid documentId,
        string regulationType);

    /// <summary>
    /// Takes a generic training outline JSON and customizes it for a specific role's risk
    /// profile by calling the LLM once more. The result is not persisted — callers own storage.
    /// </summary>
    Task<TrainingOutlineResponse> CustomizeOutlineForRoleAsync(
        string genericOutlineJson,
        string roleName,
        Dictionary<string, string> riskProfile);
}
