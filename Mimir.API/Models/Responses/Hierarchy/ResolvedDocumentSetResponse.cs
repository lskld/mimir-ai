namespace Mimir.API.Models.Responses.Hierarchy;

public class ResolvedDocumentSetResponse
{
    public Guid RoleId { get; set; }
    public required string RoleName { get; set; }
    public List<ResolvedDocumentResponse> Documents { get; set; } = [];
}
