namespace Mimir.API.Models.Responses.Hierarchy;

public class DepartmentResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public List<OrganizationLevelResponse> OrganizationLevels { get; set; } = [];
    public List<RoleResponse> Roles { get; set; } = [];
}
