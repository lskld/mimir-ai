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
    public DbSet<RoleTrainingOutline> RoleTrainingOutlines => Set<RoleTrainingOutline>();
    public DbSet<FullTrainingProgram> FullTrainingPrograms => Set<FullTrainingProgram>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Document → DocumentChunk
        modelBuilder.Entity<Document>()
            .HasMany(d => d.Chunks)
            .WithOne(c => c.Document)
            .HasForeignKey(c => c.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        // Document → TrainingOutline
        modelBuilder.Entity<Document>()
            .HasOne<TrainingOutline>()
            .WithOne(o => o.Document)
            .HasForeignKey<TrainingOutline>(o => o.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        // DepartmentOrganizationLevel junction table
        modelBuilder.Entity<DepartmentOrganizationLevel>()
            .HasKey(d => new { d.DepartmentId, d.OrganizationLevelId });

        modelBuilder.Entity<DepartmentOrganizationLevel>()
            .HasOne(d => d.Department)
            .WithMany(dep => dep.OrganizationLevels)
            .HasForeignKey(d => d.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DepartmentOrganizationLevel>()
            .HasOne(d => d.OrganizationLevel)
            .WithMany(ol => ol.Departments)
            .HasForeignKey(d => d.OrganizationLevelId)
            .OnDelete(DeleteBehavior.Restrict);

        // RoleDepartment junction table
        modelBuilder.Entity<RoleDepartment>()
            .HasKey(r => new { r.RoleId, r.DepartmentId });

        modelBuilder.Entity<RoleDepartment>()
            .HasOne(rd => rd.Role)
            .WithMany(r => r.Departments)
            .HasForeignKey(rd => rd.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RoleDepartment>()
            .HasOne(rd => rd.Department)
            .WithMany(d => d.Roles)
            .HasForeignKey(rd => rd.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        // DocumentAssignment — separate single-column indexes for efficient polymorphic lookup
        modelBuilder.Entity<DocumentAssignment>()
            .HasIndex(a => a.TargetType);

        modelBuilder.Entity<DocumentAssignment>()
            .HasIndex(a => a.TargetId);

        // DocumentAssignment → Document
        modelBuilder.Entity<DocumentAssignment>()
            .HasOne(a => a.Document)
            .WithMany(d => d.Assignments)
            .HasForeignKey(a => a.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        // TargetId has no FK constraint: DocumentAssignment.TargetId is a polymorphic reference
        // that may point to OrganizationLevel, Department, or Role depending on TargetType.
        // EF Core only supports single-target FKs, so referential integrity for TargetId
        // is enforced in the service layer (DocumentVaultService) instead.

        // Ignore the DocumentAssignments collections on the hierarchy entities — they have no
        // backing FK column in DocumentAssignment (the reference is polymorphic via TargetType/TargetId),
        // so EF Core must not attempt to infer shadow FKs for them.
        modelBuilder.Entity<OrganizationLevel>().Ignore(o => o.DocumentAssignments);
        modelBuilder.Entity<Department>().Ignore(d => d.DocumentAssignments);
        modelBuilder.Entity<Role>().Ignore(r => r.DocumentAssignments);

        // RoleTrainingOutline — one active outline per role; index RoleId for fast lookup.
        // No FK to Role: same pattern as DocumentAssignment.TargetId, integrity enforced in service.
        modelBuilder.Entity<RoleTrainingOutline>()
            .HasIndex(o => o.RoleId);

        // FullTrainingProgram — same no-FK pattern; integrity enforced in service.
        modelBuilder.Entity<FullTrainingProgram>()
            .HasIndex(p => p.RoleId);
    }
}
