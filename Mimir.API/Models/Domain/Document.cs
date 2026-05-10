using Mimir.API.Models.Domain.Vault;

namespace Mimir.API.Models.Domain;

public class Document
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string FileName { get; set; }
    public required string OriginalFileName { get; set; }
    public required string FilePath { get; set; }
    public long FileSizeBytes { get; set; }
    public required string MimeType { get; set; }
    public required string Status { get; set; }
    public string? RegulationType { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<DocumentChunk> Chunks { get; set; } = [];
    public ICollection<DocumentAssignment> Assignments { get; set; } = [];
}
