namespace Mimir.API.Models.Responses.Hierarchy;

public class OrganizationLevelResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public string? Geography { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<DepartmentResponse> Departments { get; set; } = [];
}
