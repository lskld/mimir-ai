namespace Mimir.API.Models.Responses;

public class LessonObjectiveResponse
{
    public required string Objective { get; set; }
    public string LessonContent { get; set; } = string.Empty;
    public List<QuizQuestionResponse> QuizQuestions { get; set; } = [];
}
