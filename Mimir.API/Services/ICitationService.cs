using Mimir.API.Models.Domain;
using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

/// <summary>Maps AI-generated claims back to source document chunks.</summary>
public interface ICitationService
{
    /// <summary>Constructs a <see cref="CitationResponse"/> from chunk metadata and the claim text it supports.</summary>
    CitationResponse BuildCitation(DocumentChunk chunk, string claim);

    /// <summary>
    /// Finds the chunk from <paramref name="chunks"/> that best supports <paramref name="claim"/>
    /// using keyword overlap matching.
    /// </summary>
    DocumentChunk MatchClaimToChunk(string claim, List<DocumentChunk> chunks);
}
