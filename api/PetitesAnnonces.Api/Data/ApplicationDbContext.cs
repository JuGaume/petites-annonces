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

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Listing> Listings => Set<Listing>();

    public DbSet<ListingImage> ListingImages => Set<ListingImage>();

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

        builder.Entity<Category>(entity =>
        {
            entity.Property(c => c.Name).HasMaxLength(80).IsRequired();
            entity.HasIndex(c => c.Name).IsUnique();
        });

        builder.Entity<Listing>(entity =>
        {
            entity.Property(l => l.Title).HasMaxLength(120).IsRequired();
            entity.Property(l => l.Description).HasMaxLength(2000);
            entity.Property(l => l.Price).HasColumnType("decimal(10,2)");
            entity.Property(l => l.Mode).HasConversion<string>().HasMaxLength(20);
            entity.Property(l => l.Status).HasConversion<string>().HasMaxLength(20);
            entity.Property(l => l.ContactMode).HasConversion<string>().HasMaxLength(20);
            entity.Property(l => l.ContactDetails).HasMaxLength(300);

            // Index posés pour les flux paginés/filtrés par groupe, catégorie et statut
            // (spec §9, performance).
            entity.HasIndex(l => l.GroupId);
            entity.HasIndex(l => l.CategoryId);
            entity.HasIndex(l => l.Status);

            entity.HasOne(l => l.Group).WithMany().HasForeignKey(l => l.GroupId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(l => l.Category).WithMany().HasForeignKey(l => l.CategoryId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<ListingImage>(entity =>
        {
            entity.Property(i => i.StoragePath).HasMaxLength(300).IsRequired();
            entity.Property(i => i.Url).HasMaxLength(1000).IsRequired();
            entity.Property(i => i.ThumbnailStoragePath).HasMaxLength(300).IsRequired();
            entity.Property(i => i.ThumbnailUrl).HasMaxLength(1000).IsRequired();
            entity.HasOne(i => i.Listing)
                .WithMany(l => l.Images)
                .HasForeignKey(i => i.ListingId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
