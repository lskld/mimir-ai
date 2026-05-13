namespace Mimir.API.Models.Requests.Hierarchy;

public class CreateRoleRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public List<Guid> DepartmentIds { get; set; } = [];

    public string? AmlRisk { get; set; }
    public string? SanctionsRisk { get; set; }
    public string? FraudRisk { get; set; }
    public string? DocumentationRisk { get; set; }
    public string? OperationalRisk { get; set; }
}
