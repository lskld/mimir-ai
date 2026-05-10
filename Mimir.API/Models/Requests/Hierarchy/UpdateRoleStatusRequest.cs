namespace Mimir.API.Models.Requests.Hierarchy;

public class UpdateRoleStatusRequest
{
    public Guid RoleId { get; set; }
    public required string Status { get; set; }
}
