namespace Mimir.API.Models.Responses;

public record ErrorResponse(
    int Status,
    string Title,
    string Detail,
    string? Instance = null);
