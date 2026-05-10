namespace Mimir.API.Models.Requests.Hierarchy;

public class CreateOrganizationLevelRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public string? Geography { get; set; }
}
