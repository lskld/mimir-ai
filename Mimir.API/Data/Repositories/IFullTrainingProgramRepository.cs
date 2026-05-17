using Mimir.API.Models.Domain;

namespace Mimir.API.Data.Repositories;

/// <summary>Persistence operations for <see cref="FullTrainingProgram"/> entities.</summary>
public interface IFullTrainingProgramRepository
{
    /// <summary>Returns the most recent full training program for the given role, or null if none exists.</summary>
    Task<FullTrainingProgram?> GetByRoleIdAsync(Guid roleId);

    /// <summary>Inserts or replaces the full training program for a role and returns the saved entity.</summary>
    Task<FullTrainingProgram> SaveOrUpdateAsync(FullTrainingProgram program);

    /// <summary>Updates status and optional payload fields on an existing record.</summary>
    Task<FullTrainingProgram> UpdateStatusAsync(
        Guid id,
        string status,
        string? rawJson = null,
        string? errorMessage = null,
        DateTime? completedAt = null);
}
