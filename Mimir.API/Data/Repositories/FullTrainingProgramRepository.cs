using Microsoft.EntityFrameworkCore;
using Mimir.API.Models.Domain;

namespace Mimir.API.Data.Repositories;

public class FullTrainingProgramRepository(AppDbContext context) : IFullTrainingProgramRepository
{
    public async Task<FullTrainingProgram?> GetByRoleIdAsync(Guid roleId) =>
        await context.FullTrainingPrograms
            .Where(p => p.RoleId == roleId)
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();

    public async Task<FullTrainingProgram> SaveOrUpdateAsync(FullTrainingProgram program)
    {
        var existing = await GetByRoleIdAsync(program.RoleId);
        if (existing is not null)
        {
            existing.Status = program.Status;
            existing.RoleName = program.RoleName;
            existing.RawJson = program.RawJson;
            existing.ErrorMessage = program.ErrorMessage;
            existing.CompletedAt = program.CompletedAt;
            existing.ScormZipPath = program.ScormZipPath;
            await context.SaveChangesAsync();
            return existing;
        }

        context.FullTrainingPrograms.Add(program);
        await context.SaveChangesAsync();
        return program;
    }

    public async Task<FullTrainingProgram> UpdateStatusAsync(
        Guid id,
        string status,
        string? rawJson = null,
        string? errorMessage = null,
        DateTime? completedAt = null)
    {
        var program = await context.FullTrainingPrograms.FindAsync(id)
            ?? throw new KeyNotFoundException($"FullTrainingProgram {id} not found");

        program.Status = status;

        if (rawJson is not null)
            program.RawJson = rawJson;
        if (errorMessage is not null)
            program.ErrorMessage = errorMessage;
        if (completedAt is not null)
            program.CompletedAt = completedAt;

        await context.SaveChangesAsync();
        return program;
    }
}
