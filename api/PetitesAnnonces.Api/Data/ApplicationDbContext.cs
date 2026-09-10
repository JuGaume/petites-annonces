using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<Group> Groups => Set<Group>();

    public DbSet<GroupMembership> GroupMemberships => Set<GroupMembership>();

    public DbSet<GroupInvitation> GroupInvitations => Set<GroupInvitation>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<RefreshToken>(entity =>
        {
            entity.HasIndex(rt => rt.UserId);
            entity.Property(rt => rt.TokenHash).HasMaxLength(256).IsRequired();
        });

        builder.Entity<Group>(entity =>
        {
            entity.Property(g => g.Name).HasMaxLength(120).IsRequired();
            entity.Property(g => g.Description).HasMaxLength(500);
        });

        builder.Entity<GroupMembership>(entity =>
        {
            entity.HasIndex(m => new { m.GroupId, m.UserId }).IsUnique();
            entity.Property(m => m.Role).HasConversion<string>().HasMaxLength(20);
            entity.HasOne(m => m.Group)
                .WithMany(g => g.Memberships)
                .HasForeignKey(m => m.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<GroupInvitation>(entity =>
        {
            entity.HasIndex(i => i.Token).IsUnique();
            entity.HasIndex(i => i.GroupId);
            entity.Property(i => i.Token).HasMaxLength(64).IsRequired();
            entity.Property(i => i.Type).HasConversion<string>().HasMaxLength(20);
            entity.Property(i => i.TargetEmail).HasMaxLength(256);
            entity.HasOne(i => i.Group)
                .WithMany()
                .HasForeignKey(i => i.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
