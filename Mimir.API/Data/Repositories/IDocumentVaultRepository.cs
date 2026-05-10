using Mimir.API.Models.Domain.Vault;

namespace Mimir.API.Data.Repositories;

/// <summary>Persistence operations for <see cref="DocumentAssignment"/> entities.</summary>
public interface IDocumentVaultRepository
{
    /// <summary>Persists a new document assignment and returns the saved entity.</summary>
    Task<DocumentAssignment> AssignDocumentAsync(DocumentAssignment assignment);

    /// <summary>Returns all assignments where TargetType and TargetId match the given values.</summary>
    Task<List<DocumentAssignment>> GetAssignmentsForTargetAsync(string targetType, Guid targetId);

    /// <summary>
    /// Returns direct assignments for the given role only — inheritance is resolved in the service layer.
    /// </summary>
    Task<List<DocumentAssignment>> GetAllAssignmentsForRoleAsync(Guid roleId);

    /// <summary>Removes the assignment with the given id.</summary>
    Task RemoveAssignmentAsync(Guid assignmentId);
}
