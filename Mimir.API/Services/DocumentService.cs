using Mimir.API.Data.Repositories;
using Mimir.API.Models.Domain;
using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

public class DocumentService(
    IDocumentRepository documentRepository,
    IConfiguration configuration,
    ILogger<DocumentService> logger) : IDocumentService
{
    public async Task<DocumentResponse> UploadDocumentAsync(IFormFile file, string? regulationType)
    {
        if (file is null || file.Length == 0)
            throw new ArgumentException("No file provided or file is empty");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowedTypes = configuration.GetSection("Uploads:AllowedTypes").Get<string[]>() ?? [".pdf", ".docx"];
        if (!allowedTypes.Contains(extension))
            throw new ArgumentException($"File type {extension} is not allowed. Accepted types: .pdf, .docx");

        var maxFileSizeMB = configuration.GetValue<int>("Uploads:MaxFileSizeMB", 20);
        var maxFileSizeBytes = (long)maxFileSizeMB * 1024 * 1024;
        if (file.Length > maxFileSizeBytes)
            throw new ArgumentException($"File size exceeds the maximum allowed size of {maxFileSizeMB}MB");

        var uploadDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Uploads");
        Directory.CreateDirectory(uploadDirectory);

        var storedFileName = $"{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(uploadDirectory, storedFileName);

        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var document = new Document
        {
            Id = Guid.NewGuid(),
            FileName = storedFileName,
            OriginalFileName = file.FileName,
            FilePath = filePath,
            FileSizeBytes = file.Length,
            MimeType = file.ContentType,
            Status = "Pending",
            RegulationType = regulationType,
            UploadedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var persisted = await documentRepository.CreateDocumentAsync(document);
        logger.LogInformation(
            "Document uploaded: {OriginalFileName} → {FileName}, size: {FileSizeBytes} bytes",
            persisted.OriginalFileName, persisted.FileName, persisted.FileSizeBytes);

        return MapToResponse(persisted);
    }

    public async Task<DocumentResponse> GetDocumentAsync(Guid documentId)
    {
        var document = await documentRepository.GetDocumentAsync(documentId)
            ?? throw new KeyNotFoundException($"Document {documentId} not found");

        return MapToResponse(document);
    }

    private static DocumentResponse MapToResponse(Document document) => new()
    {
        Id = document.Id,
        OriginalFileName = document.OriginalFileName,
        Status = document.Status,
        RegulationType = document.RegulationType,
        UploadedAt = document.UploadedAt
    };
}
