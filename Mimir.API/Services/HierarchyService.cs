using Mimir.API.Data.Repositories;
using Mimir.API.Models.Domain.Hierarchy;
using Mimir.API.Models.Requests.Hierarchy;
using Mimir.API.Models.Responses.Hierarchy;

namespace Mimir.API.Services;

public class HierarchyService(
    IHierarchyRepository hierarchyRepository,
    ILogger<HierarchyService> logger) : IHierarchyService
{
    public async Task<OrganizationLevelResponse> CreateOrganizationLevelAsync(CreateOrganizationLevelRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Organization level name is required");
        if (request.Name.Length > 200)
            throw new ArgumentException("Organization level name cannot exceed 200 characters");

        var level = new OrganizationLevel
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Geography = request.Geography?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await hierarchyRepository.CreateOrganizationLevelAsync(level);
        logger.LogInformation("Created organization level: {Name} (id: {Id})", level.Name, level.Id);

        return MapOrganizationLevelToResponse(level);
    }

    public async Task<DepartmentResponse> CreateDepartmentAsync(CreateDepartmentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Department name is required");
        if (request.Name.Length > 200)
            throw new ArgumentException("Department name cannot exceed 200 characters");
        if (request.OrganizationLevelIds is null || request.OrganizationLevelIds.Count == 0)
            throw new ArgumentException("At least one organization level must be specified");

        var orgLevels = new List<OrganizationLevel>();
        foreach (var id in request.OrganizationLevelIds)
        {
            var orgLevel = await hierarchyRepository.GetOrganizationLevelAsync(id);
            if (orgLevel is null)
                throw new KeyNotFoundException($"Organization level {id} not found");
            orgLevels.Add(orgLevel);
        }

        var department = new Department
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        foreach (var orgLevel in orgLevels)
        {
            department.OrganizationLevels.Add(new DepartmentOrganizationLevel
            {
                DepartmentId = department.Id,
                Department = department,
                OrganizationLevelId = orgLevel.Id,
                OrganizationLevel = orgLevel
            });
        }

        await hierarchyRepository.CreateDepartmentAsync(department);
        logger.LogInformation("Created department: {Name} linked to {Count} organization levels",
            department.Name, orgLevels.Count);

        return MapDepartmentToResponse(department, orgLevels);
    }

    public async Task<RoleResponse> CreateRoleAsync(CreateRoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Role name is required");
        if (request.Name.Length > 200)
            throw new ArgumentException("Role name cannot exceed 200 characters");
        if (request.DepartmentIds is null || request.DepartmentIds.Count == 0)
            throw new ArgumentException("At least one department must be specified");

        var departments = new List<Department>();
        foreach (var id in request.DepartmentIds)
        {
            var dept = await hierarchyRepository.GetDepartmentAsync(id);
            if (dept is null)
                throw new KeyNotFoundException($"Department {id} not found");
            departments.Add(dept);
        }

        var role = new Role
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Status = "Draft",
            AmlRisk = request.AmlRisk ?? "Medium",
            SanctionsRisk = request.SanctionsRisk ?? "Medium",
            FraudRisk = request.FraudRisk ?? "Medium",
            DocumentationRisk = request.DocumentationRisk ?? "Medium",
            OperationalRisk = request.OperationalRisk ?? "Medium",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        foreach (var dept in departments)
        {
            role.Departments.Add(new RoleDepartment
            {
                RoleId = role.Id,
                Role = role,
                DepartmentId = dept.Id,
                Department = dept
            });
        }

        await hierarchyRepository.CreateRoleAsync(role);
        logger.LogInformation("Created role: {Name} (status: Draft) linked to {Count} departments",
            role.Name, departments.Count);

        return MapRoleToResponse(role, departments);
    }

    public async Task<RoleResponse> PublishRoleAsync(Guid roleId)
    {
        var role = await hierarchyRepository.GetRoleAsync(roleId);
        if (role is null)
            throw new KeyNotFoundException($"Role {roleId} not found");
        if (role.Status == "Published")
            throw new InvalidOperationException($"Role {roleId} is already published");
        if (role.Departments.Count == 0)
            throw new InvalidOperationException(
                "Cannot publish role without at least one department. Add departments before publishing.");

        var updatedRole = await hierarchyRepository.UpdateRoleStatusAsync(roleId, "Published");
        logger.LogInformation("Role {Name} ({Id}) published", updatedRole.Name, updatedRole.Id);

        return MapRoleToResponse(updatedRole, []);
    }

    public async Task<List<OrganizationLevelResponse>> GetFullHierarchyAsync()
    {
        var orgLevels = await hierarchyRepository.GetAllOrganizationLevelsAsync();
        var departments = await hierarchyRepository.GetAllDepartmentsAsync();
        var roles = await hierarchyRepository.GetAllRolesAsync();

        var deptById = departments.ToDictionary(d => d.Id);

        var rolesByDeptId = new Dictionary<Guid, List<Role>>();
        foreach (var role in roles)
        {
            foreach (var rd in role.Departments)
            {
                if (!rolesByDeptId.TryGetValue(rd.DepartmentId, out var list))
                {
                    list = [];
                    rolesByDeptId[rd.DepartmentId] = list;
                }
                list.Add(role);
            }
        }

        logger.LogDebug(
            "Loaded full hierarchy: {OrgLevelCount} org levels, {DeptCount} departments, {RoleCount} roles",
            orgLevels.Count, departments.Count, roles.Count);

        return orgLevels.Select(orgLevel =>
        {
            var linkedDepts = orgLevel.Departments
                .Where(dol => deptById.ContainsKey(dol.DepartmentId))
                .Select(dol => deptById[dol.DepartmentId])
                .ToList();

            var deptResponses = linkedDepts.Select(dept =>
            {
                var linkedRoles = rolesByDeptId.GetValueOrDefault(dept.Id, []);
                var response = MapDepartmentToResponse(dept, []);
                response.Roles = linkedRoles.Select(r => MapRoleToResponse(r, [])).ToList();
                return response;
            }).ToList();

            var orgLevelResponse = MapOrganizationLevelToResponse(orgLevel);
            orgLevelResponse.Departments = deptResponses;
            return orgLevelResponse;
        }).ToList();
    }

    private static OrganizationLevelResponse MapOrganizationLevelToResponse(OrganizationLevel level) =>
        new()
        {
            Id = level.Id,
            Name = level.Name,
            Description = level.Description,
            Geography = level.Geography,
            CreatedAt = level.CreatedAt
        };

    private static DepartmentResponse MapDepartmentToResponse(Department dept, List<OrganizationLevel> linkedOrgLevels) =>
        new()
        {
            Id = dept.Id,
            Name = dept.Name,
            Description = dept.Description,
            OrganizationLevels = linkedOrgLevels.Select(MapOrganizationLevelToResponse).ToList()
        };

    private static RoleResponse MapRoleToResponse(Role role, List<Department> linkedDepts) =>
        new()
        {
            Id = role.Id,
            Name = role.Name,
            Description = role.Description,
            Status = role.Status,
            AmlRisk = role.AmlRisk,
            SanctionsRisk = role.SanctionsRisk,
            FraudRisk = role.FraudRisk,
            DocumentationRisk = role.DocumentationRisk,
            OperationalRisk = role.OperationalRisk,
            Departments = linkedDepts.Select(d => MapDepartmentToResponse(d, [])).ToList()
        };
}
