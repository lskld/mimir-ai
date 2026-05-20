using System.Text.Json;
using Mimir.API.Data.Repositories;
using Mimir.API.Models.Requests;
using Mimir.API.Models.Responses;
using Mimir.API.Pipeline;

namespace Mimir.API.Endpoints;

public static class AnalysisEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public static void MapAnalysisEndpoints(this WebApplication app)
    {
        app.MapPost("/api/analysis", async (
            AnalyzeDocumentRequest request,
            IServiceScopeFactory scopeFactory) =>
        {
            if (request.DocumentId == Guid.Empty || string.IsNullOrWhiteSpace(request.RegulationType))
                return Results.BadRequest("DocumentId and RegulationType are required.");

            // Create a new DI scope for the background task — the request scope is disposed
            // before Task.Run executes, which would otherwise cause ObjectDisposedException on DbContext.
            _ = Task.Run(async () =>
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var pipeline = scope.ServiceProvider.GetRequiredService<IDocumentPipeline>();
                await pipeline.RunAsync(request.DocumentId, request.RegulationType);
            });

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

            if (outline.Status is not ("Draft" or "Approved"))
                return Results.Conflict(new { message = "Analysis is still in progress." });

            var response = JsonSerializer.Deserialize<TrainingOutlineResponse>(outline.RawJson, JsonOptions);
            if (response is not null) response.Status = outline.Status;
            return Results.Ok(response);
        });

        app.MapPost("/api/analysis/{documentId:guid}/approve", async (
            Guid documentId,
            IOutlineRepository outlineRepository) =>
        {
            var outline = await outlineRepository.GetOutlineAsync(documentId);

            if (outline is null)
                return Results.NotFound();

            var approved = await outlineRepository.UpdateOutlineStatusAsync(outline.Id, "Approved");
            var response = JsonSerializer.Deserialize<TrainingOutlineResponse>(approved.RawJson, JsonOptions);
            if (response is not null) response.Status = approved.Status;
            return Results.Ok(response);
        });
    }
}
