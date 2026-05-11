namespace Mimir.API.Models.Responses;

public class DocumentResponse
{
    public Guid Id { get; set; }
    public required string OriginalFileName { get; set; }
    public required string Status { get; set; }
    public string? RegulationType { get; set; }
    public DateTime UploadedAt { get; set; }
}
