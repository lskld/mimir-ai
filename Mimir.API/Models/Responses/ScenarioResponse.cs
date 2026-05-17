namespace Mimir.API.Models.Responses;

public class ScenarioResponse
{
    public required string Title { get; set; }
    public required string Description { get; set; }
    public required string Complication { get; set; }
    public List<string> DiscussionQuestions { get; set; } = [];
}
