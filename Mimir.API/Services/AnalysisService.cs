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
        string regulationType)
    {
        var chunks = await documentRepository.GetChunksAsync(documentId);
        if (chunks.Count == 0)
            throw new InvalidOperationException(
                $"Document {documentId} has no parsed chunks. Run parsing before analysis.");

        var document = await documentRepository.GetDocumentAsync(documentId);

        var promptPath = Path.Combine(AppContext.BaseDirectory, "Prompts", "ExtractRequirements.txt");
        var systemPrompt = await File.ReadAllTextAsync(promptPath);

        var userPrompt = $"""
            Regulation type: {regulationType}

            Document: {document?.OriginalFileName ?? documentId.ToString()}

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

        var outline = await GenerateOutlineAsync(requirementStrings, documentId, regulationType);

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
        string regulationType)
    {
        var promptPath = Path.Combine(AppContext.BaseDirectory, "Prompts", "GenerateOutline.txt");
        var systemPrompt = await File.ReadAllTextAsync(promptPath);

        var requirementsList = string.Join("\n", requirements);
        var userPrompt = $"""
            Document ID: {documentId}
            Regulation type: {regulationType}

            Extracted requirements:
            {requirementsList}
            """;

        var rawJson = await CallGeminiAsync(systemPrompt, userPrompt);
        var outline = ParseOutlineJson(rawJson, documentId);

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

    public async Task<TrainingOutlineResponse> CustomizeOutlineForRoleAsync(
        string genericOutlineJson,
        string roleName,
        Dictionary<string, string> riskProfile)
    {
        logger.LogInformation(
            "Customizing outline for role {RoleName} with risk profile AML={AmlRisk}",
            roleName, riskProfile.GetValueOrDefault("AmlRisk", "Medium"));

        var rawJson = await CallGeminiAsync(BuildCustomizationPrompt(genericOutlineJson, roleName, riskProfile), "");

        var customized = ParseOutlineJson(rawJson, Guid.Empty);
        customized.RoleName = roleName;
        customized.RiskProfile = riskProfile;
        return customized;
    }

    private string BuildCustomizationPrompt(
        string genericOutlineJson,
        string roleName,
        Dictionary<string, string> riskProfile)
    {
        var riskSummary = string.Join(", ", riskProfile.Select(kv => $"{kv.Key}={kv.Value}"));
        var highRiskAreas = riskProfile
            .Where(kv => kv.Value == "High")
            .Select(kv => kv.Key)
            .ToList();
        var moduleCount = highRiskAreas.Count >= 3 ? "7-8" :
                          highRiskAreas.Count >= 1 ? "5-6" : "3-4";
        var highRiskAreasText = highRiskAreas.Count > 0 ? string.Join(", ", highRiskAreas) : "None";
        var amlRisk = riskProfile.GetValueOrDefault("AmlRisk", "Medium");
        var sanctionsRisk = riskProfile.GetValueOrDefault("SanctionsRisk", "Medium");
        var fraudRisk = riskProfile.GetValueOrDefault("FraudRisk", "Medium");
        var documentationRisk = riskProfile.GetValueOrDefault("DocumentationRisk", "Medium");
        var operationalRisk = riskProfile.GetValueOrDefault("OperationalRisk", "Medium");
        var generatedAt = DateTime.UtcNow.ToString("O");

        // $$""" raw string: { and } are literal; {{expr}} is interpolation
        return $$"""
            You are an expert compliance training designer specializing in AMLR 2024/1624.

            You have been given a generic AMLR training outline. Your task is to customize
            it specifically for the {{roleName}} role.

            ROLE CONTEXT:
            - Role: {{roleName}}
            - Risk Profile: {{riskSummary}}
            - High Risk Areas: {{highRiskAreasText}}

            CUSTOMIZATION INSTRUCTIONS:
            - Target module count: {{moduleCount}} modules
            - For HIGH risk areas: expand content, add more learning objectives (5-6 per module),
              add role-specific scenarios and examples
            - For MEDIUM risk areas: keep standard depth (3-4 learning objectives per module)
            - For LOW risk areas: reduce to awareness-level only (2-3 learning objectives)
            - Rename module titles to reflect the {{roleName}} role specifically
              (e.g. "EDD Case Handling for KYC Analysts" not generic "Customer Due Diligence")
            - Update descriptions to reference the role's actual day-to-day responsibilities
            - Keep all AMLR article citations and regulatory basis intact
            - Do NOT invent new regulatory requirements — only customize depth and framing

            GENERIC OUTLINE TO CUSTOMIZE:
            {{genericOutlineJson}}

            Return ONLY valid JSON matching exactly this structure:
            {
              "documentId": "00000000-0000-0000-0000-000000000000",
              "regulationType": "AMLR 2024/1624",
              "roleName": "{{roleName}}",
              "riskProfile": {
                "amlRisk": "{{amlRisk}}",
                "sanctionsRisk": "{{sanctionsRisk}}",
                "fraudRisk": "{{fraudRisk}}",
                "documentationRisk": "{{documentationRisk}}",
                "operationalRisk": "{{operationalRisk}}"
              },
              "generatedAt": "{{generatedAt}}",
              "sections": [
                {
                  "title": "string",
                  "description": "string",
                  "learningObjectives": ["string"],
                  "regulatoryBasis": {
                    "amlrArticle": "string",
                    "articleTitle": "string"
                  },
                  "citations": [
                    {
                      "text": "string",
                      "sourceDocument": "string",
                      "pageNumber": 0,
                      "section": "string",
                      "chunkId": "string"
                    }
                  ]
                }
              ]
            }

            Return ONLY the JSON. No markdown fences. No explanation.
            """;
    }

    private TrainingOutlineResponse ParseOutlineJson(string rawJson, Guid documentId)
    {
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
