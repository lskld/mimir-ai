using Mimir.API.Models.Responses;

namespace Mimir.API.Pipeline;

/// <summary>Orchestrates the full document processing pipeline: parse → analyze.</summary>
public interface IDocumentPipeline
{
    /// <summary>
    /// Runs parsing and analysis in sequence for the given document.
    /// On any unhandled exception, the document status is set to Failed before rethrowing.
    ///
    /// Optional role context (roleName, riskProfile) calibrates training depth and content
    /// specificity to a particular role's risk exposure. If omitted, analysis is generic.
    /// </summary>
    Task<TrainingOutlineResponse> RunAsync(
        Guid documentId,
        string regulationType,
        string? roleName = null,
        Dictionary<string, string>? riskProfile = null);
}
