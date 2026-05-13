using System.Text.Json;
using System.Text.Json.Serialization;
using GenerativeAI;
using Mimir.API.Data.Repositories;
using Mimir.API.Models.Domain;
using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

public class AnalysisService(
    IDocumentRepository documentRepository,
    IOutlineRepository outlineRepository,
    ICitationService citationService,
    IConfiguration configuration,
    ILogger<AnalysisService> logger) : IAnalysisService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private record RequirementItem(
        [property: JsonPropertyName("requirement")] string Requirement,
        [property: JsonPropertyName("context")] string Context,
        [property: JsonPropertyName("priority")] string Priority,
        [property: JsonPropertyName("amlrArticle")] int? AmlrArticle = null);

    public async Task<TrainingOutlineResponse> AnalyzeDocumentAsync(
        Guid documentId,
        string regulationType,
        string? roleName = null,
        Dictionary<string, string>? riskProfile = null)
    {
        var chunks = await documentRepository.GetChunksAsync(documentId);
        if (chunks.Count == 0)
            throw new InvalidOperationException(
                $"Document {documentId} has no parsed chunks. Run parsing before analysis.");

        var document = await documentRepository.GetDocumentAsync(documentId);

        var promptPath = Path.Combine(AppContext.BaseDirectory, "Prompts", "ExtractRequirements.txt");
        var systemPrompt = await File.ReadAllTextAsync(promptPath);

        var roleContext = string.Empty;
        if (!string.IsNullOrWhiteSpace(roleName))
        {
            roleContext = $"""

                TARGET ROLE FOR TRAINING: {roleName}
                Role Risk Profile:
                - AML Risk: {riskProfile?.GetValueOrDefault("AmlRisk", "Medium")}
                - Sanctions Risk: {riskProfile?.GetValueOrDefault("SanctionsRisk", "Medium")}
                - Fraud Risk: {riskProfile?.GetValueOrDefault("FraudRisk", "Medium")}
                - Documentation Risk: {riskProfile?.GetValueOrDefault("DocumentationRisk", "Medium")}
                - Operational Risk: {riskProfile?.GetValueOrDefault("OperationalRisk", "Medium")}

                Calibrate requirement priority based on this role's risk exposure.
                """;
        }

        var userPrompt = $"""
            Regulation type: {regulationType}

            Document: {document?.OriginalFileName ?? documentId.ToString()}
            {roleContext}

            Document content:
            {BuildChunkContext(chunks)}
            """;

        var rawJson = await CallGeminiAsync(systemPrompt, userPrompt);

        var cleanRequirementsJson = rawJson.Trim();
        if (cleanRequirementsJson.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            cleanRequirementsJson = cleanRequirementsJson["```json".Length..].TrimStart();
        else if (cleanRequirementsJson.StartsWith("```"))
            cleanRequirementsJson = cleanRequirementsJson["```".Length..].TrimStart();
        if (cleanRequirementsJson.EndsWith("```"))
            cleanRequirementsJson = cleanRequirementsJson[..^3].TrimEnd();

        List<RequirementItem>? requirements;
        try
        {
            requirements = JsonSerializer.Deserialize<List<RequirementItem>>(cleanRequirementsJson, JsonOptions);
        }
        catch (JsonException)
        {
            logger.LogDebug("Raw requirements output: {RawJson}", rawJson);
            throw new InvalidOperationException(
                $"Failed to parse requirements JSON for document {documentId}. Raw output logged at Debug level.");
        }

        if (requirements is null || requirements.Count == 0)
        {
            logger.LogDebug("Raw requirements output: {RawJson}", rawJson);
            throw new InvalidOperationException(
                $"Failed to parse requirements JSON for document {documentId}. Raw output logged at Debug level.");
        }

        logger.LogInformation("Extracted {Count} requirements from document {DocumentId}",
            requirements.Count, documentId);

        var requirementStrings = requirements
            .Select((r, i) => $"{i + 1}. {r.Requirement} [Context: {r.Context}] [Priority: {r.Priority}]")
            .ToList();

        var outline = await GenerateOutlineAsync(requirementStrings, documentId, regulationType, roleName, riskProfile);

        var rawOutlineJson = JsonSerializer.Serialize(outline);
        var entity = new TrainingOutline
        {
            Id = Guid.NewGuid(),
            DocumentId = documentId,
            RegulationType = regulationType,
            RawJson = rawOutlineJson,
            Status = "Draft",
            CreatedAt = DateTime.UtcNow
        };
        await outlineRepository.SaveOutlineAsync(entity);

        var totalObjectives = outline.Sections.Sum(s => s.LearningObjectives.Count);
        logger.LogInformation(
            "Outline generated and saved for document {DocumentId}: {SectionCount} sections, {TotalObjectives} learning objectives",
            documentId, outline.Sections.Count, totalObjectives);

        return outline;
    }

    public async Task<TrainingOutlineResponse> GenerateOutlineAsync(
        List<string> requirements,
        Guid documentId,
        string regulationType,
        string? roleName = null,
        Dictionary<string, string>? riskProfile = null)
    {
        var promptPath = Path.Combine(AppContext.BaseDirectory, "Prompts", "GenerateOutline.txt");
        var systemPrompt = await File.ReadAllTextAsync(promptPath);

        // Inject role context into the system prompt template
        if (!string.IsNullOrWhiteSpace(roleName) && riskProfile != null)
        {
            systemPrompt = systemPrompt
                .Replace("{{ROLE_NAME}}", roleName)
                .Replace("{{AML_RISK_LEVEL}}", riskProfile.GetValueOrDefault("AmlRisk", "Medium"))
                .Replace("{{SANCTIONS_RISK_LEVEL}}", riskProfile.GetValueOrDefault("SanctionsRisk", "Medium"))
                .Replace("{{FRAUD_RISK_LEVEL}}", riskProfile.GetValueOrDefault("FraudRisk", "Medium"))
                .Replace("{{DOCUMENTATION_RISK_LEVEL}}", riskProfile.GetValueOrDefault("DocumentationRisk", "Medium"))
                .Replace("{{OPERATIONAL_RISK_LEVEL}}", riskProfile.GetValueOrDefault("OperationalRisk", "Medium"));
        }
        else
        {
            // Generic role for document-level analysis without specific role context
            systemPrompt = systemPrompt
                .Replace("{{ROLE_NAME}}", "General Compliance Role")
                .Replace("{{AML_RISK_LEVEL}}", "Medium")
                .Replace("{{SANCTIONS_RISK_LEVEL}}", "Medium")
                .Replace("{{FRAUD_RISK_LEVEL}}", "Medium")
                .Replace("{{DOCUMENTATION_RISK_LEVEL}}", "Medium")
                .Replace("{{OPERATIONAL_RISK_LEVEL}}", "Medium");
        }

        var requirementsList = string.Join("\n", requirements);
        var userPrompt = $"""
            Document ID: {documentId}
            Regulation type: {regulationType}

            Extracted requirements:
            {requirementsList}
            """;

        var rawJson = await CallGeminiAsync(systemPrompt, userPrompt);

        // Strip accidental markdown fences that some models include despite being asked not to
        var cleanJson = rawJson.Trim();
        if (cleanJson.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            cleanJson = cleanJson["```json".Length..].TrimStart();
        else if (cleanJson.StartsWith("```"))
            cleanJson = cleanJson["```".Length..].TrimStart();
        if (cleanJson.EndsWith("```"))
            cleanJson = cleanJson[..^3].TrimEnd();

        TrainingOutlineResponse? outline;
        try
        {
            outline = JsonSerializer.Deserialize<TrainingOutlineResponse>(cleanJson, JsonOptions);
        }
        catch (JsonException)
        {
            logger.LogDebug("Raw outline output: {RawJson}", rawJson);
            throw new InvalidOperationException(
                $"Failed to parse outline JSON for document {documentId}. Raw output logged at Debug level.");
        }

        if (outline is null)
        {
            logger.LogDebug("Raw outline output: {RawJson}", rawJson);
            throw new InvalidOperationException(
                $"Failed to parse outline JSON for document {documentId}. Raw output logged at Debug level.");
        }

        // Citation mapping — replace LLM-generated citation stubs with matched real chunks.
        // Chunks are loaded here so GenerateOutlineAsync is self-contained when called externally.
        var chunks = await documentRepository.GetChunksAsync(documentId);
        if (chunks.Count > 0)
        {
            foreach (var section in outline.Sections)
            {
                section.Citations = section.Citations
                    .Where(c => !string.IsNullOrWhiteSpace(c.Text))
                    .Select(c =>
                    {
                        var chunk = citationService.MatchClaimToChunk(c.Text, chunks);
                        return citationService.BuildCitation(chunk, c.Text);
                    })
                    .ToList();
            }
        }

        return outline;
    }

    private async Task<string> CallGeminiAsync(string systemPrompt, string userPrompt)
    {
        try
        {
            var apiKey = configuration["Gemini:ApiKey"];
            var modelName = configuration["Gemini:Model"];

            logger.LogDebug("Gemini config - Model: {model}", modelName ?? "[NULL]");
            logger.LogDebug("Gemini config - APIKey: {apiKey}", apiKey ?? "[NULL]");

            var client = new GenerativeModel(apiKey!, modelName!);
            var response = await client.GenerateContentAsync(systemPrompt + "\n\n" + userPrompt);

            var text = response.Text;

            logger.LogDebug("Gemini raw response: {Response}", text);
            return text;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Gemini API call failed: {Message}", ex.Message);
            throw new InvalidOperationException($"Gemini API call failed: {ex.Message}", ex);
        }
    }

    // This is where smarter retrieval (RAG) would go in a production version —
    // selecting only the most relevant chunks instead of truncating naively.
    private static string BuildChunkContext(List<DocumentChunk> chunks)
    {
        const int MaxLength = 12000;
        const string Truncation = "\n[Context truncated — document exceeds context window limit]";

        var sb = new System.Text.StringBuilder();
        foreach (var chunk in chunks)
        {
            sb.AppendLine($"[Page {chunk.PageNumber} | Section: {chunk.SectionHeading ?? "General"}]");
            sb.AppendLine(chunk.Content);
            sb.AppendLine("---");

            if (sb.Length <= MaxLength)
                continue;

            sb.Length = MaxLength;
            sb.Append(Truncation);
            break;
        }
        return sb.ToString();
    }
}
