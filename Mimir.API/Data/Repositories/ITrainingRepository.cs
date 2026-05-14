using Mimir.API.Models.Domain;

namespace Mimir.API.Data.Repositories;

/// <summary>Persistence operations for <see cref="RoleTrainingOutline"/> entities.</summary>
public interface ITrainingRepository
{
    /// <summary>Returns the most recent training outline for the given role, or null if none exists.</summary>
    Task<RoleTrainingOutline?> GetTrainingOutlineAsync(Guid roleId);

    /// <summary>
    /// Returns the most recent training outline for the given role (same as GetTrainingOutlineAsync),
    /// used by the status endpoint to retrieve status, lastUpdated, and errorMessage.
    /// Returns null when no generation has been triggered yet ("Pending").
    /// </summary>
    Task<RoleTrainingOutline?> GetTrainingStatusAsync(Guid roleId);

    /// <summary>Persists a new training outline record and returns the saved entity.</summary>
    Task<RoleTrainingOutline> SaveTrainingOutlineAsync(RoleTrainingOutline outline);

    /// <summary>Updates the status (and optionally errorMessage/approvedAt) of an outline.</summary>
    Task<RoleTrainingOutline> UpdateTrainingStatusAsync(
        Guid outlineId,
        string status,
        string? rawJson = null,
        string? errorMessage = null,
        DateTime? approvedAt = null);
}
