using System.Text.Json;
using Mimir.API.Data.Repositories;
using Mimir.API.Models.Domain;
using Mimir.API.Models.Responses;
using Mimir.API.Pipeline;

namespace Mimir.API.Services;

public class RoleTrainingService(
    IHierarchyRepository hierarchyRepository,
    IDocumentVaultService documentVaultService,
    IOutlineRepository outlineRepository,
    ITrainingRepository trainingRepository,
    IDocumentPipeline documentPipeline,
    IAnalysisService analysisService,
    ILogger<RoleTrainingService> logger) : IRoleTrainingService
{

    public async Task<TrainingOutlineResponse> GenerateTrainingForRoleAsync(Guid roleId)
    {
        // Step 1: Load the role with its risk profile
        var role = await hierarchyRepository.GetRoleAsync(roleId);
        if (role is null)
            throw new KeyNotFoundException($"Role {roleId} not found");

        var roleRiskProfile = new Dictionary<string, string>
        {
            { "AmlRisk", role.AmlRisk },
            { "SanctionsRisk", role.SanctionsRisk },
            { "FraudRisk", role.FraudRisk },
            { "DocumentationRisk", role.DocumentationRisk },
            { "OperationalRisk", role.OperationalRisk }
        };

        logger.LogInformation(
            "Starting training generation for role {RoleName} ({RoleId}) with risk profile: AML={AmlRisk}",
            role.Name, roleId, role.AmlRisk);

        // Create or overwrite the persisted outline record so the status endpoint
        // can return "Generating" while the background task runs.
        var existingRecord = await trainingRepository.GetTrainingOutlineAsync(roleId);
        RoleTrainingOutline outlineRecord;
        if (existingRecord is not null)
        {
            outlineRecord = await trainingRepository.UpdateTrainingStatusAsync(
                existingRecord.Id, "Generating");
        }
        else
        {
            outlineRecord = await trainingRepository.SaveTrainingOutlineAsync(new RoleTrainingOutline
            {
                RoleId = roleId,
                RegulationType = "AMLR 2024/1624",
                Status = "Generating"
            });
        }

        try
        {
            // Step 2: Get the resolved document set for this role
            var resolvedDocuments = await documentVaultService.GetResolvedDocumentSetAsync(roleId);

            TrainingOutlineResponse mergedOutline;
            if (resolvedDocuments.Documents.Count == 0)
            {
                logger.LogWarning("No documents found for role {RoleName} — vault is empty", role.Name);
                mergedOutline = new TrainingOutlineResponse
                {
                    DocumentId = Guid.Empty,
                    RegulationType = "AMLR 2024/1624",
                    RoleName = role.Name,
                    RiskProfile = roleRiskProfile,
                    Sections = [],
                    GeneratedAt = DateTime.UtcNow
                };
            }
            else
            {
                logger.LogInformation(
                    "Resolved {DocumentCount} documents for role {RoleName}",
                    resolvedDocuments.Documents.Count, role.Name);

                // Step 3: For each document, ensure a generic outline exists, then customize for this role
                var allOutlines = new List<TrainingOutlineResponse>();
                foreach (var resolvedDoc in resolvedDocuments.Documents)
                {
                    try
                    {
                        // Step A: Ensure the document has a generic outline (parse + analyze once)
                        var docOutline = await outlineRepository.GetOutlineAsync(resolvedDoc.DocumentId);
                        if (docOutline is null)
                        {
                            logger.LogInformation(
                                "Document {DocumentId} not yet analyzed — running generic pipeline first",
                                resolvedDoc.DocumentId);
                            await documentPipeline.RunAsync(resolvedDoc.DocumentId, "AMLR 2024/1624");
                            docOutline = await outlineRepository.GetOutlineAsync(resolvedDoc.DocumentId);
                        }

                        if (docOutline is null || string.IsNullOrWhiteSpace(docOutline.RawJson))
                        {
                            logger.LogWarning(
                                "No outline available for document {DocumentId} after pipeline run — skipping",
                                resolvedDoc.DocumentId);
                            continue;
                        }

                        // Step B: Customize the generic outline for this role
                        logger.LogInformation(
                            "Customizing outline for role {RoleName} from document {DocumentId}",
                            role.Name, resolvedDoc.DocumentId);

                        var customized = await analysisService.CustomizeOutlineForRoleAsync(
                            docOutline.RawJson,
                            role.Name,
                            roleRiskProfile);

                        allOutlines.Add(customized);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex,
                            "Failed to process document {DocumentId} for role {RoleName}",
                            resolvedDoc.DocumentId, role.Name);
                    }
                }

                if (allOutlines.Count == 0)
                    logger.LogWarning(
                        "No valid outlines available for role {RoleName} — all analyses failed", role.Name);

                logger.LogInformation(
                    "Collected {OutlineCount} outlines for role {RoleName} — merging into combined training",
                    allOutlines.Count, role.Name);

                // Step 4: Merge all outlines into one combined outline
                mergedOutline = MergeOutlines(allOutlines, roleId, role.Name, roleRiskProfile);
            }

            // Persist the completed outline
            var rawJson = JsonSerializer.Serialize(mergedOutline);
            await trainingRepository.UpdateTrainingStatusAsync(outlineRecord.Id, "Draft", rawJson: rawJson);

            logger.LogInformation(
                "Successfully generated training for role {RoleName}: {SectionCount} sections, {ObjectiveCount} learning objectives",
                role.Name, mergedOutline.Sections.Count,
                mergedOutline.Sections.Sum(s => s.LearningObjectives.Count));

            return mergedOutline;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Training generation failed for role {RoleId}", roleId);
            await trainingRepository.UpdateTrainingStatusAsync(
                outlineRecord.Id, "Failed", errorMessage: ex.Message);
            throw;
        }
    }

    public async Task<string> GetTrainingStatusAsync(Guid roleId)
    {
        var role = await hierarchyRepository.GetRoleAsync(roleId);
        if (role is null)
            throw new KeyNotFoundException($"Role {roleId} not found");

        // Get the resolved document set
        var resolvedDocuments = await documentVaultService.GetResolvedDocumentSetAsync(roleId);
        if (resolvedDocuments.Documents.Count == 0)
            return "Ready"; // Empty vault is considered "ready"

        // Check if all documents have been analyzed
        var allAnalyzed = true;
        foreach (var resolvedDoc in resolvedDocuments.Documents)
        {
            var outline = await outlineRepository.GetOutlineAsync(resolvedDoc.DocumentId);
            if (outline is null)
            {
                allAnalyzed = false;
                break;
            }
        }

        return allAnalyzed ? "Ready" : "Pending";
    }

    private TrainingOutlineResponse MergeOutlines(
        List<TrainingOutlineResponse> outlines,
        Guid roleId,
        string roleName,
        Dictionary<string, string> riskProfile)
    {
        // Combine all sections from all outlines
        var mergedSections = new List<OutlineSectionResponse>();
        var seenSectionTitles = new HashSet<string>();

        foreach (var outline in outlines)
        {
            foreach (var section in outline.Sections)
            {
                // Avoid exact duplicate sections by title
                if (!seenSectionTitles.Add(section.Title))
                    continue;

                mergedSections.Add(section);
            }
        }

        // Sort sections by regulatory basis article (if available), then by title
        mergedSections = mergedSections
            .OrderBy(s => int.TryParse(s.RegulatoryBasis?.AmlrArticle?.Split(',')[0].Trim(), out var n) ? n : int.MaxValue)
            .ThenBy(s => s.Title)
            .ToList();

        return new TrainingOutlineResponse
        {
            DocumentId = Guid.Empty, // Combined outline is not tied to a single document
            RegulationType = "AMLR 2024/1624",
            RoleName = roleName,
            RiskProfile = riskProfile,
            Sections = mergedSections,
            GeneratedAt = DateTime.UtcNow
        };
    }
}
