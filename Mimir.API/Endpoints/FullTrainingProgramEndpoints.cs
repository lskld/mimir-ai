using System.Text.Json;
using Mimir.API.Data.Repositories;
using Mimir.API.Models.Responses;
using Mimir.API.Services;

namespace Mimir.API.Endpoints;

public static class FullTrainingProgramEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public static void MapFullTrainingProgramEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/training/roles/{roleId:guid}/full-program");

        group.MapPost("/generate", GenerateFullProgram);
        group.MapGet("/status", GetFullProgramStatus);
        group.MapGet("", GetFullProgram);
        group.MapGet("/export/scorm", ExportScorm);
    }

    // ─── Handlers ─────────────────────────────────────────────────────────────

    private static async Task<IResult> GenerateFullProgram(
        Guid roleId,
        IHierarchyRepository hierarchyRepository,
        ITrainingRepository trainingRepository,
        IFullTrainingProgramRepository fullProgramRepository,
        IServiceScopeFactory scopeFactory,
        ILoggerFactory loggerFactory)
    {
        var logger = loggerFactory.CreateLogger("FullTrainingProgram");

        var role = await hierarchyRepository.GetRoleAsync(roleId);
        if (role is null)
            throw new KeyNotFoundException($"Role {roleId} not found");

        // Require an approved training outline before full program generation can start
        var outline = await trainingRepository.GetTrainingOutlineAsync(roleId);
        if (outline is null)
            throw new InvalidOperationException(
                $"No training outline exists for role '{role.Name}'. Generate and approve a training outline first.");
        if (outline.Status != "Approved")
            throw new InvalidOperationException(
                $"Training outline for role '{role.Name}' is not approved (current status: {outline.Status}). Approve it before generating the full program.");

        // Reject if a generation is already running
        var existing = await fullProgramRepository.GetByRoleIdAsync(roleId);
        if (existing?.Status == "Generating")
            throw new InvalidOperationException(
                $"Full program generation is already in progress for role '{role.Name}'. " +
                $"Poll /api/training/roles/{roleId}/full-program/status for updates.");

        logger.LogInformation(
            "Triggering full program generation for role {RoleName} ({RoleId})",
            role.Name, roleId);

        // Create a new DI scope for the background task — the request scope is disposed
        // before Task.Run executes, which would otherwise cause ObjectDisposedException on DbContext.
        _ = Task.Run(async () =>
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var svc = scope.ServiceProvider.GetRequiredService<IFullTrainingProgramService>();
            await svc.GenerateFullProgramAsync(roleId);
        });

        return Results.Accepted(
            $"/api/training/roles/{roleId}/full-program/status",
            new FullProgramStatusResponse("Generating", roleId));
    }

    private static async Task<IResult> GetFullProgramStatus(
        Guid roleId,
        IHierarchyRepository hierarchyRepository,
        IFullTrainingProgramRepository fullProgramRepository,
        ILoggerFactory loggerFactory)
    {
        var logger = loggerFactory.CreateLogger("FullTrainingProgram");

        var role = await hierarchyRepository.GetRoleAsync(roleId);
        if (role is null)
            throw new KeyNotFoundException($"Role {roleId} not found");

        var program = await fullProgramRepository.GetByRoleIdAsync(roleId);
        if (program is null)
            throw new KeyNotFoundException(
                $"No full training program record found for role '{role.Name}'. Trigger generation first.");

        logger.LogDebug(
            "Status poll for full program of role {RoleName} ({RoleId}): {Status}",
            role.Name, roleId, program.Status);

        return Results.Ok(new FullProgramStatusResponse(
            program.Status,
            roleId,
            program.Status == "Failed" ? program.ErrorMessage : null));
    }

    private static async Task<IResult> GetFullProgram(
        Guid roleId,
        IHierarchyRepository hierarchyRepository,
        IFullTrainingProgramRepository fullProgramRepository,
        ILoggerFactory loggerFactory)
    {
        var logger = loggerFactory.CreateLogger("FullTrainingProgram");

        var role = await hierarchyRepository.GetRoleAsync(roleId);
        if (role is null)
            throw new KeyNotFoundException($"Role {roleId} not found");

        var program = await fullProgramRepository.GetByRoleIdAsync(roleId);
        if (program is null)
            throw new KeyNotFoundException(
                $"No full training program record found for role '{role.Name}'. Trigger generation first.");

        if (program.Status != "Ready")
        {
            return program.Status switch
            {
                "Generating" => Results.Conflict(new { message = "Program generation still in progress." }),
                "Failed"     => Results.Conflict(new { message = $"Program generation failed: {program.ErrorMessage}" }),
                _            => Results.Conflict(new { message = "Program generation has not started." })
            };
        }

        var response = JsonSerializer.Deserialize<FullTrainingProgramResponse>(program.RawJson!, JsonOptions);
        logger.LogInformation(
            "Retrieved full training program for role {RoleName} ({RoleId})",
            role.Name, roleId);

        return Results.Ok(response);
    }

    private static async Task<IResult> ExportScorm(
        Guid roleId,
        IHierarchyRepository hierarchyRepository,
        IFullTrainingProgramRepository fullProgramRepository,
        IScormPackageService scormPackageService,
        ILoggerFactory loggerFactory)
    {
        var logger = loggerFactory.CreateLogger("FullTrainingProgram");

        var role = await hierarchyRepository.GetRoleAsync(roleId);
        if (role is null)
            throw new KeyNotFoundException($"Role {roleId} not found");

        var program = await fullProgramRepository.GetByRoleIdAsync(roleId);
        if (program is null)
            throw new KeyNotFoundException(
                $"No full training program record found for role '{role.Name}'.");

        if (program.Status != "Ready")
            throw new InvalidOperationException(
                $"Program not ready for export. Current status: {program.Status}.");

        logger.LogInformation(
            "Exporting SCORM for role {RoleName} ({RoleId})", role.Name, roleId);

        var fullProgram = JsonSerializer.Deserialize<FullTrainingProgramResponse>(program.RawJson!, JsonOptions)
            ?? throw new InvalidOperationException(
                $"Failed to deserialize full training program for role '{role.Name}'.");

        var zipBytes = await scormPackageService.PackageAsScormAsync(fullProgram);

        var fileName = $"training-course-{SanitizeFileName(role.Name)}.zip";
        logger.LogInformation(
            "SCORM export complete for role {RoleName}: {ByteCount} bytes, file: {FileName}",
            role.Name, zipBytes.Length, fileName);

        return Results.File(zipBytes, contentType: "application/zip", fileDownloadName: fileName);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static string SanitizeFileName(string name) =>
        string.Concat(name.Select(c => char.IsLetterOrDigit(c) ? c : '-'))
              .Trim('-')
              .ToLowerInvariant();
}
