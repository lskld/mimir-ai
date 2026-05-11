using Mimir.API.Models.Domain;
using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

public class CitationService(ILogger<CitationService> logger) : ICitationService
{
    private static readonly HashSet<string> StopWords =
    [
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "is", "are", "was", "were", "be", "been", "has", "have",
        "had", "this", "that", "it", "its", "as", "by", "from", "not", "will",
        "shall", "must", "may", "should"
    ];

    public CitationResponse BuildCitation(DocumentChunk chunk, string claim)
    {
        return new CitationResponse
        {
            Text = claim,
            SourceDocument = chunk.Document?.OriginalFileName ?? "Unknown source",
            PageNumber = chunk.PageNumber,
            Section = chunk.SectionHeading ?? "General",
            ChunkId = chunk.Id
        };
    }

    // Keyword overlap scoring: counts shared content words between the claim and each chunk.
    // In a production version, vector similarity search (e.g. cosine distance over embeddings)
    // would replace this approach for significantly better semantic accuracy.
    public DocumentChunk MatchClaimToChunk(string claim, List<DocumentChunk> chunks)
    {
        if (chunks.Count == 0)
            throw new ArgumentException("Cannot match claim to an empty chunk list");

        var claimTokens = NormalizeAndTokenize(claim);

        DocumentChunk bestChunk = chunks[0];
        var bestScore = 0;

        foreach (var chunk in chunks)
        {
            var contentTokens = NormalizeAndTokenize(chunk.Content);
            var score = claimTokens.Count(t => contentTokens.Contains(t));

            if (score > 0 && chunk.SectionHeading is not null)
            {
                var headingTokens = NormalizeAndTokenize(chunk.SectionHeading);
                if (claimTokens.Any(t => headingTokens.Contains(t)))
                    score += 2;
            }

            if (score > bestScore)
            {
                bestScore = score;
                bestChunk = chunk;
            }
        }

        logger.LogDebug(
            "Matched claim to chunk {ChunkId} with score {Score} (page {PageNumber}, section {SectionHeading})",
            bestChunk.Id, bestScore, bestChunk.PageNumber, bestChunk.SectionHeading);

        return bestChunk;
    }

    private static HashSet<string> NormalizeAndTokenize(string text)
    {
        var tokens = new HashSet<string>();
        var current = new System.Text.StringBuilder();

        foreach (var c in text)
        {
            if (char.IsLetter(c))
            {
                current.Append(char.ToLowerInvariant(c));
            }
            else if (current.Length > 0)
            {
                var word = current.ToString();
                if (word.Length >= 3 && !StopWords.Contains(word))
                    tokens.Add(word);
                current.Clear();
            }
        }

        if (current.Length > 0)
        {
            var word = current.ToString();
            if (word.Length >= 3 && !StopWords.Contains(word))
                tokens.Add(word);
        }

        return tokens;
    }
}
