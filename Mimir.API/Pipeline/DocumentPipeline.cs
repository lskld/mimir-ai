using System.Diagnostics;
using Mimir.API.Data.Repositories;
using Mimir.API.Models.Responses;
using Mimir.API.Services;

namespace Mimir.API.Pipeline;

public class DocumentPipeline(
    IParsingService parsingService,
    IAnalysisService analysisService,
    IDocumentRepository documentRepository,
    ILogger<DocumentPipeline> logger) : IDocumentPipeline
{
    private static readonly Lock _runningLock = new();
    private static readonly HashSet<Guid> _runningDocuments = [];

    public async Task<TrainingOutlineResponse> RunAsync(
        Guid documentId,
        string regulationType,
        string? roleName = null,
        Dictionary<string, string>? riskProfile = null)
    {
        lock (_runningLock)
        {
            if (!_runningDocuments.Add(documentId))
                throw new InvalidOperationException(
                    $"Document {documentId} is already being processed.");
        }

        var elapsed = Stopwatch.StartNew();

        try
        {
            if (string.IsNullOrEmpty(roleName))
                logger.LogInformation(
                    "Pipeline started for document {DocumentId}, regulation: {RegulationType}",
                    documentId, regulationType);
            else
                logger.LogInformation(
                    "Pipeline started for document {DocumentId}, regulation: {RegulationType}, role: {RoleName}",
                    documentId, regulationType, roleName);

            var chunks = await parsingService.ParseDocumentAsync(documentId);
            logger.LogInformation(
                "Pipeline step 1 complete: {ChunkCount} chunks parsed for document {DocumentId}",
                chunks.Count, documentId);

            var outline = await analysisService.AnalyzeDocumentAsync(documentId, regulationType, roleName, riskProfile);
            logger.LogInformation(
                "Pipeline step 2 complete: outline generated for document {DocumentId} with {SectionCount} sections",
                documentId, outline.Sections.Count);

            elapsed.Stop();
            logger.LogInformation(
                "Pipeline completed for document {DocumentId} in {Elapsed:F1} seconds",
                documentId, elapsed.Elapsed.TotalSeconds);

            return outline;
        }
        catch (Exception ex)
        {
            elapsed.Stop();
            logger.LogError(ex,
                "Pipeline failed for document {DocumentId} after {Elapsed:F1} seconds: {Message}",
                documentId, elapsed.Elapsed.TotalSeconds, ex.Message);

            try
            {
                await documentRepository.UpdateDocumentStatusAsync(documentId, "Failed");
            }
            catch (Exception statusEx)
            {
                logger.LogWarning(statusEx,
                    "Additionally failed to update document status to Failed for document {DocumentId}",
                    documentId);
            }

            throw;
        }
        finally
        {
            lock (_runningLock)
            {
                _runningDocuments.Remove(documentId);
            }
        }
    }
}
