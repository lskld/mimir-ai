using Microsoft.EntityFrameworkCore;
using Mimir.API.Models.Domain.Hierarchy;

namespace Mimir.API.Data.Repositories;

public class HierarchyRepository(AppDbContext context) : IHierarchyRepository
{
    public async Task<OrganizationLevel> CreateOrganizationLevelAsync(OrganizationLevel level)
    {
        context.OrganizationLevels.Add(level);
        await context.SaveChangesAsync();
        return level;
    }

    public async Task<OrganizationLevel?> GetOrganizationLevelAsync(Guid id)
    {
        return await context.OrganizationLevels
            .Include(o => o.Departments)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public async Task<List<OrganizationLevel>> GetAllOrganizationLevelsAsync()
    {
        return await context.OrganizationLevels
            .Include(o => o.Departments)
            .OrderBy(o => o.Name)
            .ToListAsync();
    }

    public async Task<Department> CreateDepartmentAsync(Department department)
    {
        context.Departments.Add(department);
        await context.SaveChangesAsync();
        return department;
    }

    public async Task<Department?> GetDepartmentAsync(Guid id)
    {
        return await context.Departments
            .Include(d => d.OrganizationLevels)
            .Include(d => d.Roles)
            .FirstOrDefaultAsync(d => d.Id == id);
    }

    public async Task<List<Department>> GetAllDepartmentsAsync()
    {
        return await context.Departments
            .Include(d => d.OrganizationLevels)
            .OrderBy(d => d.Name)
            .ToListAsync();
    }

    public async Task<List<Department>> GetDepartmentsByOrganizationLevelAsync(Guid orgLevelId)
    {
        return await context.DepartmentOrganizationLevels
            .Where(d => d.OrganizationLevelId == orgLevelId)
            .Select(d => d.Department)
            .OrderBy(d => d.Name)
            .ToListAsync();
    }

    public async Task<Role> CreateRoleAsync(Role role)
    {
        context.Roles.Add(role);
        await context.SaveChangesAsync();
        return role;
    }

    public async Task<Role?> GetRoleAsync(Guid id)
    {
        return await context.Roles
            .Include(r => r.Departments)
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    public async Task<List<Role>> GetAllRolesAsync()
    {
        return await context.Roles
            .Include(r => r.Departments)
            .OrderBy(r => r.Name)
            .ToListAsync();
    }

    public async Task<List<Role>> GetRolesByDepartmentAsync(Guid departmentId)
    {
        return await context.RoleDepartments
            .Where(rd => rd.DepartmentId == departmentId)
            .Select(rd => rd.Role)
            .OrderBy(r => r.Name)
            .ToListAsync();
    }

    public async Task<Role> UpdateRoleStatusAsync(Guid roleId, string status)
    {
        var role = await context.Roles.FindAsync(roleId)
            ?? throw new KeyNotFoundException($"Role {roleId} not found");

        role.Status = status;
        role.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        return role;
    }
}
