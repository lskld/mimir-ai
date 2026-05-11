namespace Mimir.API.Models.Domain.Hierarchy;

public class RoleDepartment
{
    public Guid RoleId { get; set; }
    public Guid DepartmentId { get; set; }

    public Role Role { get; set; } = null!;
    public Department Department { get; set; } = null!;
}
