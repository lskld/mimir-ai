using Microsoft.EntityFrameworkCore;
using Mimir.API.Models.Domain;

namespace Mimir.API.Data.Repositories;

public class DocumentRepository(AppDbContext context) : IDocumentRepository
{
    public async Task<Document> CreateDocumentAsync(Document document)
    {
        context.Documents.Add(document);
        await context.SaveChangesAsync();
        return document;
    }

    public async Task<Document?> GetDocumentAsync(Guid documentId)
    {
        return await context.Documents
            .Include(d => d.Chunks)
            .FirstOrDefaultAsync(d => d.Id == documentId);
    }

    public async Task<List<Document>> GetAllDocumentsAsync()
    {
        return await context.Documents
            .OrderByDescending(d => d.UploadedAt)
            .ToListAsync();
    }

    public async Task<Document> UpdateDocumentStatusAsync(Guid documentId, string status)
    {
        var document = await context.Documents.FindAsync(documentId)
            ?? throw new KeyNotFoundException($"Document {documentId} not found");

        document.Status = status;
        document.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        return document;
    }

    public async Task SaveChunksAsync(List<DocumentChunk> chunks)
    {
        if (chunks.Count == 0)
            return;

        context.Chunks.AddRange(chunks);
        await context.SaveChangesAsync();
    }

    public async Task<List<DocumentChunk>> GetChunksAsync(Guid documentId)
    {
        return await context.Chunks
            .Where(c => c.DocumentId == documentId)
            .OrderBy(c => c.ChunkIndex)
            .ToListAsync();
    }
}
