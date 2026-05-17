namespace Mimir.API.Services;

public interface ILlmService
{
    /// <summary>
    /// Calls the configured LLM (via OpenRouter) with the given prompt.
    /// Returns the model's response as plain text — no JSON parsing, no markdown stripping.
    /// </summary>
    Task<string> CallLlmAsync(string prompt);
}
