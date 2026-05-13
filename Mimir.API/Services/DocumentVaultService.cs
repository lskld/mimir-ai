using Mimir.API.Data.Repositories;
using Mimir.API.Models.Domain.Vault;
using Mimir.API.Models.Requests.Hierarchy;
using Mimir.API.Models.Responses.Hierarchy;

namespace Mimir.API.Services;

public class DocumentVaultService(
    IDocumentVaultRepository documentVaultRepository,
    IHierarchyRepository hierarchyRepository,
    IDocumentRepository documentRepository,
    ILogger<DocumentVaultService> logger) : IDocumentVaultService
{
    private static readonly HashSet<string> ValidTargetTypes = ["OrganizationLevel", "Department", "Role"];

    public async Task AssignDocumentToLevelAsync(AssignDocumentRequest request)
    {
        if (request.DocumentId == Guid.Empty)
            throw new ArgumentException("Document ID is required");
        if (string.IsNullOrWhiteSpace(request.TargetType))
            throw new ArgumentException("Target type is required");
        if (request.TargetId == Guid.Empty)
            throw new ArgumentException("Target ID is required");
        if (!ValidTargetTypes.Contains(request.TargetType))
            throw new ArgumentException(
                $"Invalid target type: {request.TargetType}. Must be one of: OrganizationLevel, Department, Role");

        if (await documentRepository.GetDocumentAsync(request.DocumentId) is null)
        {
            logger.LogWarning("Document {DocumentId} not found", request.DocumentId);
            throw new KeyNotFoundException($"Document {request.DocumentId} not found");
        }

        switch (request.TargetType)
        {
            case "OrganizationLevel":
                if (await hierarchyRepository.GetOrganizationLevelAsync(request.TargetId) is null)
                {
                    logger.LogWarning("Organization level {TargetId} not found", request.TargetId);
                    throw new KeyNotFoundException($"Organization level {request.TargetId} not found");
                }
                break;
            case "Department":
                if (await hierarchyRepository.GetDepartmentAsync(request.TargetId) is null)
                {
                    logger.LogWarning("Department {TargetId} not found", request.TargetId);
                    throw new KeyNotFoundException($"Department {request.TargetId} not found");
                }
                break;
            case "Role":
                if (await hierarchyRepository.GetRoleAsync(request.TargetId) is null)
                {
                    logger.LogWarning("Role {TargetId} not found", request.TargetId);
                    throw new KeyNotFoundException($"Role {request.TargetId} not found");
                }
                break;
        }

        var existing = await documentVaultRepository.GetAssignmentsForTargetAsync(request.TargetType, request.TargetId);
        if (existing.Any(a => a.DocumentId == request.DocumentId))
        {
            logger.LogWarning("Document {DocumentId} is already assigned to {TargetType} {TargetId}",
                request.DocumentId, request.TargetType, request.TargetId);
            throw new InvalidOperationException(
                $"Document {request.DocumentId} is already assigned to this {request.TargetType}");
        }

        var assignment = new DocumentAssignment
        {
            Id = Guid.NewGuid(),
            DocumentId = request.DocumentId,
            TargetType = request.TargetType,
            TargetId = request.TargetId,
            AssignedAt = DateTime.UtcNow
        };

        await documentVaultRepository.AssignDocumentAsync(assignment);
        logger.LogInformation("Assigned document {DocumentId} to {TargetType} {TargetId}",
            request.DocumentId, request.TargetType, request.TargetId);
    }

    public async Task<ResolvedDocumentSetResponse> GetResolvedDocumentSetAsync(Guid roleId)
    {
        // TODO: Step 14 — inheritance resolution
        await Task.CompletedTask;
        throw new NotImplementedException();
    }

    public async Task<List<ResolvedDocumentResponse>> GetDocumentsForTargetAsync(string targetType, Guid targetId)
    {
        if (string.IsNullOrWhiteSpace(targetType))
            throw new ArgumentException("Target type is required");
        if (targetId == Guid.Empty)
            throw new ArgumentException("Target ID is required");
        if (!ValidTargetTypes.Contains(targetType))
            throw new ArgumentException(
                $"Invalid target type: {targetType}. Must be one of: OrganizationLevel, Department, Role");

        // Validate target exists and capture its name in a single DB call
        var targetName = targetType switch
        {
            "OrganizationLevel" => (await hierarchyRepository.GetOrganizationLevelAsync(targetId))?.Name
                ?? throw new KeyNotFoundException($"Organization level {targetId} not found"),
            "Department" => (await hierarchyRepository.GetDepartmentAsync(targetId))?.Name
                ?? throw new KeyNotFoundException($"Department {targetId} not found"),
            "Role" => (await hierarchyRepository.GetRoleAsync(targetId))?.Name
                ?? throw new KeyNotFoundException($"Role {targetId} not found"),
            _ => throw new ArgumentException($"Invalid target type: {targetType}")
        };

        var assignments = await documentVaultRepository.GetAssignmentsForTargetAsync(targetType, targetId);

        logger.LogDebug("Retrieved {Count} documents directly assigned to {TargetType} {TargetId}",
            assignments.Count, targetType, targetId);

        return assignments.Select(a => new ResolvedDocumentResponse
        {
            DocumentId = a.DocumentId,
            FileName = a.Document.OriginalFileName,
            InheritedFrom = targetType,
            InheritedFromName = targetName,
            TargetType = targetType
        }).ToList();
    }

    // Returns the display name of any hierarchy node; falls back to "[Unknown]" if the target
    // no longer exists (used by Step 14 inheritance resolution where nodes may have been deleted).
    private async Task<string> GetTargetNameAsync(string targetType, Guid targetId) => targetType switch
    {
        "OrganizationLevel" => (await hierarchyRepository.GetOrganizationLevelAsync(targetId))?.Name ?? "[Unknown]",
        "Department" => (await hierarchyRepository.GetDepartmentAsync(targetId))?.Name ?? "[Unknown]",
        "Role" => (await hierarchyRepository.GetRoleAsync(targetId))?.Name ?? "[Unknown]",
        _ => "[Unknown]"
    };
}
