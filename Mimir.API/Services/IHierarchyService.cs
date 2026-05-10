using Mimir.API.Models.Requests.Hierarchy;
using Mimir.API.Models.Responses.Hierarchy;

namespace Mimir.API.Services;

/// <summary>Business logic for the three-level organizational hierarchy.</summary>
public interface IHierarchyService
{
    /// <summary>Creates and persists a new organization level.</summary>
    Task<OrganizationLevelResponse> CreateOrganizationLevelAsync(CreateOrganizationLevelRequest request);

    /// <summary>Creates a department and links it to the specified organization levels.</summary>
    Task<DepartmentResponse> CreateDepartmentAsync(CreateDepartmentRequest request);

    /// <summary>Creates a role with status Draft and links it to the specified departments.</summary>
    Task<RoleResponse> CreateRoleAsync(CreateRoleRequest request);

    /// <summary>Transitions a role from Draft to Published after validating it has at least one department.</summary>
    Task<RoleResponse> PublishRoleAsync(Guid roleId);

    /// <summary>Returns the full hierarchy as a nested structure suitable for a frontend folder tree.</summary>
    Task<List<OrganizationLevelResponse>> GetFullHierarchyAsync();
}
