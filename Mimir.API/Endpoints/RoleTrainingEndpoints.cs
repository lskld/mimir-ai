using System.Text.Json;
using Mimir.API.Data.Repositories;
using Mimir.API.Models.Responses;
using Mimir.API.Services;

namespace Mimir.API.Endpoints;

public static class RoleTrainingEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public static void MapRoleTrainingEndpoints(this WebApplication app)
    {
        app.MapPost("/api/training/roles/{roleId:guid}/generate", async (
            Guid roleId,
            IHierarchyRepository hierarchyRepository,
            IRoleTrainingService roleTrainingService,
            IServiceScopeFactory scopeFactory,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("RoleTraining");
            var role = await hierarchyRepository.GetRoleAsync(roleId);
            if (role is null)
                throw new KeyNotFoundException($"Role {roleId} not found");

            // Create a new DI scope for the background task — the request scope is disposed
            // before Task.Run executes, which would otherwise cause ObjectDisposedException on DbContext.
            _ = Task.Run(async () =>
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var svc = scope.ServiceProvider.GetRequiredService<IRoleTrainingService>();
                await svc.GenerateTrainingForRoleAsync(roleId);
            });

            logger.LogInformation("Training generation triggered for role {RoleId}", roleId);

            return Results.Accepted(
                $"/api/training/roles/{roleId}/status",
                new
                {
                    roleId,
                    status = "Generating",
                    message = $"Training generation started. Poll /api/training/roles/{roleId}/status for updates."
                });
        });

        app.MapGet("/api/training/roles/{roleId:guid}/status", async (
            Guid roleId,
            IHierarchyRepository hierarchyRepository,
            ITrainingRepository trainingRepository) =>
        {
            var role = await hierarchyRepository.GetRoleAsync(roleId);
            if (role is null)
                throw new KeyNotFoundException($"Role {roleId} not found");

            var outline = await trainingRepository.GetTrainingStatusAsync(roleId);

            if (outline is null)
                return Results.Ok(new
                {
                    roleId,
                    status = "Pending",
                    lastUpdated = (DateTime?)null
                });

            var apiStatus = outline.Status switch
            {
                "Draft" or "Approved" => "Ready",
                "Generating" => "Generating",
                "Failed" => "Failed",
                _ => outline.Status
            };

            if (outline.Status == "Failed")
                return Results.Ok(new
                {
                    roleId,
                    status = apiStatus,
                    lastUpdated = outline.UpdatedAt,
                    errorMessage = outline.ErrorMessage
                });

            return Results.Ok(new
            {
                roleId,
                status = apiStatus,
                lastUpdated = outline.UpdatedAt
            });
        });

        app.MapGet("/api/training/roles/{roleId:guid}/outline", async (
            Guid roleId,
            IHierarchyRepository hierarchyRepository,
            ITrainingRepository trainingRepository,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("RoleTraining");
            var role = await hierarchyRepository.GetRoleAsync(roleId);
            if (role is null)
                throw new KeyNotFoundException($"Role {roleId} not found");

            var outline = await trainingRepository.GetTrainingOutlineAsync(roleId);

            if (outline is null)
                return Results.Conflict(new
                {
                    message = $"Training outline not yet generated. Trigger generation with POST /api/training/roles/{roleId}/generate"
                });

            if (outline.Status == "Failed")
                return Results.Conflict(new
                {
                    message = "Training generation failed. Check the error message.",
                    errorMessage = outline.ErrorMessage
                });

            if (outline.Status == "Generating")
                return Results.Conflict(new
                {
                    message = "Training generation is still in progress. Poll the status endpoint."
                });

            var response = JsonSerializer.Deserialize<TrainingOutlineResponse>(outline.RawJson!, JsonOptions);

            logger.LogDebug("Retrieved training outline for role {RoleId}", roleId);

            return Results.Ok(response);
        });

        app.MapPost("/api/training/roles/{roleId:guid}/approve", async (
            Guid roleId,
            IHierarchyRepository hierarchyRepository,
            ITrainingRepository trainingRepository,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("RoleTraining");
            var role = await hierarchyRepository.GetRoleAsync(roleId);
            if (role is null)
                throw new KeyNotFoundException($"Role {roleId} not found");

            var outline = await trainingRepository.GetTrainingOutlineAsync(roleId);

            if (outline is null)
                return Results.Conflict(new
                {
                    message = "No outline to approve. Generate training first."
                });

            if (outline.Status == "Approved")
            {
                var alreadyApproved = JsonSerializer.Deserialize<TrainingOutlineResponse>(outline.RawJson!, JsonOptions);
                return Results.Ok(alreadyApproved);
            }

            var updated = await trainingRepository.UpdateTrainingStatusAsync(
                outline.Id,
                "Approved",
                approvedAt: DateTime.UtcNow);

            logger.LogInformation("Training approved for role {RoleId}", roleId);

            var response = JsonSerializer.Deserialize<TrainingOutlineResponse>(updated.RawJson!, JsonOptions);
            return Results.Ok(response);
        });
    }
}
