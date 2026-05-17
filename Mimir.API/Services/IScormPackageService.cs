using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

public interface IScormPackageService
{
    /// <summary>
    /// Converts a completed training program into a SCORM 1.2 ZIP package.
    /// Returns the ZIP file as a byte array suitable for file download.
    /// </summary>
    Task<byte[]> PackageAsScormAsync(FullTrainingProgramResponse program);
}
