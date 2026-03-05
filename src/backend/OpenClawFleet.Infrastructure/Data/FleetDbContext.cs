using Microsoft.EntityFrameworkCore;
using OpenClawFleet.Core.Entities;

namespace OpenClawFleet.Infrastructure.Data;

public class FleetDbContext : DbContext
{
    public FleetDbContext(DbContextOptions<FleetDbContext> options) : base(options) { }

    public DbSet<OpenClawInstance> Instances => Set<OpenClawInstance>();
    public DbSet<AgentRole> AgentRoles => Set<AgentRole>();
    public DbSet<FleetTask> Tasks => Set<FleetTask>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<OpenClawInstance>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.ContainerId).HasMaxLength(100);
            entity.Property(e => e.ContainerName).HasMaxLength(100);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.HasIndex(e => e.Port).IsUnique();
        });

        modelBuilder.Entity<AgentRole>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Key).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Key).IsUnique();
        });

        modelBuilder.Entity<FleetTask>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.InstanceId);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.InstanceId);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => e.Direction);
        });
    }
}