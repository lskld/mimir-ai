using Microsoft.EntityFrameworkCore;
using Mimir.API.Models.Domain.Vault;

namespace Mimir.API.Data.Repositories;

public class DocumentVaultRepository(AppDbContext context) : IDocumentVaultRepository
{
    public async Task<DocumentAssignment> AssignDocumentAsync(DocumentAssignment assignment)
    {
        context.DocumentAssignments.Add(assignment);
        await context.SaveChangesAsync();
        return assignment;
    }

    public async Task<List<DocumentAssignment>> GetAssignmentsForTargetAsync(string targetType, Guid targetId)
    {
        return await context.DocumentAssignments
            .Include(a => a.Document)
            .Where(a => a.TargetType == targetType && a.TargetId == targetId)
            .ToListAsync();
    }

    // Returns direct role assignments only. Inheritance resolution (walking up to Department and
    // OrganizationLevel) is handled in DocumentVaultService, not here.
    public async Task<List<DocumentAssignment>> GetAllAssignmentsForRoleAsync(Guid roleId)
    {
        return await context.DocumentAssignments
            .Include(a => a.Document)
            .Where(a => a.TargetType == "Role" && a.TargetId == roleId)
            .ToListAsync();
    }

    public async Task RemoveAssignmentAsync(Guid assignmentId)
    {
        var assignment = await context.DocumentAssignments.FindAsync(assignmentId);
        if (assignment is null)
            return;

        context.DocumentAssignments.Remove(assignment);
        await context.SaveChangesAsync();
    }
}
