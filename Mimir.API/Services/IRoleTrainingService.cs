using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

/// <summary>Orchestrates training program generation for a specific role based on its resolved document set.</summary>
public interface IRoleTrainingService
{
    /// <summary>
    /// Generates a comprehensive training program for a role by:
    /// 1. Loading the role with its RiskProfile
    /// 2. Resolving all documents the role has access to via the vault
    /// 3. Ensuring all documents are analyzed (running pipeline if needed)
    /// 4. Merging all document outlines into one cohesive training outline
    /// 5. Injecting role context to calibrate training depth by risk exposure
    /// Returns the combined TrainingOutlineResponse for the role.
    /// </summary>
    Task<TrainingOutlineResponse> GenerateTrainingForRoleAsync(Guid roleId);

    /// <summary>
    /// Returns the generation status for a role's training:
    /// - "Pending": training generation not yet started
    /// - "Generating": training generation in progress
    /// - "Ready": training outline is complete and available
    /// - "Failed": training generation encountered an error
    /// </summary>
    Task<string> GetTrainingStatusAsync(Guid roleId);
}
