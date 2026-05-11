using Mimir.API.Models.Domain.Hierarchy;

namespace Mimir.API.Data.Repositories;

public class HierarchyRepository(AppDbContext context) : IHierarchyRepository
{
    public async Task<OrganizationLevel> CreateOrganizationLevelAsync(OrganizationLevel level)
    {
        _ = context; // TODO: context.OrganizationLevels.Add(level); await context.SaveChangesAsync();
        await Task.CompletedTask;
        return level;
    }

    public async Task<OrganizationLevel?> GetOrganizationLevelAsync(Guid id)
    {
        // TODO: return await context.OrganizationLevels.FindAsync(id);
        await Task.CompletedTask;
        return null;
    }

    public async Task<List<OrganizationLevel>> GetAllOrganizationLevelsAsync()
    {
        // TODO: return await context.OrganizationLevels.Include(o => o.Departments).ToListAsync();
        await Task.CompletedTask;
        return [];
    }

    public async Task<Department> CreateDepartmentAsync(Department department)
    {
        // TODO: context.Departments.Add(department); await context.SaveChangesAsync();
        await Task.CompletedTask;
        return department;
    }

    public async Task<Department?> GetDepartmentAsync(Guid id)
    {
        // TODO: return await context.Departments.Include(d => d.OrganizationLevels).Include(d => d.Roles).FirstOrDefaultAsync(d => d.Id == id);
        await Task.CompletedTask;
        return null;
    }

    public async Task<List<Department>> GetAllDepartmentsAsync()
    {
        // TODO: return await context.Departments.Include(d => d.OrganizationLevels).ToListAsync();
        await Task.CompletedTask;
        return [];
    }

    public async Task<List<Department>> GetDepartmentsByOrganizationLevelAsync(Guid orgLevelId)
    {
        // TODO: join through DepartmentOrganizationLevels to filter by orgLevelId
        await Task.CompletedTask;
        return [];
    }

    public async Task<Role> CreateRoleAsync(Role role)
    {
        // TODO: context.Roles.Add(role); await context.SaveChangesAsync();
        await Task.CompletedTask;
        return role;
    }

    public async Task<Role?> GetRoleAsync(Guid id)
    {
        // TODO: return await context.Roles.Include(r => r.Departments).ThenInclude(rd => rd.Department).FirstOrDefaultAsync(r => r.Id == id);
        await Task.CompletedTask;
        return null;
    }

    public async Task<List<Role>> GetAllRolesAsync()
    {
        // TODO: return await context.Roles.Include(r => r.Departments).ToListAsync();
        await Task.CompletedTask;
        return [];
    }

    public async Task<List<Role>> GetRolesByDepartmentAsync(Guid departmentId)
    {
        // TODO: join through RoleDepartments to filter by departmentId
        await Task.CompletedTask;
        return [];
    }

    public async Task<Role> UpdateRoleStatusAsync(Guid roleId, string status)
    {
        // TODO: load role, set Status and UpdatedAt, save changes, return updated entity
        await Task.CompletedTask;
        throw new NotImplementedException();
    }
}
