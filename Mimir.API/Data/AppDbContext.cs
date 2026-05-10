using Microsoft.EntityFrameworkCore;
using Mimir.API.Models.Domain;
using Mimir.API.Models.Domain.Hierarchy;
using Mimir.API.Models.Domain.Vault;

namespace Mimir.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<DocumentChunk> Chunks => Set<DocumentChunk>();
    public DbSet<TrainingOutline> Outlines => Set<TrainingOutline>();
    public DbSet<OrganizationLevel> OrganizationLevels => Set<OrganizationLevel>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<DepartmentOrganizationLevel> DepartmentOrganizationLevels => Set<DepartmentOrganizationLevel>();
    public DbSet<RoleDepartment> RoleDepartments => Set<RoleDepartment>();
    public DbSet<DocumentAssignment> DocumentAssignments => Set<DocumentAssignment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Document>()
            .HasMany(d => d.Chunks)
            .WithOne(c => c.Document)
            .HasForeignKey(c => c.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Document>()
            .HasOne<TrainingOutline>()
            .WithOne(o => o.Document)
            .HasForeignKey<TrainingOutline>(o => o.DocumentId);

        modelBuilder.Entity<DepartmentOrganizationLevel>()
            .HasKey(d => new { d.DepartmentId, d.OrganizationLevelId });

        modelBuilder.Entity<RoleDepartment>()
            .HasKey(r => new { r.RoleId, r.DepartmentId });

        // TODO: TargetType + TargetId cannot be enforced as a typed FK because DocumentAssignment
        // references three different entity types (OrganizationLevel, Department, Role).
        // EF Core only supports single-target FKs, so referential integrity for TargetId
        // is validated in the service layer instead.
        modelBuilder.Entity<DocumentAssignment>()
            .HasIndex(a => new { a.TargetType, a.TargetId });

        modelBuilder.Entity<DocumentAssignment>()
            .HasOne(a => a.Document)
            .WithMany(d => d.Assignments)
            .HasForeignKey(a => a.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
