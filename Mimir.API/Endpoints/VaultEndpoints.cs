using Mimir.API.Models.Requests.Hierarchy;
using Mimir.API.Services;

namespace Mimir.API.Endpoints;

public static class VaultEndpoints
{
    private static readonly IReadOnlySet<string> ValidTargetTypes =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "OrganizationLevel", "Department", "Role" };

    public static void MapVaultEndpoints(this WebApplication app)
    {
        app.MapPost("/api/vault/assign", async (
            AssignDocumentRequest request,
            IDocumentVaultService vaultService) =>
        {
            // TODO: catch InvalidOperationException (duplicate assignment) and return 409
            // TODO: catch KeyNotFoundException (document or target not found) and return 404
            await vaultService.AssignDocumentToLevelAsync(request);
            return Results.Ok();
        });

        app.MapGet("/api/vault/roles/{roleId:guid}/documents", async (
            Guid roleId,
            IDocumentVaultService vaultService) =>
        {
            // TODO: catch KeyNotFoundException (role not found) and return 404
            var result = await vaultService.GetResolvedDocumentSetAsync(roleId);
            return Results.Ok(result);
        });

        app.MapGet("/api/vault/{targetType}/{targetId:guid}/documents", async (
            string targetType,
            Guid targetId,
            IDocumentVaultService vaultService) =>
        {
            if (!ValidTargetTypes.Contains(targetType))
                return Results.BadRequest($"targetType must be one of: {string.Join(", ", ValidTargetTypes)}");

            var result = await vaultService.GetDocumentsForTargetAsync(targetType, targetId);
            return Results.Ok(result);
        });
    }
}
