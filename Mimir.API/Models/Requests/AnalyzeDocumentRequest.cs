namespace Mimir.API.Models.Requests;

public class AnalyzeDocumentRequest
{
    public Guid DocumentId { get; set; }
    public required string RegulationType { get; set; }
}
