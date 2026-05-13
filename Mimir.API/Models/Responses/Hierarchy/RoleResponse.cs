namespace Mimir.API.Models.Responses.Hierarchy;

public class RoleResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public required string Status { get; set; }
    public required string AmlRisk { get; set; }
    public required string SanctionsRisk { get; set; }
    public required string FraudRisk { get; set; }
    public required string DocumentationRisk { get; set; }
    public required string OperationalRisk { get; set; }
    public List<DepartmentResponse> Departments { get; set; } = [];
}
