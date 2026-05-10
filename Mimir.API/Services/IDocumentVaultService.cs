using Mimir.API.Models.Requests.Hierarchy;
using Mimir.API.Models.Responses.Hierarchy;

namespace Mimir.API.Services;

/// <summary>Manages document-to-hierarchy-node assignments and resolves inherited document sets.</summary>
public interface IDocumentVaultService
{
    /// <summary>
    /// Validates that both the document and the target hierarchy node exist,
    /// checks for a duplicate assignment, and persists the link.
    /// </summary>
    Task AssignDocumentToLevelAsync(AssignDocumentRequest request);

    /// <summary>
    /// Core inheritance method. Resolves the full set of documents visible to a role by walking
    /// the hierarchy upward: Role → Department → OrganizationLevel.
    /// Role-level assignments take precedence over Department, which takes precedence over OrganizationLevel.
    /// </summary>
    Task<ResolvedDocumentSetResponse> GetResolvedDocumentSetAsync(Guid roleId);

    /// <summary>Returns direct (non-inherited) assignments for a single hierarchy node.</summary>
    Task<List<ResolvedDocumentResponse>> GetDocumentsForTargetAsync(string targetType, Guid targetId);
}
