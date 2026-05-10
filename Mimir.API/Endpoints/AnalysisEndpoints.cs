using Mimir.API.Data.Repositories;
using Mimir.API.Models.Requests;
using Mimir.API.Pipeline;

namespace Mimir.API.Endpoints;

public static class AnalysisEndpoints
{
    public static void MapAnalysisEndpoints(this WebApplication app)
    {
        app.MapPost("/api/analysis", async (
            AnalyzeDocumentRequest request,
            IDocumentPipeline pipeline) =>
        {
            if (request.DocumentId == Guid.Empty || string.IsNullOrWhiteSpace(request.RegulationType))
                return Results.BadRequest("DocumentId and RegulationType are required.");

            // Fire-and-forget: run the pipeline in the background so the response is immediate.
            _ = Task.Run(() => pipeline.RunAsync(request.DocumentId, request.RegulationType));

            return Results.Accepted(
                $"/api/analysis/{request.DocumentId}/outline",
                new { documentId = request.DocumentId });
        });

        app.MapGet("/api/analysis/{documentId:guid}/outline", async (
            Guid documentId,
            IOutlineRepository outlineRepository) =>
        {
            var outline = await outlineRepository.GetOutlineAsync(documentId);

            if (outline is null)
                return Results.NotFound();

            // TODO: if outline.Status is not Approved/Draft (i.e. analysis still running), return 409
            // TODO: deserialize outline.RawJson into TrainingOutlineResponse and return 200
            return Results.Ok(outline);
        });

        app.MapPost("/api/analysis/{documentId:guid}/approve", async (
            Guid documentId,
            IOutlineRepository outlineRepository) =>
        {
            var outline = await outlineRepository.GetOutlineAsync(documentId);

            if (outline is null)
                return Results.NotFound();

            var approved = await outlineRepository.UpdateOutlineStatusAsync(outline.Id, "Approved");
            // TODO: deserialize approved.RawJson into TrainingOutlineResponse and return 200
            return Results.Ok(approved);
        });
    }
}
