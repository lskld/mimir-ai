namespace Mimir.API.Models.Responses;

public record FullProgramStatusResponse(
    string Status,
    Guid RoleId,
    string? ErrorMessage = null);
