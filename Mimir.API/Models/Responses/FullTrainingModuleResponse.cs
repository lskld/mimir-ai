namespace Mimir.API.Models.Responses;

public class FullTrainingModuleResponse
{
    public required string ModuleTitle { get; set; }
    public string? AmlrArticle { get; set; }
    public string? Description { get; set; }
    public List<LessonObjectiveResponse> Objectives { get; set; } = [];
    public List<ScenarioResponse> Scenarios { get; set; } = [];
}
