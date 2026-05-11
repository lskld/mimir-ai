using Mimir.API.Models.Domain;

namespace Mimir.API.Data.Repositories;

/// <summary>Persistence operations for <see cref="TrainingOutline"/> entities.</summary>
public interface IOutlineRepository
{
    /// <summary>Persists a new training outline and returns the saved entity.</summary>
    Task<TrainingOutline> SaveOutlineAsync(TrainingOutline outline);

    /// <summary>Returns the training outline for the given document, or null if not found.</summary>
    Task<TrainingOutline?> GetOutlineAsync(Guid documentId);

    /// <summary>Updates the status field of an outline and returns the updated entity.</summary>
    Task<TrainingOutline> UpdateOutlineStatusAsync(Guid outlineId, string status);
}
