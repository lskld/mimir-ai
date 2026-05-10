using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

/// <summary>Orchestrates AI-driven requirement extraction and training outline generation.</summary>
public interface IAnalysisService
{
    /// <summary>
    /// Loads document chunks, injects them into the extraction prompt, calls the Groq API,
    /// generates a structured training outline, and persists it.
    /// </summary>
    Task<TrainingOutlineResponse> AnalyzeDocumentAsync(Guid documentId, string regulationType);

    /// <summary>
    /// Takes a list of extracted requirements and calls the Groq API to produce a
    /// structured <see cref="TrainingOutlineResponse"/> with cited sections.
    /// </summary>
    Task<TrainingOutlineResponse> GenerateOutlineAsync(List<string> requirements, Guid documentId, string regulationType);
}
