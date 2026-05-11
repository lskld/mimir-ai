namespace Mimir.API.Models.Responses.Hierarchy;

public class ResolvedDocumentResponse
{
    public Guid DocumentId { get; set; }
    public required string FileName { get; set; }
    public required string InheritedFrom { get; set; }
    public required string InheritedFromName { get; set; }
    public required string TargetType { get; set; }
}
