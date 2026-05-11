using Mimir.API.Models.Domain.Vault;

namespace Mimir.API.Data.Repositories;

public class DocumentVaultRepository(AppDbContext context) : IDocumentVaultRepository
{
    public async Task<DocumentAssignment> AssignDocumentAsync(DocumentAssignment assignment)
    {
        _ = context; // TODO: context.DocumentAssignments.Add(assignment); await context.SaveChangesAsync();
        await Task.CompletedTask;
        return assignment;
    }

    public async Task<List<DocumentAssignment>> GetAssignmentsForTargetAsync(string targetType, Guid targetId)
    {
        // TODO: return await context.DocumentAssignments.Where(a => a.TargetType == targetType && a.TargetId == targetId).ToListAsync();
        await Task.CompletedTask;
        return [];
    }

    public async Task<List<DocumentAssignment>> GetAllAssignmentsForRoleAsync(Guid roleId)
    {
        // TODO: return direct role assignments only — fetch context.DocumentAssignments
        //       where TargetType == "Role" && TargetId == roleId
        //       Inheritance across departments and org levels is resolved in the service layer.
        await Task.CompletedTask;
        return [];
    }

    public async Task RemoveAssignmentAsync(Guid assignmentId)
    {
        // TODO: load assignment by Id, context.DocumentAssignments.Remove(...), await context.SaveChangesAsync();
        await Task.CompletedTask;
    }
}
