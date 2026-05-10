using Mimir.API.Services;

namespace Mimir.API.Endpoints;

public static class DocumentEndpoints
{
    public static void MapDocumentEndpoints(this WebApplication app)
    {
        app.MapPost("/api/documents/upload", async (
            IFormFile? file,
            [Microsoft.AspNetCore.Mvc.FromQuery] string? regulationType,
            IDocumentService documentService) =>
        {
            if (file is null)
                return Results.BadRequest("A file is required.");

            // TODO: validate MIME type / extension; return 400 on failure
            var response = await documentService.UploadDocumentAsync(file, regulationType);
            return Results.Created($"/api/documents/{response.Id}", response);
        }).DisableAntiforgery();

        app.MapGet("/api/documents/{documentId:guid}", async (
            Guid documentId,
            IDocumentService documentService) =>
        {
            // TODO: catch KeyNotFoundException and return 404
            var response = await documentService.GetDocumentAsync(documentId);
            return Results.Ok(response);
        });
    }
}
