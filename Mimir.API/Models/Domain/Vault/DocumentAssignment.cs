using Mimir.API.Models.Domain;

namespace Mimir.API.Models.Domain.Vault;

// TODO: TargetType + TargetId is a polymorphic reference pattern.
// EF Core cannot enforce a typed FK across three entity types,
// so referential integrity is enforced in the service layer instead.
public class DocumentAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentId { get; set; }
    public required string TargetType { get; set; }
    public Guid TargetId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    public Document Document { get; set; } = null!;
}
