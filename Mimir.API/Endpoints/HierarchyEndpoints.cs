using Mimir.API.Models.Requests.Hierarchy;
using Mimir.API.Services;

namespace Mimir.API.Endpoints;

public static class HierarchyEndpoints
{
    public static void MapHierarchyEndpoints(this WebApplication app)
    {
        app.MapPost("/api/hierarchy/organization-levels", async (
            CreateOrganizationLevelRequest request,
            IHierarchyService hierarchyService) =>
        {
            var response = await hierarchyService.CreateOrganizationLevelAsync(request);
            return Results.Created($"/api/hierarchy/organization-levels/{response.Id}", response);
        });

        app.MapGet("/api/hierarchy", async (IHierarchyService hierarchyService) =>
        {
            var hierarchy = await hierarchyService.GetFullHierarchyAsync();
            return Results.Ok(hierarchy);
        });

        app.MapPost("/api/hierarchy/departments", async (
            CreateDepartmentRequest request,
            IHierarchyService hierarchyService) =>
        {
            // TODO: catch ArgumentException from service (invalid org level id) and return 400
            var response = await hierarchyService.CreateDepartmentAsync(request);
            return Results.Created($"/api/hierarchy/departments/{response.Id}", response);
        });

        app.MapPost("/api/hierarchy/roles", async (
            CreateRoleRequest request,
            IHierarchyService hierarchyService) =>
        {
            // TODO: catch ArgumentException from service (invalid department id) and return 400
            var response = await hierarchyService.CreateRoleAsync(request);
            return Results.Created($"/api/hierarchy/roles/{response.Id}", response);
        });

        app.MapPost("/api/hierarchy/roles/{roleId:guid}/publish", async (
            Guid roleId,
            IHierarchyService hierarchyService) =>
        {
            // TODO: catch InvalidOperationException (no departments) and return 409
            // TODO: catch KeyNotFoundException (role not found) and return 404
            var response = await hierarchyService.PublishRoleAsync(roleId);
            return Results.Ok(response);
        });
    }
}
