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

    // TODO (Step 29): Call Gemini with GenerateLessonContent.txt prompt.
    // Input: learning objective, module title, AMLR article reference, role name, risk profile.
    // Output: 2-3 paragraphs of instructional text (plain text, no markdown).
    private Task<string> GenerateLessonContentAsync(
        string objective,
        string moduleTitle,
        string? amlrArticle,
        string roleName,
        Dictionary<string, string> riskProfile)
    {
        logger.LogDebug(
            "GenerateLessonContent stub called for objective '{Objective}' in module '{ModuleTitle}'",
            objective, moduleTitle);
        return Task.FromResult(string.Empty);
    }

    // TODO (Step 29): Call Gemini with GenerateQuizQuestions.txt prompt.
    // Input: learning objective, AMLR article, role name.
    // Output: JSON array of 3-5 multiple-choice questions with A/B/C/D options, correct answer, explanation.
    private Task<List<QuizQuestionResponse>> GenerateQuizQuestionsAsync(
        string objective,
        string? amlrArticle,
        string roleName)
    {
        logger.LogDebug(
            "GenerateQuizQuestions stub called for objective '{Objective}'", objective);
        return Task.FromResult(new List<QuizQuestionResponse>());
    }

    // TODO (Step 29): Call Gemini with GenerateScenarios.txt prompt.
    // Input: module topic, AMLR article, role name, risk profile.
    // Output: JSON array of 1-2 case-study scenarios with title, description, complication, discussion questions.
    private Task<List<ScenarioResponse>> GenerateScenariosAsync(
        string moduleTopic,
        string? amlrArticle,
        string roleName,
        Dictionary<string, string> riskProfile)
    {
        logger.LogDebug(
            "GenerateScenarios stub called for module '{ModuleTopic}'", moduleTopic);
        return Task.FromResult(new List<ScenarioResponse>());
    }
}
