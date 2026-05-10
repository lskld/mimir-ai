using Mimir.API.Models.Domain;

namespace Mimir.API.Services;

/// <summary>Extracts structured text chunks from uploaded documents.</summary>
public interface IParsingService
{
    /// <summary>
    /// Loads the document from the database, parses its file content into chunks,
    /// persists the chunks, and updates the document status to Parsed.
    /// </summary>
    Task<List<DocumentChunk>> ParseDocumentAsync(Guid documentId);

    /// <summary>
    /// Heuristically detects whether a line of text is a section heading.
    /// Returns the heading text, or null if the line is not a heading.
    /// </summary>
    string? DetectSectionHeading(string text);
}
