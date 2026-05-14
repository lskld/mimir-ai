using Microsoft.EntityFrameworkCore;
using Mimir.API.Models.Domain;

namespace Mimir.API.Data.Repositories;

public class TrainingRepository(AppDbContext context) : ITrainingRepository
{
    public async Task<RoleTrainingOutline?> GetTrainingOutlineAsync(Guid roleId) =>
        await context.RoleTrainingOutlines
            .Where(o => o.RoleId == roleId)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

    public Task<RoleTrainingOutline?> GetTrainingStatusAsync(Guid roleId) =>
        GetTrainingOutlineAsync(roleId);

    public async Task<RoleTrainingOutline> SaveTrainingOutlineAsync(RoleTrainingOutline outline)
    {
        context.RoleTrainingOutlines.Add(outline);
        await context.SaveChangesAsync();
        return outline;
    }

    public async Task<RoleTrainingOutline> UpdateTrainingStatusAsync(
        Guid outlineId,
        string status,
        string? rawJson = null,
        string? errorMessage = null,
        DateTime? approvedAt = null)
    {
        var outline = await context.RoleTrainingOutlines.FindAsync(outlineId)
            ?? throw new KeyNotFoundException($"RoleTrainingOutline {outlineId} not found");

        outline.Status = status;
        outline.UpdatedAt = DateTime.UtcNow;

        if (rawJson is not null)
            outline.RawJson = rawJson;
        if (errorMessage is not null)
            outline.ErrorMessage = errorMessage;
        if (approvedAt is not null)
            outline.ApprovedAt = approvedAt;

        await context.SaveChangesAsync();
        return outline;
    }
}
