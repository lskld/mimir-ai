using Mimir.API.Models.Domain.Hierarchy;

namespace Mimir.API.Data.Repositories;

/// <summary>Persistence operations for the three-level organizational hierarchy.</summary>
public interface IHierarchyRepository
{
    /// <summary>Persists a new organization level and returns the saved entity.</summary>
    Task<OrganizationLevel> CreateOrganizationLevelAsync(OrganizationLevel level);

    /// <summary>Returns the organization level with the given id, or null if not found.</summary>
    Task<OrganizationLevel?> GetOrganizationLevelAsync(Guid id);

    /// <summary>Returns all organization levels.</summary>
    Task<List<OrganizationLevel>> GetAllOrganizationLevelsAsync();

    /// <summary>Persists a new department and returns the saved entity.</summary>
    Task<Department> CreateDepartmentAsync(Department department);

    /// <summary>Returns the department with the given id, or null if not found.</summary>
    Task<Department?> GetDepartmentAsync(Guid id);

    /// <summary>Returns all departments.</summary>
    Task<List<Department>> GetAllDepartmentsAsync();

    /// <summary>Returns all departments linked to the given organization level.</summary>
    Task<List<Department>> GetDepartmentsByOrganizationLevelAsync(Guid orgLevelId);

    /// <summary>Persists a new role and returns the saved entity.</summary>
    Task<Role> CreateRoleAsync(Role role);

    /// <summary>Returns the role with the given id, or null if not found.</summary>
    Task<Role?> GetRoleAsync(Guid id);

    /// <summary>Returns all roles.</summary>
    Task<List<Role>> GetAllRolesAsync();

    /// <summary>Returns all roles linked to the given department.</summary>
    Task<List<Role>> GetRolesByDepartmentAsync(Guid departmentId);

    /// <summary>Updates the status of a role and returns the updated entity.</summary>
    Task<Role> UpdateRoleStatusAsync(Guid roleId, string status);
}
