namespace Mimir.API.Models.Responses;

public class TrainingOutlineResponse
{
    public Guid DocumentId { get; set; }
    public required string RegulationType { get; set; }
    public string? RoleName { get; set; }
    public Dictionary<string, string>? RiskProfile { get; set; }
    public List<OutlineSectionResponse> Sections { get; set; } = [];
    public DateTime GeneratedAt { get; set; }
}
