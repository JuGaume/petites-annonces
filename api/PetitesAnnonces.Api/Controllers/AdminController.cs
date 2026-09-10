using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Caching;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Models;
using PetitesAnnonces.Api.Storage;

namespace PetitesAnnonces.Api.Controllers;

/// <summary>
/// Modération de la plateforme (spec §11) : utilisateurs, groupes, annonces,
/// catégories, journal d'audit. Réservé au rôle <see cref="Roles.Admin"/>.
/// </summary>
[ApiController]
[Route("admin")]
[Authorize(Roles = Roles.Admin)]
public class AdminController(
    ApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    IBlobStorageService blobStorage,
    IMemoryCache cache) : ControllerBase
{
    private const int MaxCategoryNameLength = 80;

    private string CurrentUserId => User.FindFirst(ClaimTypes.NameIdentifier)!.Value;

    [HttpGet("users")]
    public async Task<ActionResult<List<AdminUserResponse>>> ListUsers()
    {
        var users = await userManager.Users.AsNoTracking().OrderBy(u => u.Email).ToListAsync();

        var responses = new List<AdminUserResponse>(users.Count);
        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);
            var isDisabled = await userManager.IsLockedOutAsync(user);
            responses.Add(new AdminUserResponse(user.Id, user.Email!, user.DisplayName, [.. roles], isDisabled));
        }

        return responses;
    }

    [HttpPost("users/{userId}/disable")]
    public async Task<IActionResult> DisableUser(string userId)
    {
        if (userId == CurrentUserId)
        {
            return ValidationProblem("Vous ne pouvez pas désactiver votre propre compte.");
        }

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return NotFound();
        }

        // LockoutEnabled peut être à faux si jamais désactivé explicitement ; on le
        // force pour garantir que la désactivation prend effet quel que soit l'historique.
        await userManager.SetLockoutEnabledAsync(user, true);
        await userManager.SetLockoutEndDateAsync(user, DateTimeOffset.MaxValue);

        await LogAdminActionAsync("DisableUser", userId, user.Email);
        return NoContent();
    }

    [HttpPost("users/{userId}/enable")]
    public async Task<IActionResult> EnableUser(string userId)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return NotFound();
        }

        await userManager.SetLockoutEndDateAsync(user, null);

        await LogAdminActionAsync("EnableUser", userId, user.Email);
        return NoContent();
    }

    [HttpGet("groups")]
    public async Task<ActionResult<List<AdminGroupResponse>>> ListGroups()
    {
        return await db.Groups.AsNoTracking()
            .OrderByDescending(g => g.CreatedAt)
            .Select(g => new AdminGroupResponse(g.Id, g.Name, g.Description, g.CreatedByUserId, g.CreatedAt, g.Memberships.Count))
            .ToListAsync();
    }

    [HttpDelete("groups/{groupId:int}")]
    public async Task<IActionResult> DeleteGroup(int groupId)
    {
        var group = await db.Groups.FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null)
        {
            return NotFound();
        }

        // Les lignes en base (annonces, adhésions, invitations, conversations...) sont
        // supprimées en cascade ; les fichiers physiques/blob des photos ne le sont pas,
        // il faut les nettoyer explicitement avant.
        await DeleteListingImagesAsync(db.ListingImages.Where(i => i.Listing!.GroupId == groupId));

        db.Groups.Remove(group);
        await LogAdminActionAsync("DeleteGroup", groupId.ToString(), group.Name);
        return NoContent();
    }

    [HttpGet("listings")]
    public async Task<ActionResult<List<AdminListingResponse>>> ListListings([FromQuery] int? groupId)
    {
        var query = db.Listings.AsNoTracking().AsQueryable();
        if (groupId is not null)
        {
            query = query.Where(l => l.GroupId == groupId);
        }

        return await query
            .OrderByDescending(l => l.CreatedAt)
            .Join(db.Groups, l => l.GroupId, g => g.Id, (l, g) => new { Listing = l, Group = g })
            .Join(db.Users, lg => lg.Listing.AuthorUserId, u => u.Id, (lg, u) => new AdminListingResponse(
                lg.Listing.Id,
                lg.Listing.Title,
                lg.Group.Id,
                lg.Group.Name,
                u.Id,
                u.DisplayName,
                lg.Listing.Status.ToString(),
                lg.Listing.CreatedAt))
            .ToListAsync();
    }

    [HttpDelete("listings/{listingId:int}")]
    public async Task<IActionResult> DeleteListing(int listingId)
    {
        var listing = await db.Listings.Include(l => l.Images).FirstOrDefaultAsync(l => l.Id == listingId);
        if (listing is null)
        {
            return NotFound();
        }

        foreach (var image in listing.Images)
        {
            await blobStorage.DeleteAsync(image.StoragePath);
            await blobStorage.DeleteAsync(image.ThumbnailStoragePath);
        }

        db.Listings.Remove(listing);
        await LogAdminActionAsync("DeleteListing", listingId.ToString(), listing.Title);
        return NoContent();
    }

    [HttpPost("categories")]
    public async Task<ActionResult<CategoryResponse>> CreateCategory(CreateCategoryRequest request)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
        {
            return ValidationProblem("Le nom de la catégorie est requis.");
        }

        if (name.Length > MaxCategoryNameLength)
        {
            return ValidationProblem($"Le nom de la catégorie ne peut pas dépasser {MaxCategoryNameLength} caractères.");
        }

        if (await db.Categories.AnyAsync(c => c.Name == name))
        {
            return ValidationProblem("Cette catégorie existe déjà.");
        }

        var category = new Category { Name = name };
        db.Categories.Add(category);
        await LogAdminActionAsync("CreateCategory", null, name);
        cache.Remove(CacheKeys.Categories);

        return new CategoryResponse(category.Id, category.Name);
    }

    [HttpDelete("categories/{categoryId:int}")]
    public async Task<IActionResult> DeleteCategory(int categoryId)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == categoryId);
        if (category is null)
        {
            return NotFound();
        }

        if (await db.Listings.AnyAsync(l => l.CategoryId == categoryId))
        {
            return ValidationProblem("Impossible de supprimer une catégorie utilisée par des annonces.");
        }

        db.Categories.Remove(category);
        await LogAdminActionAsync("DeleteCategory", categoryId.ToString(), category.Name);
        cache.Remove(CacheKeys.Categories);
        return NoContent();
    }

    [HttpGet("audit-log")]
    public async Task<ActionResult<List<AuditLogEntryResponse>>> GetAuditLog([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        return await db.AuditLogEntries.AsNoTracking()
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Join(db.Users, e => e.AdminUserId, u => u.Id, (e, u) => new AuditLogEntryResponse(
                e.Id, e.AdminUserId, u.DisplayName, e.Action, e.TargetId, e.Details, e.CreatedAt))
            .ToListAsync();
    }

    private async Task DeleteListingImagesAsync(IQueryable<ListingImage> query)
    {
        var images = await query.ToListAsync();
        foreach (var image in images)
        {
            await blobStorage.DeleteAsync(image.StoragePath);
            await blobStorage.DeleteAsync(image.ThumbnailStoragePath);
        }
    }

    /// <summary>Consigne l'action et persiste, dans la même transaction, tout changement déjà en attente sur le contexte.</summary>
    private async Task LogAdminActionAsync(string action, string? targetId, string? details)
    {
        db.AuditLogEntries.Add(new AuditLogEntry
        {
            AdminUserId = CurrentUserId,
            Action = action,
            TargetId = targetId,
            Details = details,
        });
        await db.SaveChangesAsync();
    }
}
