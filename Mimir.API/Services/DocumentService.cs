using Mimir.API.Data.Repositories;
using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

public class DocumentService(
    IDocumentRepository documentRepository,
    ILogger<DocumentService> logger) : IDocumentService
{
    public async Task<DocumentResponse> UploadDocumentAsync(IFormFile file, string? regulationType)
    {
        _ = (documentRepository, logger);
        // TODO: validate file type — accept .pdf and .docx only
        // TODO: validate file size — reject over 20MB
        // TODO: save file to Uploads/ using a new Guid as the stored filename
        // TODO: create Document record with Status = Pending and all metadata fields
        // TODO: call documentRepository.CreateDocumentAsync() and map to DocumentResponse
        await Task.CompletedTask;
        throw new NotImplementedException();
    }

    public async Task<DocumentResponse> GetDocumentAsync(Guid documentId)
    {
        // TODO: call documentRepository.GetDocumentAsync(documentId)
        // TODO: throw KeyNotFoundException if result is null
        // TODO: map Document entity to DocumentResponse and return
        await Task.CompletedTask;
        throw new NotImplementedException();
    }
}
