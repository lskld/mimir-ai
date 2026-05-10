namespace Mimir.API.Models.Requests.Hierarchy;

public class AssignDocumentRequest
{
    public Guid DocumentId { get; set; }
    public required string TargetType { get; set; }
    public Guid TargetId { get; set; }
}
