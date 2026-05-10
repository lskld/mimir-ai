using Mimir.API.Data.Repositories;
using Mimir.API.Models.Domain;

namespace Mimir.API.Services;

public class ParsingService(
    IDocumentRepository documentRepository,
    ILogger<ParsingService> logger) : IParsingService
{
    public async Task<List<DocumentChunk>> ParseDocumentAsync(Guid documentId)
    {
        _ = (documentRepository, logger);
        // TODO: load Document from documentRepository.GetDocumentAsync(documentId)
        // TODO: if .pdf: use PdfPig PdfDocument.Open() to iterate pages and extract text words
        // TODO: if .docx: use DocumentFormat.OpenXml WordprocessingDocument to extract paragraphs
        // TODO: split extracted text into DocumentChunk objects, populate PageNumber, SectionHeading, ChunkIndex
        // TODO: call documentRepository.SaveChunksAsync(chunks)
        // TODO: call documentRepository.UpdateDocumentStatusAsync(documentId, "Parsed")
        await Task.CompletedTask;
        return [];
    }

    public string? DetectSectionHeading(string text)
    {
        // TODO: heuristic — return text if it's short, title-cased, and does not end with a period
        // TODO: consider trimming and checking IsNullOrWhiteSpace first
        return null;
    }
}
