using Microsoft.EntityFrameworkCore;
using Mimir.API.Data.Repositories;
using Mimir.API.Models.Domain;
using Mimir.API.Models.Domain.Hierarchy;
using Mimir.API.Models.Domain.Vault;
using Mimir.API.Models.Requests.Hierarchy;

namespace Mimir.API.Data;

/// <summary>
/// Seeds demo data into the database on startup if it's empty.
/// Provides a presentation-ready system with organizational hierarchy, roles with risk profiles,
/// and sample documents ready for training generation.
/// </summary>
public static class SeedData
{
    public static async Task InitializeAsync(
        AppDbContext context,
        IHierarchyRepository hierarchyRepository,
        IDocumentRepository documentRepository,
        IDocumentVaultRepository documentVaultRepository,
        ILogger<Program> logger)
    {
        // Ensure database schema is created
        await context.Database.EnsureCreatedAsync();

        // Idempotency: only seed if database is empty
        if (context.Roles.Any())
        {
            logger.LogInformation("Database already contains data — skipping seed");
            return;
        }

        logger.LogInformation("Seeding database with demo data...");

        try
        {
            // Step 1: Create organization levels
            var globalCompliance = new OrganizationLevel
            {
                Id = Guid.NewGuid(),
                Name = "Global Compliance",
                Description = "Group-wide compliance and regulatory affairs",
                Geography = "EU",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await hierarchyRepository.CreateOrganizationLevelAsync(globalCompliance);
            logger.LogInformation("Created organization level: {Name}", globalCompliance.Name);

            // Step 2: Create departments
            var financialCrimeAml = new Department
            {
                Id = Guid.NewGuid(),
                Name = "Financial Crime & AML",
                Description = "Anti-Money Laundering, sanctions screening, and financial crime prevention",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            financialCrimeAml.OrganizationLevels.Add(new DepartmentOrganizationLevel
            {
                DepartmentId = financialCrimeAml.Id,
                Department = financialCrimeAml,
                OrganizationLevelId = globalCompliance.Id,
                OrganizationLevel = globalCompliance
            });
            await hierarchyRepository.CreateDepartmentAsync(financialCrimeAml);
            logger.LogInformation("Created department: {Name}", financialCrimeAml.Name);

            var customerOperations = new Department
            {
                Id = Guid.NewGuid(),
                Name = "Customer Operations",
                Description = "Front office customer service and advisory",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            customerOperations.OrganizationLevels.Add(new DepartmentOrganizationLevel
            {
                DepartmentId = customerOperations.Id,
                Department = customerOperations,
                OrganizationLevelId = globalCompliance.Id,
                OrganizationLevel = globalCompliance
            });
            await hierarchyRepository.CreateDepartmentAsync(customerOperations);
            logger.LogInformation("Created department: {Name}", customerOperations.Name);

            // Step 3: Create roles with risk profiles
            var kycAnalyst = new Role
            {
                Id = Guid.NewGuid(),
                Name = "KYC Analyst",
                Description = "Conducts Know-Your-Customer due diligence on new and existing customers",
                Status = "Draft",
                AmlRisk = "High",
                SanctionsRisk = "High",
                FraudRisk = "Medium",
                DocumentationRisk = "High",
                OperationalRisk = "Medium",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            kycAnalyst.Departments.Add(new RoleDepartment
            {
                RoleId = kycAnalyst.Id,
                Role = kycAnalyst,
                DepartmentId = financialCrimeAml.Id,
                Department = financialCrimeAml
            });
            await hierarchyRepository.CreateRoleAsync(kycAnalyst);
            logger.LogInformation("Created role: {Name} (AML Risk: High)", kycAnalyst.Name);

            var amlInvestigator = new Role
            {
                Id = Guid.NewGuid(),
                Name = "AML Investigator / Transaction Monitoring Analyst",
                Description = "Monitors transactions, investigates suspicious activity, and coordinates with compliance",
                Status = "Draft",
                AmlRisk = "High",
                SanctionsRisk = "Medium",
                FraudRisk = "High",
                DocumentationRisk = "High",
                OperationalRisk = "Medium",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            amlInvestigator.Departments.Add(new RoleDepartment
            {
                RoleId = amlInvestigator.Id,
                Role = amlInvestigator,
                DepartmentId = financialCrimeAml.Id,
                Department = financialCrimeAml
            });
            await hierarchyRepository.CreateRoleAsync(amlInvestigator);
            logger.LogInformation("Created role: {Name} (AML Risk: High)", amlInvestigator.Name);

            var complianceOfficer = new Role
            {
                Id = Guid.NewGuid(),
                Name = "Compliance Officer / MLRO",
                Description = "Money Laundering Reporting Officer; oversees all AML/compliance functions and reporting",
                Status = "Draft",
                AmlRisk = "High",
                SanctionsRisk = "High",
                FraudRisk = "High",
                DocumentationRisk = "High",
                OperationalRisk = "High",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            complianceOfficer.Departments.Add(new RoleDepartment
            {
                RoleId = complianceOfficer.Id,
                Role = complianceOfficer,
                DepartmentId = financialCrimeAml.Id,
                Department = financialCrimeAml
            });
            await hierarchyRepository.CreateRoleAsync(complianceOfficer);
            logger.LogInformation("Created role: {Name} (AML Risk: High)", complianceOfficer.Name);

            var customerAdvisor = new Role
            {
                Id = Guid.NewGuid(),
                Name = "Customer Advisor / Front Office Advisor",
                Description = "Provides customer service and financial advice; first line of AML awareness",
                Status = "Draft",
                AmlRisk = "Medium",
                SanctionsRisk = "Low",
                FraudRisk = "Medium",
                DocumentationRisk = "Medium",
                OperationalRisk = "Low",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            customerAdvisor.Departments.Add(new RoleDepartment
            {
                RoleId = customerAdvisor.Id,
                Role = customerAdvisor,
                DepartmentId = customerOperations.Id,
                Department = customerOperations
            });
            await hierarchyRepository.CreateRoleAsync(customerAdvisor);
            logger.LogInformation("Created role: {Name} (AML Risk: Medium)", customerAdvisor.Name);

            // Step 4: Publish roles
            await hierarchyRepository.UpdateRoleStatusAsync(kycAnalyst.Id, "Published");
            await hierarchyRepository.UpdateRoleStatusAsync(amlInvestigator.Id, "Published");
            await hierarchyRepository.UpdateRoleStatusAsync(complianceOfficer.Id, "Published");
            await hierarchyRepository.UpdateRoleStatusAsync(customerAdvisor.Id, "Published");
            logger.LogInformation("Published all roles");

            logger.LogInformation("Seed data initialization complete");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Seed data initialization failed");
            throw;
        }
    }
}
