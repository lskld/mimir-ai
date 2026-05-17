namespace Mimir.API.Models.Responses;

public class QuizQuestionResponse
{
    public required string Text { get; set; }
    public Dictionary<string, string> Options { get; set; } = []; // A, B, C, D → text
    public required string CorrectAnswer { get; set; } // "A" | "B" | "C" | "D"
    public required string Explanation { get; set; }
}
