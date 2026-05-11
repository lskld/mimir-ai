namespace Mimir.API.Models.Requests.Hierarchy;

public class CreateRoleRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public List<Guid> DepartmentIds { get; set; } = [];
}
