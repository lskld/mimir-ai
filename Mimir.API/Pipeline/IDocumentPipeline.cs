using Mimir.API.Models.Responses;

namespace Mimir.API.Pipeline;

/// <summary>Orchestrates the full document processing pipeline: parse → analyze.</summary>
public interface IDocumentPipeline
{
    /// <summary>
    /// Runs parsing and analysis in sequence for the given document.
    /// On any unhandled exception, the document status is set to Failed before rethrowing.
    /// </summary>
    Task<TrainingOutlineResponse> RunAsync(Guid documentId, string regulationType);
}
