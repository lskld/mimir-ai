using Mimir.API.Data.Repositories;
using Mimir.API.Models.Domain.Hierarchy;
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

    /// <summary>
    /// Returns the complete set of documents visible to a role by walking the hierarchy upward:
    /// Role → Department → OrganizationLevel. When the same document is assigned at multiple levels,
    /// the most specific level wins: Role overrides Department, Department overrides OrganizationLevel.
    /// </summary>
    public async Task<ResolvedDocumentSetResponse> GetResolvedDocumentSetAsync(Guid roleId)
    {
        // Step 1 — Load the role and walk the full hierarchy tree to collect names.
        // GetRoleAsync includes RoleDepartment junctions (DepartmentIds populated) but does NOT
        // ThenInclude Department entities, so each department must be fetched explicitly.
        var role = await hierarchyRepository.GetRoleAsync(roleId);
        if (role is null)
            throw new KeyNotFoundException($"Role {roleId} not found");

        var departments = new List<Department>();
        var deptNames = new Dictionary<Guid, string>();
        var orgLevelNames = new Dictionary<Guid, string>();

        foreach (var rd in role.Departments)
        {
            var dept = await hierarchyRepository.GetDepartmentAsync(rd.DepartmentId);
            if (dept is null) continue;
            departments.Add(dept);
            deptNames[dept.Id] = dept.Name;

            // GetDepartmentAsync includes DepartmentOrganizationLevel junctions (OrgLevelIds
            // populated) but does NOT ThenInclude OrganizationLevel entities — fetch each once.
            foreach (var dol in dept.OrganizationLevels)
            {
                if (orgLevelNames.ContainsKey(dol.OrganizationLevelId)) continue;
                var orgLevel = await hierarchyRepository.GetOrganizationLevelAsync(dol.OrganizationLevelId);
                if (orgLevel is not null)
                    orgLevelNames[orgLevel.Id] = orgLevel.Name;
            }
        }

        var distinctOrgLevelIds = orgLevelNames.Keys.ToList();

        logger.LogDebug(
            "Resolving document set for role {RoleName} ({RoleId}): {DeptCount} departments, {OrgLevelCount} total org levels",
            role.Name, roleId, departments.Count, distinctOrgLevelIds.Count);

        // Step 2 — Collect all document assignments across all three levels.
        var roleAssignments = await documentVaultRepository.GetAssignmentsForTargetAsync("Role", roleId);

        var departmentAssignments = new List<DocumentAssignment>();
        foreach (var dept in departments)
        {
            var deptAssignments = await documentVaultRepository.GetAssignmentsForTargetAsync("Department", dept.Id);
            departmentAssignments.AddRange(deptAssignments);
        }

        var orgLevelAssignments = new List<DocumentAssignment>();
        foreach (var orgLevelId in distinctOrgLevelIds)
        {
            var olAssignments = await documentVaultRepository.GetAssignmentsForTargetAsync("OrganizationLevel", orgLevelId);
            orgLevelAssignments.AddRange(olAssignments);
        }

        logger.LogDebug(
            "Raw assignments collected — Role: {RoleCount}, Departments: {DeptCount}, OrgLevels: {OrgLevelCount}",
            roleAssignments.Count, departmentAssignments.Count, orgLevelAssignments.Count);

        // Step 3 — Deduplicate by DocumentId using specificity priority.
        // Process least-specific first so more-specific entries overwrite them.
        // The dictionary value captures both the assignment entity and its provenance for the response.
        var resolved = new Dictionary<Guid, (DocumentAssignment Assignment, string InheritedFrom, string InheritedFromName)>();

        foreach (var a in orgLevelAssignments)
            resolved[a.DocumentId] = (a, "OrganizationLevel", orgLevelNames.GetValueOrDefault(a.TargetId, "[Unknown]"));

        foreach (var a in departmentAssignments)
            resolved[a.DocumentId] = (a, "Department", deptNames.GetValueOrDefault(a.TargetId, "[Unknown]"));

        foreach (var a in roleAssignments)
            resolved[a.DocumentId] = (a, "Role", role.Name);

        var totalRaw = roleAssignments.Count + departmentAssignments.Count + orgLevelAssignments.Count;
        logger.LogDebug(
            "After deduplication: {UniqueCount} unique documents ({DuplicatesRemoved} duplicates removed by priority resolution)",
            resolved.Count, totalRaw - resolved.Count);

        // Edge case — vault is empty
        if (resolved.Count == 0)
        {
            logger.LogInformation("No documents found for role {RoleName} — vault may be empty", role.Name);
            return new ResolvedDocumentSetResponse { RoleId = roleId, RoleName = role.Name };
        }

        // Step 4 — Map to response; defend against documents deleted after assignment.
        // GetAssignmentsForTargetAsync always Includes Document, so a.Document is normally
        // populated — the null branch covers the rare case of a deleted document.
        var documents = new List<ResolvedDocumentResponse>();
        foreach (var (assignment, inheritedFrom, inheritedFromName) in resolved.Values)
        {
            var fileName = assignment.Document?.OriginalFileName;
            if (fileName is null)
            {
                var doc = await documentRepository.GetDocumentAsync(assignment.DocumentId);
                if (doc is null)
                {
                    logger.LogWarning(
                        "Document {DocumentId} referenced in assignment {AssignmentId} no longer exists — skipping",
                        assignment.DocumentId, assignment.Id);
                    continue;
                }
                fileName = doc.OriginalFileName;
            }

            documents.Add(new ResolvedDocumentResponse
            {
                DocumentId = assignment.DocumentId,
                FileName = fileName,
                InheritedFrom = inheritedFrom,
                InheritedFromName = inheritedFromName,
                TargetType = assignment.TargetType
            });
        }

        // Role first, then Department, then OrganizationLevel; alphabetical within each group.
        static int LevelOrder(string from) => from switch
        {
            "Role" => 0,
            "Department" => 1,
            _ => 2
        };

        documents = [.. documents.OrderBy(d => LevelOrder(d.InheritedFrom)).ThenBy(d => d.FileName)];

        var finalRoleCount = documents.Count(d => d.InheritedFrom == "Role");
        var finalDeptCount = documents.Count(d => d.InheritedFrom == "Department");
        var finalOrgLevelCount = documents.Count(d => d.InheritedFrom == "OrganizationLevel");

        logger.LogInformation(
            "Resolved document set for role {RoleName}: {Total} documents ({RoleCount} from role, {DeptCount} from departments, {OrgLevelCount} from org levels)",
            role.Name, documents.Count, finalRoleCount, finalDeptCount, finalOrgLevelCount);

        return new ResolvedDocumentSetResponse
        {
            RoleId = roleId,
            RoleName = role.Name,
            Documents = documents
        };
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
