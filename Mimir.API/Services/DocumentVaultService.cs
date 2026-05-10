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
    public async Task AssignDocumentToLevelAsync(AssignDocumentRequest request)
    {
        _ = (documentVaultRepository, hierarchyRepository, documentRepository, logger);
        // TODO: validate document exists via documentRepository.GetDocumentAsync(request.DocumentId)
        // TODO: validate target exists by switching on request.TargetType:
        //         "OrganizationLevel" → hierarchyRepository.GetOrganizationLevelAsync(request.TargetId)
        //         "Department"        → hierarchyRepository.GetDepartmentAsync(request.TargetId)
        //         "Role"              → hierarchyRepository.GetRoleAsync(request.TargetId)
        //         default             → throw ArgumentException (→ 400)
        // TODO: check for existing assignment via documentVaultRepository.GetAssignmentsForTargetAsync()
        //       and throw InvalidOperationException (→ 409) if already assigned
        // TODO: create and persist DocumentAssignment via documentVaultRepository.AssignDocumentAsync()
        await Task.CompletedTask;
    }

    public async Task<ResolvedDocumentSetResponse> GetResolvedDocumentSetAsync(Guid roleId)
    {
        // TODO: THIS IS THE CORE INHERITANCE METHOD.
        //
        // Step 1 — Load the full hierarchy for the role:
        //   Load Role (with its RoleDepartment junction entries)
        //   For each linked Department, load its DepartmentOrganizationLevel entries
        //   This gives us: role → departments[] → orgLevels[]
        //
        // Step 2 — Collect DocumentAssignments from all three levels:
        //   a. Direct role assignments:        TargetType == "Role",              TargetId == roleId
        //   b. Parent department assignments:  TargetType == "Department",        TargetId in departmentIds
        //   c. Grandparent org-level assignments: TargetType == "OrganizationLevel", TargetId in orgLevelIds
        //
        // Step 3 — Deduplicate by DocumentId using specificity order:
        //   Role wins over Department, Department wins over OrganizationLevel.
        //   When the same DocumentId appears at multiple levels, keep only the most specific assignment.
        //   Use a Dictionary<Guid, DocumentAssignment> keyed by DocumentId and process in order:
        //   orgLevel assignments first, then department, then role (later entries overwrite earlier ones).
        //
        // Step 4 — Map to ResolvedDocumentResponse:
        //   Populate InheritedFrom (the level type string) and InheritedFromName (the node's display name).
        //   Load document metadata (FileName) via documentRepository.GetDocumentAsync() for each.
        //
        // Step 5 — Return ResolvedDocumentSetResponse with RoleId, RoleName, and the resolved Documents list.
        await Task.CompletedTask;
        throw new NotImplementedException();
    }

    public async Task<List<ResolvedDocumentResponse>> GetDocumentsForTargetAsync(string targetType, Guid targetId)
    {
        // TODO: call documentVaultRepository.GetAssignmentsForTargetAsync(targetType, targetId)
        // TODO: for each assignment load document metadata via documentRepository.GetDocumentAsync()
        // TODO: map to ResolvedDocumentResponse with InheritedFrom = targetType and InheritedFromName
        //       populated from the target node's name (requires a lookup by targetType/targetId)
        // TODO: validate targetType is one of "OrganizationLevel", "Department", "Role"; return 400 otherwise
        await Task.CompletedTask;
        return [];
    }
}
