using Mimir.API.Models.Domain;

namespace Mimir.API.Data.Repositories;

public class OutlineRepository(AppDbContext context) : IOutlineRepository
{
    public async Task<TrainingOutline> SaveOutlineAsync(TrainingOutline outline)
    {
        _ = context; // TODO: context.Outlines.Add(outline); await context.SaveChangesAsync();
        await Task.CompletedTask;
        return outline;
    }

    public async Task<TrainingOutline?> GetOutlineAsync(Guid documentId)
    {
        // TODO: return await context.Outlines.FirstOrDefaultAsync(o => o.DocumentId == documentId);
        await Task.CompletedTask;
        return null;
    }

    public async Task<TrainingOutline> UpdateOutlineStatusAsync(Guid outlineId, string status)
    {
        // TODO: load outline by Id, set Status, save changes, return updated entity
        await Task.CompletedTask;
        throw new NotImplementedException();
    }
}
