using System.Diagnostics;
using System.Text.Json;
using Mimir.API.Data.Repositories;
using Mimir.API.Models.Domain;
using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

public class FullTrainingProgramService(
    IHierarchyRepository hierarchyRepository,
    ITrainingRepository trainingRepository,
    IFullTrainingProgramRepository fullProgramRepository,
    ILlmService llmService,
    ILogger<FullTrainingProgramService> logger) : IFullTrainingProgramService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<FullTrainingProgramResponse> GenerateFullProgramAsync(Guid roleId)
    {
        // Step 1: Load role and validate it exists
        var role = await hierarchyRepository.GetRoleAsync(roleId);
        if (role is null)
        {
            logger.LogError("Role {RoleId} not found when starting full program generation", roleId);
            throw new KeyNotFoundException($"Role {roleId} not found");
        }

        // Step 2: Load the approved role training outline
        var approvedOutline = await trainingRepository.GetTrainingOutlineAsync(roleId);
        if (approvedOutline is null || approvedOutline.Status != "Approved")
        {
            logger.LogError(
                "No approved outline found for role {RoleName} ({RoleId}). Current status: {Status}",
                role.Name, roleId, approvedOutline?.Status ?? "none");
            throw new InvalidOperationException(
                $"Role {role.Name} does not have an approved training outline. Approve the outline before generating the full program.");
        }

        var outline = JsonSerializer.Deserialize<TrainingOutlineResponse>(approvedOutline.RawJson!, JsonOptions)
            ?? throw new InvalidOperationException($"Failed to deserialize approved outline for role {role.Name}.");

        var roleRiskProfile = new Dictionary<string, string>
        {
            { "AmlRisk", role.AmlRisk },
            { "SanctionsRisk", role.SanctionsRisk },
            { "FraudRisk", role.FraudRisk },
            { "DocumentationRisk", role.DocumentationRisk },
            { "OperationalRisk", role.OperationalRisk }
        };

        logger.LogInformation(
            "Starting full program generation for role {RoleName} ({RoleId}): {ModuleCount} modules",
            role.Name, roleId, outline.Sections.Count);

        // Persist "Generating" status immediately so the status endpoint reflects progress
        var programRecord = await fullProgramRepository.SaveOrUpdateAsync(new FullTrainingProgram
        {
            RoleId = roleId,
            RoleName = role.Name,
            Status = "Generating"
        });

        try
        {
            var elapsed = Stopwatch.StartNew();
            var modules = new List<FullTrainingModuleResponse>();

            // Step 3: For each module (section) in the outline, generate lesson content
            foreach (var section in outline.Sections)
            {
                logger.LogInformation(
                    "Processing module '{ModuleTitle}' for role {RoleName}",
                    section.Title, role.Name);

                var objectives = new List<LessonObjectiveResponse>();

                // Step 3a: For each learning objective, generate lesson text + quiz questions
                foreach (var objectiveText in section.LearningObjectives)
                {
                    var lessonContent = await GenerateLessonContentAsync(
                        objectiveText,
                        section.Title,
                        section.RegulatoryBasis?.AmlrArticle,
                        role.Name,
                        roleRiskProfile);

                    var quizQuestions = await GenerateQuizQuestionsAsync(
                        objectiveText,
                        section.RegulatoryBasis?.AmlrArticle,
                        role.Name);

                    objectives.Add(new LessonObjectiveResponse
                    {
                        Objective = objectiveText,
                        LessonContent = lessonContent,
                        QuizQuestions = quizQuestions
                    });
                }

                // Step 3b: Generate 1-2 role-specific scenarios per module
                var scenarios = await GenerateScenariosAsync(
                    section.Title,
                    section.RegulatoryBasis?.AmlrArticle,
                    role.Name,
                    roleRiskProfile);

                modules.Add(new FullTrainingModuleResponse
                {
                    ModuleTitle = section.Title,
                    AmlrArticle = section.RegulatoryBasis?.AmlrArticle,
                    Description = section.Description,
                    Objectives = objectives,
                    Scenarios = scenarios
                });
            }

            // Step 4: Compile into FullTrainingProgramResponse
            var program = new FullTrainingProgramResponse
            {
                RoleId = roleId,
                RoleName = role.Name,
                RegulationType = outline.RegulationType,
                RiskProfile = roleRiskProfile,
                Modules = modules,
                GeneratedAt = DateTime.UtcNow
            };

            // Step 5: Serialize and persist
            var rawJson = JsonSerializer.Serialize(program);
            await fullProgramRepository.UpdateStatusAsync(
                programRecord.Id,
                "Ready",
                rawJson: rawJson,
                completedAt: DateTime.UtcNow);

            elapsed.Stop();
            logger.LogInformation(
                "Full program generation complete for role {RoleName}: {ModuleCount} modules, {ObjectiveCount} objectives in {Elapsed:F1}s",
                role.Name, modules.Count,
                modules.Sum(m => m.Objectives.Count),
                elapsed.Elapsed.TotalSeconds);

            return program;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Full program generation failed for role {RoleId}", roleId);
            await fullProgramRepository.UpdateStatusAsync(
                programRecord.Id, "Failed", errorMessage: ex.Message);
            throw;
        }
    }

    // TODO: Implement in Step 32 (endpoint calls service directly)
    public Task<string> GetFullProgramStatusAsync(Guid roleId) =>
        throw new NotImplementedException("Implemented in Step 32");

    // TODO: Implement in Step 32 (endpoint calls service directly)
    public Task<FullTrainingProgramResponse?> GetFullProgramAsync(Guid roleId) =>
        throw new NotImplementedException("Implemented in Step 32");

    // TODO: Implement in Step 31 (delegated to ScormPackageService)
    public Task<byte[]> ExportScormAsync(Guid roleId) =>
        throw new NotImplementedException("Implemented in Step 31");

    private async Task<string> GenerateLessonContentAsync(
        string objective,
        string moduleTitle,
        string? amlrArticle,
        string roleName,
        Dictionary<string, string> riskProfile)
    {
        var sw = Stopwatch.StartNew();
        var promptPath = Path.Combine(AppContext.BaseDirectory, "Prompts", "GenerateLessonContent.txt");
        var systemPrompt = await File.ReadAllTextAsync(promptPath);

        var riskSummary = string.Join(", ", riskProfile.Select(kv => $"{kv.Key}: {kv.Value}"));
        var userPrompt = $"""
            Module: {moduleTitle}
            Learning Objective: {objective}
            AMLR Article: {amlrArticle ?? "Not specified"}
            Role: {roleName}
            Risk Profile: {riskSummary}
            """;

        var result = await llmService.CallLlmAsync(systemPrompt + "\n\n" + userPrompt);
        sw.Stop();

        logger.LogInformation(
            "GenerateLessonContent complete for objective '{Objective}' in {Elapsed:F1}s",
            objective, sw.Elapsed.TotalSeconds);

        return result.Trim();
    }

    private async Task<List<QuizQuestionResponse>> GenerateQuizQuestionsAsync(
        string objective,
        string? amlrArticle,
        string roleName)
    {
        var sw = Stopwatch.StartNew();
        var promptPath = Path.Combine(AppContext.BaseDirectory, "Prompts", "GenerateQuizQuestions.txt");
        var systemPrompt = await File.ReadAllTextAsync(promptPath);

        var userPrompt = $"""
            Learning Objective: {objective}
            AMLR Article: {amlrArticle ?? "Not specified"}
            Role: {roleName}
            """;

        var rawJson = await llmService.CallLlmAsync(systemPrompt + "\n\n" + userPrompt);
        sw.Stop();

        var cleanJson = StripMarkdownFences(rawJson);
        List<QuizQuestionResponse>? questions;
        try
        {
            questions = JsonSerializer.Deserialize<List<QuizQuestionResponse>>(cleanJson, JsonOptions);
        }
        catch (JsonException)
        {
            logger.LogWarning(
                "Failed to parse quiz questions JSON for objective '{Objective}' — returning empty list. Raw: {Raw}",
                objective, rawJson);
            return [];
        }

        logger.LogInformation(
            "GenerateQuizQuestions complete: {Count} questions for objective '{Objective}' in {Elapsed:F1}s",
            questions?.Count ?? 0, objective, sw.Elapsed.TotalSeconds);

        return questions ?? [];
    }

    private async Task<List<ScenarioResponse>> GenerateScenariosAsync(
        string moduleTopic,
        string? amlrArticle,
        string roleName,
        Dictionary<string, string> riskProfile)
    {
        var sw = Stopwatch.StartNew();
        var promptPath = Path.Combine(AppContext.BaseDirectory, "Prompts", "GenerateScenarios.txt");
        var systemPrompt = await File.ReadAllTextAsync(promptPath);

        var riskSummary = string.Join(", ", riskProfile.Select(kv => $"{kv.Key}: {kv.Value}"));
        var userPrompt = $"""
            Module Topic: {moduleTopic}
            AMLR Article: {amlrArticle ?? "Not specified"}
            Role: {roleName}
            Risk Profile: {riskSummary}
            """;

        var rawJson = await llmService.CallLlmAsync(systemPrompt + "\n\n" + userPrompt);
        sw.Stop();

        var cleanJson = StripMarkdownFences(rawJson);
        List<ScenarioResponse>? scenarios;
        try
        {
            scenarios = JsonSerializer.Deserialize<List<ScenarioResponse>>(cleanJson, JsonOptions);
        }
        catch (JsonException)
        {
            logger.LogWarning(
                "Failed to parse scenarios JSON for module '{ModuleTopic}' — returning empty list. Raw: {Raw}",
                moduleTopic, rawJson);
            return [];
        }

        logger.LogInformation(
            "GenerateScenarios complete: {Count} scenarios for module '{ModuleTopic}' in {Elapsed:F1}s",
            scenarios?.Count ?? 0, moduleTopic, sw.Elapsed.TotalSeconds);

        return scenarios ?? [];
    }

    private static string StripMarkdownFences(string raw)
    {
        var clean = raw.Trim();
        if (clean.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            clean = clean["```json".Length..].TrimStart();
        else if (clean.StartsWith("```"))
            clean = clean["```".Length..].TrimStart();
        if (clean.EndsWith("```"))
            clean = clean[..^3].TrimEnd();
        return clean;
    }
}
