using System.Text;
using DocumentFormat.OpenXml.Packaging;
using Wordprocessing = DocumentFormat.OpenXml.Wordprocessing;
using UglyToad.PdfPig;
using Mimir.API.Data.Repositories;
using Mimir.API.Models.Domain;

namespace Mimir.API.Services;

public class ParsingService(
    IDocumentRepository documentRepository,
    ILogger<ParsingService> logger) : IParsingService
{
    public async Task<List<DocumentChunk>> ParseDocumentAsync(Guid documentId)
    {
        var document = await documentRepository.GetDocumentAsync(documentId)
            ?? throw new KeyNotFoundException($"Document {documentId} not found");

        if (document.Status == "Parsed")
            logger.LogWarning("Document {DocumentId} is already Parsed — re-parsing", documentId);
        else if (document.Status == "Failed")
            logger.LogWarning("Document {DocumentId} previously Failed — attempting re-parse", documentId);

        var extension = Path.GetExtension(document.FileName).ToLowerInvariant();

        List<DocumentChunk> chunks = extension switch
        {
            ".pdf" => await ParsePdfAsync(document),
            ".docx" => await ParseDocxAsync(document),
            _ => throw new NotSupportedException($"Unsupported file type: {extension}")
        };

        await documentRepository.SaveChunksAsync(chunks);
        await documentRepository.UpdateDocumentStatusAsync(documentId, "Parsed");
        logger.LogInformation("Parsed document {DocumentId}: {ChunkCount} chunks extracted", documentId, chunks.Count);

        return chunks;
    }

    public string? DetectSectionHeading(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        var firstLine = text.Split('\n', StringSplitOptions.RemoveEmptyEntries)[0].Trim();

        if (firstLine.Length > 80 || firstLine.EndsWith('.'))
            return null;

        // All uppercase
        if (firstLine.Any(char.IsLetter) && firstLine.Where(char.IsLetter).All(char.IsUpper))
            return firstLine;

        // Title case: ≥60% of words start with an uppercase letter
        var words = firstLine.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length == 0)
            return null;

        var uppercaseStarts = words.Count(w => char.IsUpper(w[0]));
        if ((double)uppercaseStarts / words.Length >= 0.6)
            return firstLine;

        return null;
    }

    private async Task<List<DocumentChunk>> ParsePdfAsync(Document document)
    {
        if (!File.Exists(document.FilePath))
            throw new FileNotFoundException($"File not found at path: {document.FilePath}");

        var chunks = new List<DocumentChunk>();
        var chunkIndex = 0;

        try
        {
            using var pdf = PdfDocument.Open(document.FilePath);
            foreach (var page in pdf.GetPages())
            {
                var words = page.GetWords().ToList();
                var pageText = string.Join(" ", words.Select(w => w.Text));

                if (string.IsNullOrWhiteSpace(pageText))
                    continue;

                logger.LogDebug("Page {PageNumber}: extracted {WordCount} words", page.Number, words.Count);

                foreach (var chunkText in ChunkText(pageText))
                {
                    chunks.Add(new DocumentChunk
                    {
                        Id = Guid.NewGuid(),
                        DocumentId = document.Id,
                        Content = chunkText,
                        PageNumber = page.Number,
                        SectionHeading = DetectSectionHeading(chunkText),
                        ChunkIndex = chunkIndex++,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }
        catch (Exception ex)
        {
            await documentRepository.UpdateDocumentStatusAsync(document.Id, "Failed");
            logger.LogError(ex, "PDF parsing failed for document {DocumentId}: {Message}", document.Id, ex.Message);
            throw new InvalidOperationException($"Failed to parse PDF document {document.Id}: {ex.Message}", ex);
        }

        return chunks;
    }

    private async Task<List<DocumentChunk>> ParseDocxAsync(Document document)
    {
        if (!File.Exists(document.FilePath))
            throw new FileNotFoundException($"File not found at path: {document.FilePath}");

        var chunks = new List<DocumentChunk>();
        var chunkIndex = 0;

        try
        {
            using var docx = WordprocessingDocument.Open(document.FilePath, false);
            var mainPart = docx.MainDocumentPart
                ?? throw new InvalidOperationException($"DOCX document {document.Id} has no main content");

            var paragraphs = mainPart.Document?.Body?.Elements<Wordprocessing.Paragraph>().ToList() ?? [];

            var buffer = new StringBuilder();
            string? currentHeading = null;
            var totalCharsProcessed = 0;
            var paragraphCount = 0;

            foreach (var paragraph in paragraphs)
            {
                var styleId = paragraph.ParagraphProperties?.ParagraphStyleId?.Val?.Value;
                var isHeading = styleId is not null
                    && styleId.Contains("heading", StringComparison.OrdinalIgnoreCase);

                var paraText = string.Concat(paragraph.Descendants<Wordprocessing.Text>().Select(t => t.Text)).Trim();
                if (string.IsNullOrWhiteSpace(paraText))
                    continue;

                paragraphCount++;

                if (isHeading)
                {
                    if (buffer.Length > 0)
                    {
                        // Page approximation: every 3000 characters ≈ one page
                        var pageNumber = totalCharsProcessed / 3000 + 1;
                        foreach (var chunkText in ChunkText(buffer.ToString()))
                        {
                            chunks.Add(new DocumentChunk
                            {
                                Id = Guid.NewGuid(),
                                DocumentId = document.Id,
                                Content = chunkText,
                                PageNumber = pageNumber,
                                SectionHeading = currentHeading,
                                ChunkIndex = chunkIndex++,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                        totalCharsProcessed += buffer.Length;
                        buffer.Clear();
                    }
                    currentHeading = paraText;
                    continue;
                }

                if (buffer.Length > 0)
                    buffer.Append(' ');
                buffer.Append(paraText);

                if (buffer.Length > 800)
                {
                    // Page approximation: every 3000 characters ≈ one page
                    var pageNumber = totalCharsProcessed / 3000 + 1;
                    foreach (var chunkText in ChunkText(buffer.ToString()))
                    {
                        chunks.Add(new DocumentChunk
                        {
                            Id = Guid.NewGuid(),
                            DocumentId = document.Id,
                            Content = chunkText,
                            PageNumber = pageNumber,
                            SectionHeading = currentHeading,
                            ChunkIndex = chunkIndex++,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                    totalCharsProcessed += buffer.Length;
                    buffer.Clear();
                }
            }

            // Flush remaining buffer content
            if (buffer.Length > 0)
            {
                // Page approximation: every 3000 characters ≈ one page
                var pageNumber = totalCharsProcessed / 3000 + 1;
                foreach (var chunkText in ChunkText(buffer.ToString()))
                {
                    chunks.Add(new DocumentChunk
                    {
                        Id = Guid.NewGuid(),
                        DocumentId = document.Id,
                        Content = chunkText,
                        PageNumber = pageNumber,
                        SectionHeading = currentHeading,
                        ChunkIndex = chunkIndex++,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            logger.LogDebug("DOCX {DocumentId}: processed {ParagraphCount} paragraphs into {ChunkCount} chunks",
                document.Id, paragraphCount, chunks.Count);
        }
        catch (InvalidOperationException)
        {
            throw; // Explicit structural check — not an OpenXml parsing failure
        }
        catch (Exception ex)
        {
            await documentRepository.UpdateDocumentStatusAsync(document.Id, "Failed");
            logger.LogError(ex, "DOCX parsing failed for document {DocumentId}: {Message}", document.Id, ex.Message);
            throw new InvalidOperationException($"Failed to parse DOCX document {document.Id}: {ex.Message}", ex);
        }

        return chunks;
    }

    private static List<string> ChunkText(string text, int maxChunkSize = 800)
    {
        var chunks = new List<string>();
        var sentences = SplitIntoSentences(text);
        var current = new StringBuilder();

        foreach (var sentence in sentences)
        {
            if (sentence.Length > maxChunkSize)
            {
                if (current.Length > 0)
                {
                    AddChunk(chunks, current.ToString().Trim());
                    current.Clear();
                }
                SplitLongSentence(chunks, sentence, maxChunkSize);
                continue;
            }

            if (current.Length > 0 && current.Length + 1 + sentence.Length > maxChunkSize)
            {
                AddChunk(chunks, current.ToString().Trim());
                current.Clear();
            }

            if (current.Length > 0)
                current.Append(' ');
            current.Append(sentence);
        }

        if (current.Length > 0)
            AddChunk(chunks, current.ToString().Trim());

        return chunks;
    }

    private static void SplitLongSentence(List<string> chunks, string sentence, int maxChunkSize)
    {
        var pos = 0;
        while (pos < sentence.Length)
        {
            var end = Math.Min(pos + maxChunkSize, sentence.Length);
            if (end < sentence.Length)
            {
                var ws = sentence.LastIndexOf(' ', end - 1);
                if (ws > pos) end = ws;
            }
            AddChunk(chunks, sentence[pos..end].Trim());
            pos = end;
            while (pos < sentence.Length && sentence[pos] == ' ') pos++;
        }
    }

    private static void AddChunk(List<string> chunks, string text)
    {
        if (text.Length >= 50)
            chunks.Add(text);
    }

    private static List<string> SplitIntoSentences(string text)
    {
        var sentences = new List<string>();
        var start = 0;
        for (var i = 0; i < text.Length; i++)
        {
            if (i + 1 < text.Length
                && text[i + 1] == ' '
                && (text[i] == '.' || text[i] == '!' || text[i] == '?'))
            {
                var s = text[start..(i + 1)].Trim();
                if (s.Length > 0) sentences.Add(s);
                start = i + 2;
            }
        }
        if (start < text.Length)
        {
            var remaining = text[start..].Trim();
            if (remaining.Length > 0) sentences.Add(remaining);
        }
        return sentences;
    }
}
