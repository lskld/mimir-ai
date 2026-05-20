using Mimir.API.Services;

namespace Mimir.API.Endpoints;

public static class DocumentEndpoints
{
    public static void MapDocumentEndpoints(this WebApplication app)
    {
        app.MapGet("/api/documents", async (IDocumentService documentService) =>
        {
            var documents = await documentService.GetAllDocumentsAsync();
            return Results.Ok(documents);
        });

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

        // TODO: REMOVE BEFORE DEMO
        app.MapGet("/api/documents/{documentId:guid}/parse", async (
            Guid documentId,
            IParsingService parsingService) =>
        {
            var chunks = await parsingService.ParseDocumentAsync(documentId);
            return Results.Ok(new
            {
                ChunkCount = chunks.Count,
                FirstChunks = chunks.Take(3).Select(c => new
                {
                    c.ChunkIndex,
                    c.PageNumber,
                    c.SectionHeading,
                    Preview = c.Content[..Math.Min(120, c.Content.Length)]
                })
            });
        });
    }
}
