namespace Mimir.API.Models.Domain.Hierarchy;

public class DepartmentOrganizationLevel
{
    public Guid DepartmentId { get; set; }
    public Guid OrganizationLevelId { get; set; }

    public Department Department { get; set; } = null!;
    public OrganizationLevel OrganizationLevel { get; set; } = null!;
}
