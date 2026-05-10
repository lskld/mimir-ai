namespace Mimir.API.Models.Responses;

public class CitationResponse
{
    public required string Text { get; set; }
    public required string SourceDocument { get; set; }
    public int PageNumber { get; set; }
    public required string Section { get; set; }
    public Guid ChunkId { get; set; }
}
