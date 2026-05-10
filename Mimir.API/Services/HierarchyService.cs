using Mimir.API.Data.Repositories;
using Mimir.API.Models.Requests.Hierarchy;
using Mimir.API.Models.Responses.Hierarchy;

namespace Mimir.API.Services;

public class HierarchyService(
    IHierarchyRepository hierarchyRepository,
    ILogger<HierarchyService> logger) : IHierarchyService
{
    public async Task<OrganizationLevelResponse> CreateOrganizationLevelAsync(CreateOrganizationLevelRequest request)
    {
        _ = (hierarchyRepository, logger);
        // TODO: map request to OrganizationLevel entity
        // TODO: call hierarchyRepository.CreateOrganizationLevelAsync()
        // TODO: map result to OrganizationLevelResponse and return
        await Task.CompletedTask;
        throw new NotImplementedException();
    }

    public async Task<DepartmentResponse> CreateDepartmentAsync(CreateDepartmentRequest request)
    {
        // TODO: validate each id in request.OrganizationLevelIds exists via hierarchyRepository.GetOrganizationLevelAsync()
        //       throw ArgumentException (→ 400) if any id is invalid
        // TODO: create Department entity and persist via hierarchyRepository.CreateDepartmentAsync()
        // TODO: create DepartmentOrganizationLevel junction entries for each org level id
        // TODO: map result to DepartmentResponse and return
        await Task.CompletedTask;
        throw new NotImplementedException();
    }

    public async Task<RoleResponse> CreateRoleAsync(CreateRoleRequest request)
    {
        // TODO: validate each id in request.DepartmentIds exists via hierarchyRepository.GetDepartmentAsync()
        //       throw ArgumentException (→ 400) if any id is invalid
        // TODO: create Role entity with Status = "Draft"
        // TODO: persist via hierarchyRepository.CreateRoleAsync()
        // TODO: create RoleDepartment junction entries for each department id
        // TODO: map result to RoleResponse and return
        await Task.CompletedTask;
        throw new NotImplementedException();
    }

    public async Task<RoleResponse> PublishRoleAsync(Guid roleId)
    {
        // TODO: load role via hierarchyRepository.GetRoleAsync(roleId), throw KeyNotFoundException if null
        // TODO: validate role has at least one linked department, throw InvalidOperationException (→ 409) if none
        // TODO: call hierarchyRepository.UpdateRoleStatusAsync(roleId, "Published")
        // TODO: map updated role to RoleResponse and return
        await Task.CompletedTask;
        throw new NotImplementedException();
    }

    public async Task<List<OrganizationLevelResponse>> GetFullHierarchyAsync()
    {
        // TODO: call hierarchyRepository.GetAllOrganizationLevelsAsync() with full Include chain:
        //       OrganizationLevel → DepartmentOrganizationLevel → Department → RoleDepartment → Role
        // TODO: map to nested OrganizationLevelResponse (with DepartmentResponse → RoleResponse) and return
        await Task.CompletedTask;
        return [];
    }
}
