namespace Mimir.API.Models.Responses;

public class OutlineSectionResponse
{
    public required string Title { get; set; }
    public required string Description { get; set; }
    public List<string> LearningObjectives { get; set; } = [];
    public RegulatoryBasisResponse? RegulatoryBasis { get; set; }
    public List<CitationResponse> Citations { get; set; } = [];
}
