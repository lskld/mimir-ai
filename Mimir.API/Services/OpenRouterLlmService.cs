using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Mimir.API.Services;

public class OpenRouterLlmService(
    IConfiguration configuration,
    HttpClient httpClient,
    ILogger<OpenRouterLlmService> logger) : ILlmService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public async Task<string> CallLlmAsync(string prompt)
    {
        var apiKey = configuration["OpenRouter:ApiKey"];
        var model = configuration["OpenRouter:Model"];
        var baseUrl = configuration["OpenRouter:BaseUrl"];

        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("OpenRouter:ApiKey is not configured.");
        if (string.IsNullOrWhiteSpace(model))
            throw new InvalidOperationException("OpenRouter:Model is not configured.");
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("OpenRouter:BaseUrl is not configured.");

        var requestBody = new ChatCompletionRequest(
            Model: model,
            Messages: [new ChatMessage("user", prompt)],
            // AMLR requirement extraction can produce 50+ items at ~200 tokens each.
            // Gemini 2.5 Flash supports up to ~65k output tokens; 16k is safe for our prompts.
            MaxTokens: 16000,
            Temperature: 0.7);

        var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl.TrimEnd('/')}/chat/completions");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = new StringContent(
            JsonSerializer.Serialize(requestBody, JsonOptions),
            Encoding.UTF8,
            "application/json");

        logger.LogDebug(
            "LLM request: model={Model}, prompt length={PromptLength} chars",
            model, prompt.Length);

        var sw = Stopwatch.StartNew();
        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(request);
        }
        catch (HttpRequestException ex) when (ex.InnerException is TimeoutException)
        {
            logger.LogError(ex, "LLM call timed out");
            throw new InvalidOperationException("LLM call timed out — please try again.", ex);
        }
        catch (TaskCanceledException ex)
        {
            logger.LogError(ex, "LLM call timed out (TaskCanceled)");
            throw new InvalidOperationException("LLM call timed out — please try again.", ex);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "LLM call network failure: {Message}", ex.Message);
            throw new InvalidOperationException($"LLM call failed: {ex.Message}", ex);
        }

        var responseBody = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            sw.Stop();
            var message = response.StatusCode switch
            {
                HttpStatusCode.Unauthorized => "LLM authentication failed — check API key.",
                HttpStatusCode.TooManyRequests => "Rate limited — please try again later.",
                >= HttpStatusCode.InternalServerError => "LLM service error — please try again.",
                _ => $"LLM API returned {(int)response.StatusCode} {response.StatusCode}."
            };

            logger.LogError(
                "LLM call failed: status={Status}, body={Body}",
                (int)response.StatusCode, Truncate(responseBody, 500));

            throw new InvalidOperationException(message);
        }

        ChatCompletionResponse? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<ChatCompletionResponse>(responseBody, JsonOptions);
        }
        catch (JsonException ex)
        {
            sw.Stop();
            logger.LogError(ex, "Failed to parse LLM response: {Body}", Truncate(responseBody, 500));
            throw new InvalidOperationException("Failed to parse LLM response.", ex);
        }

        sw.Stop();

        var choice = parsed?.Choices?.FirstOrDefault();
        var content = choice?.Message?.Content;
        if (string.IsNullOrEmpty(content))
        {
            logger.LogError("LLM returned empty content. Raw body: {Body}", Truncate(responseBody, 500));
            throw new InvalidOperationException("LLM returned an empty response.");
        }

        var prompt_tokens = parsed?.Usage?.PromptTokens ?? 0;
        var completion_tokens = parsed?.Usage?.CompletionTokens ?? 0;

        // OpenAI/OpenRouter convention: "stop" = clean finish, "length" = hit max_tokens.
        // Surface truncation loudly so it doesn't look like a parse bug to the caller.
        if (string.Equals(choice?.FinishReason, "length", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogError(
                "LLM response was truncated (finish_reason=length). Tokens used: {CompletionTokens}. Increase max_tokens.",
                completion_tokens);
            throw new InvalidOperationException(
                $"LLM response was truncated at {completion_tokens} tokens (finish_reason=length). " +
                "Increase max_tokens or shorten the input.");
        }

        logger.LogInformation(
            "LLM call completed in {ElapsedMs}ms, tokens: {PromptTokens}/{CompletionTokens}, finish: {FinishReason}, response: {ResponseLength} chars",
            sw.ElapsedMilliseconds, prompt_tokens, completion_tokens, choice?.FinishReason ?? "?", content.Length);

        return content;
    }

    private static string Truncate(string s, int max) =>
        s.Length <= max ? s : s[..max] + "…";

    // ─── OpenAI-compatible request/response shapes ───────────────────────────

    private sealed record ChatCompletionRequest(
        string Model,
        IReadOnlyList<ChatMessage> Messages,
        int MaxTokens,
        double Temperature);

    private sealed record ChatMessage(string Role, string Content);

    private sealed record ChatCompletionResponse(
        IReadOnlyList<Choice>? Choices,
        UsageInfo? Usage);

    private sealed record Choice(ChatMessage? Message, string? FinishReason);

    private sealed record UsageInfo(int PromptTokens, int CompletionTokens);
}
