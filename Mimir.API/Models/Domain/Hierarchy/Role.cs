using Mimir.API.Models.Domain.Vault;

namespace Mimir.API.Models.Domain.Hierarchy;

public class Role
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public string? Description { get; set; }
    public required string Status { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<RoleDepartment> Departments { get; set; } = [];
    public ICollection<DocumentAssignment> DocumentAssignments { get; set; } = [];
}
