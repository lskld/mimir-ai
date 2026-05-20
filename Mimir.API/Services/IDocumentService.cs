using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

/// <summary>Handles document upload, storage, and retrieval.</summary>
public interface IDocumentService
{
    /// <summary>
    /// Accepts an uploaded file, validates it, saves it to the Uploads directory, and records metadata in the database.
    /// </summary>
    Task<DocumentResponse> UploadDocumentAsync(IFormFile file, string? regulationType);

    /// <summary>Returns the document response for the given id, or throws <see cref="KeyNotFoundException"/> if not found.</summary>
    Task<DocumentResponse> GetDocumentAsync(Guid documentId);

    /// <summary>Returns all documents ordered by upload date descending.</summary>
    Task<List<DocumentResponse>> GetAllDocumentsAsync();
}
