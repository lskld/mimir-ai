namespace Mimir.API.Models.Domain;

public class DocumentChunk
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentId { get; set; }
    public required string Content { get; set; }
    public int PageNumber { get; set; }
    public string? SectionHeading { get; set; }
    public int ChunkIndex { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Document Document { get; set; } = null!;
}
