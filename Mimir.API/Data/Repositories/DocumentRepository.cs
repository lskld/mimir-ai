using Mimir.API.Models.Domain;

namespace Mimir.API.Data.Repositories;

public class DocumentRepository(AppDbContext context) : IDocumentRepository
{
    public async Task<Document> CreateDocumentAsync(Document document)
    {
        _ = context; // TODO: context.Documents.Add(document); await context.SaveChangesAsync();
        await Task.CompletedTask;
        return document;
    }

    public async Task<Document?> GetDocumentAsync(Guid documentId)
    {
        // TODO: return await context.Documents.FindAsync(documentId);
        await Task.CompletedTask;
        return null;
    }

    public async Task<Document> UpdateDocumentStatusAsync(Guid documentId, string status)
    {
        // TODO: load document, set Status and UpdatedAt, save changes
        await Task.CompletedTask;
        throw new NotImplementedException();
    }

    public async Task SaveChunksAsync(List<DocumentChunk> chunks)
    {
        // TODO: context.Chunks.AddRange(chunks); await context.SaveChangesAsync();
        await Task.CompletedTask;
    }

    public async Task<List<DocumentChunk>> GetChunksAsync(Guid documentId)
    {
        // TODO: return await context.Chunks.Where(c => c.DocumentId == documentId).OrderBy(c => c.ChunkIndex).ToListAsync();
        await Task.CompletedTask;
        return [];
    }
}
