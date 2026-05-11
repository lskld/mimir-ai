using Mimir.API.Models.Domain;

namespace Mimir.API.Data.Repositories;

/// <summary>Persistence operations for <see cref="Document"/> and <see cref="DocumentChunk"/> entities.</summary>
public interface IDocumentRepository
{
    /// <summary>Persists a new document record and returns the saved entity.</summary>
    Task<Document> CreateDocumentAsync(Document document);

    /// <summary>Returns the document with the given id, or null if not found.</summary>
    Task<Document?> GetDocumentAsync(Guid documentId);

    /// <summary>Updates the status field of the document and returns the updated entity.</summary>
    Task<Document> UpdateDocumentStatusAsync(Guid documentId, string status);

    /// <summary>Bulk-persists a list of document chunks.</summary>
    Task SaveChunksAsync(List<DocumentChunk> chunks);

    /// <summary>Returns all chunks belonging to the given document, ordered by <see cref="DocumentChunk.ChunkIndex"/>.</summary>
    Task<List<DocumentChunk>> GetChunksAsync(Guid documentId);
}
