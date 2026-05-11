namespace Mimir.API.Models.Requests.Hierarchy;

public class CreateDepartmentRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public List<Guid> OrganizationLevelIds { get; set; } = [];
}
