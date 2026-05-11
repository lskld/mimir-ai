using Mimir.API.Models.Responses;
using Mimir.API.Services;

namespace Mimir.API.Pipeline;

public class DocumentPipeline(
    IDocumentService documentService,
    IParsingService parsingService,
    IAnalysisService analysisService,
    ILogger<DocumentPipeline> logger) : IDocumentPipeline
{
    private static readonly Lock _runningLock = new();
    private static readonly HashSet<Guid> _runningDocuments = [];

    public async Task<TrainingOutlineResponse> RunAsync(Guid documentId, string regulationType)
    {
        _ = (documentService, parsingService, analysisService, logger);

        lock (_runningLock)
        {
            // TODO: if _runningDocuments.Contains(documentId), throw InvalidOperationException to prevent duplicate runs
            _runningDocuments.Add(documentId);
        }

        try
        {
            // TODO: await parsingService.ParseDocumentAsync(documentId)
            // TODO: return await analysisService.AnalyzeDocumentAsync(documentId, regulationType)
            await Task.CompletedTask;
            throw new NotImplementedException();
        }
        catch (NotImplementedException)
        {
            throw;
        }
        catch (Exception)
        {
            // TODO: await documentService.UpdateDocumentStatusAsync equivalent — set status to "Failed"
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
