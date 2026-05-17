namespace Mimir.API.Models.Domain;

public class FullTrainingProgram
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RoleId { get; set; }
    public required string RoleName { get; set; }
    public required string Status { get; set; } // Pending | Generating | Ready | Failed
    public string? RawJson { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public string? ScormZipPath { get; set; }
}
