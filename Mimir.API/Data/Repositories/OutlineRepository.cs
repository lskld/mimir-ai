using Microsoft.EntityFrameworkCore;
using Mimir.API.Models.Domain;

namespace Mimir.API.Data.Repositories;

public class OutlineRepository(AppDbContext context) : IOutlineRepository
{
    public async Task<TrainingOutline> SaveOutlineAsync(TrainingOutline outline)
    {
        context.Outlines.Add(outline);
        await context.SaveChangesAsync();
        return outline;
    }

    public async Task<TrainingOutline?> GetOutlineAsync(Guid documentId)
    {
        return await context.Outlines
            .Include(o => o.Document)
            .FirstOrDefaultAsync(o => o.DocumentId == documentId);
    }

    public async Task<TrainingOutline> UpdateOutlineStatusAsync(Guid outlineId, string status)
    {
        var outline = await context.Outlines.FindAsync(outlineId)
            ?? throw new KeyNotFoundException($"Outline {outlineId} not found");

        outline.Status = status;
        await context.SaveChangesAsync();
        return outline;
    }
}
