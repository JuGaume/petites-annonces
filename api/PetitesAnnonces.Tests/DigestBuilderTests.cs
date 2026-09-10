using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Models;
using PetitesAnnonces.Api.Notifications;
using Xunit;

namespace PetitesAnnonces.Tests;

/// <summary>
/// Test unitaire de la logique de sélection des annonces à inclure dans le digest
/// (spec Phase 5), isolé de la planification et de l'envoi d'email : un
/// <see cref="ApplicationDbContext"/> InMemory suffit, pas besoin de monter l'API.
/// </summary>
public class DigestBuilderTests
{
    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static ApplicationUser NewUser(string id, string displayName) => new()
    {
        Id = id,
        UserName = $"{id}@example.com",
        Email = $"{id}@example.com",
        DisplayName = displayName,
    };

    private static Listing NewListing(int groupId, string authorId, int categoryId, string title, DateTimeOffset createdAt) => new()
    {
        GroupId = groupId,
        AuthorUserId = authorId,
        CategoryId = categoryId,
        Title = title,
        Mode = ListingMode.Donation,
        ContactMode = ContactMode.DirectContact,
        ContactDetails = "peu importe",
        CreatedAt = createdAt,
    };

    [Fact]
    public async Task Includes_Only_Listings_Created_Since_The_Last_Digest()
    {
        await using var db = CreateContext();

        var member = NewUser("member", "Membre");
        var author = NewUser("author", "Auteur");
        db.Users.AddRange(member, author);

        var group = new Group { Name = "Groupe", CreatedByUserId = author.Id };
        db.Groups.Add(group);
        var category = new Category { Name = "Divers" };
        db.Categories.Add(category);
        await db.SaveChangesAsync();

        var lastDigest = DateTimeOffset.UtcNow.AddDays(-1);
        db.GroupMemberships.Add(new GroupMembership
        {
            GroupId = group.Id,
            UserId = member.Id,
            JoinedAt = lastDigest.AddDays(-30),
            LastDigestSentAt = lastDigest,
        });
        db.GroupMemberships.Add(new GroupMembership { GroupId = group.Id, UserId = author.Id, Role = GroupMemberRole.Admin });

        db.Listings.Add(NewListing(group.Id, author.Id, category.Id, "Avant le dernier digest", lastDigest.AddHours(-1)));
        db.Listings.Add(NewListing(group.Id, author.Id, category.Id, "Après le dernier digest", lastDigest.AddHours(1)));
        await db.SaveChangesAsync();

        var digests = await new DigestBuilder(db).BuildPendingDigestsAsync(DateTimeOffset.UtcNow);

        var memberDigest = Assert.Single(digests, d => d.UserId == member.Id);
        var listing = Assert.Single(memberDigest.NewListings);
        Assert.Equal("Après le dernier digest", listing.Title);
    }

    [Fact]
    public async Task Uses_JoinedAt_As_The_Starting_Point_When_No_Digest_Was_Ever_Sent()
    {
        await using var db = CreateContext();

        var member = NewUser("member", "Membre");
        var author = NewUser("author", "Auteur");
        db.Users.AddRange(member, author);

        var group = new Group { Name = "Groupe", CreatedByUserId = author.Id };
        db.Groups.Add(group);
        var category = new Category { Name = "Divers" };
        db.Categories.Add(category);
        await db.SaveChangesAsync();

        var joinedAt = DateTimeOffset.UtcNow.AddDays(-2);
        db.GroupMemberships.Add(new GroupMembership { GroupId = group.Id, UserId = member.Id, JoinedAt = joinedAt });
        db.GroupMemberships.Add(new GroupMembership { GroupId = group.Id, UserId = author.Id, Role = GroupMemberRole.Admin });

        db.Listings.Add(NewListing(group.Id, author.Id, category.Id, "Avant l'adhésion", joinedAt.AddDays(-10)));
        db.Listings.Add(NewListing(group.Id, author.Id, category.Id, "Après l'adhésion", joinedAt.AddHours(1)));
        await db.SaveChangesAsync();

        var digests = await new DigestBuilder(db).BuildPendingDigestsAsync(DateTimeOffset.UtcNow);

        var memberDigest = Assert.Single(digests, d => d.UserId == member.Id);
        var listing = Assert.Single(memberDigest.NewListings);
        Assert.Equal("Après l'adhésion", listing.Title);
    }

    [Fact]
    public async Task Excludes_The_Authors_Own_Listings_From_Their_Own_Digest()
    {
        await using var db = CreateContext();

        var author = NewUser("author", "Auteur");
        db.Users.Add(author);
        var group = new Group { Name = "Groupe", CreatedByUserId = author.Id };
        db.Groups.Add(group);
        var category = new Category { Name = "Divers" };
        db.Categories.Add(category);
        await db.SaveChangesAsync();

        db.GroupMemberships.Add(new GroupMembership
        {
            GroupId = group.Id,
            UserId = author.Id,
            Role = GroupMemberRole.Admin,
            JoinedAt = DateTimeOffset.UtcNow.AddDays(-10),
        });
        db.Listings.Add(NewListing(group.Id, author.Id, category.Id, "Ma propre annonce", DateTimeOffset.UtcNow.AddHours(-1)));
        await db.SaveChangesAsync();

        var digests = await new DigestBuilder(db).BuildPendingDigestsAsync(DateTimeOffset.UtcNow);

        Assert.Empty(digests);
    }

    [Fact]
    public async Task Excludes_Members_Who_Disabled_The_Digest_For_The_Group()
    {
        await using var db = CreateContext();

        var member = NewUser("member", "Membre");
        var author = NewUser("author", "Auteur");
        db.Users.AddRange(member, author);
        var group = new Group { Name = "Groupe", CreatedByUserId = author.Id };
        db.Groups.Add(group);
        var category = new Category { Name = "Divers" };
        db.Categories.Add(category);
        await db.SaveChangesAsync();

        db.GroupMemberships.Add(new GroupMembership
        {
            GroupId = group.Id,
            UserId = member.Id,
            JoinedAt = DateTimeOffset.UtcNow.AddDays(-10),
            EmailDigestEnabled = false,
        });
        db.GroupMemberships.Add(new GroupMembership { GroupId = group.Id, UserId = author.Id, Role = GroupMemberRole.Admin });
        db.Listings.Add(NewListing(group.Id, author.Id, category.Id, "Nouvelle annonce", DateTimeOffset.UtcNow.AddHours(-1)));
        await db.SaveChangesAsync();

        var digests = await new DigestBuilder(db).BuildPendingDigestsAsync(DateTimeOffset.UtcNow);

        Assert.Empty(digests);
    }

    [Fact]
    public async Task Returns_Nothing_When_There_Are_No_New_Listings()
    {
        await using var db = CreateContext();

        var member = NewUser("member", "Membre");
        db.Users.Add(member);
        var group = new Group { Name = "Groupe", CreatedByUserId = member.Id };
        db.Groups.Add(group);
        await db.SaveChangesAsync();

        db.GroupMemberships.Add(new GroupMembership
        {
            GroupId = group.Id,
            UserId = member.Id,
            Role = GroupMemberRole.Admin,
            JoinedAt = DateTimeOffset.UtcNow.AddDays(-10),
        });
        await db.SaveChangesAsync();

        var digests = await new DigestBuilder(db).BuildPendingDigestsAsync(DateTimeOffset.UtcNow);

        Assert.Empty(digests);
    }
}
