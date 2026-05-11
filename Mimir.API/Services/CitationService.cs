using Mimir.API.Models.Domain;
using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

public class CitationService(ILogger<CitationService> logger) : ICitationService
{
    public CitationResponse BuildCitation(DocumentChunk chunk, string claim)
    {
        _ = logger;
        // TODO: construct CitationResponse from chunk.Document.OriginalFileName, chunk.PageNumber,
        //       chunk.SectionHeading, chunk.Id, and the provided claim text
        throw new NotImplementedException();
    }

    public DocumentChunk MatchClaimToChunk(string claim, List<DocumentChunk> chunks)
    {
        // TODO: tokenize claim into keywords
        // TODO: score each chunk by keyword overlap count
        // TODO: return the highest-scoring chunk
        // NOTE: vector similarity search replaces this in a future version
        throw new NotImplementedException();
    }
}
