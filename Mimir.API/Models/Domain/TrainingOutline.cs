namespace Mimir.API.Models.Domain;

public class TrainingOutline
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentId { get; set; }
    public required string RegulationType { get; set; }
    public required string RawJson { get; set; }
    public required string Status { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Document Document { get; set; } = null!;
}
