namespace Mimir.API.Models.Domain;

public class RoleTrainingOutline
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RoleId { get; set; }
    public required string RegulationType { get; set; }
    public string? RawJson { get; set; } // null while Status is "Generating"
    public required string Status { get; set; } // Generating | Draft | Approved | Failed
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedAt { get; set; }
}
