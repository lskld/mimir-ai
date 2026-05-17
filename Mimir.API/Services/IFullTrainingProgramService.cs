using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

public interface IFullTrainingProgramService
{
    /// <summary>
    /// Generates full training program (lessons, quizzes, scenarios) from an approved outline.
    /// Runs as a background task; client polls status via GetFullProgramStatusAsync.
    /// </summary>
    Task<FullTrainingProgramResponse> GenerateFullProgramAsync(Guid roleId);

    /// <summary>Returns generation status: Pending, Generating, Ready, Failed.</summary>
    Task<string> GetFullProgramStatusAsync(Guid roleId);

    /// <summary>Retrieves the completed program if Ready status.</summary>
    Task<FullTrainingProgramResponse?> GetFullProgramAsync(Guid roleId);

    /// <summary>Exports the completed program as a SCORM 1.2 ZIP package.</summary>
    Task<byte[]> ExportScormAsync(Guid roleId);
}
